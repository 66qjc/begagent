import { randomUUID } from 'node:crypto'
import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import type { CareerPolicyConfig } from '@career/contracts'
import {
  CareerDomainError,
  CareerOrchestrator,
  createPolicyEvaluator,
  DEFAULT_CAREER_POLICY,
  type CareerRuntimePort,
} from '@career/core'
import {
  ControlledMockChannels,
  DeterministicCareerRuntime,
  LangGraphWorkflowAdapter,
  SqliteCareerRepository,
  type RuntimeCatalogView,
} from '@career/infrastructure'
import { registerRoutes } from './routes.ts'

export interface BuildAppOptions {
  databasePath: string
  logger?: boolean
  runtime?: CareerRuntimePort
  runtimeView?: RuntimeCatalogView
  policyConfig?: CareerPolicyConfig
  /** When true, constructs a LangGraph workflow adapter and injects it into the orchestrator. */
  enableWorkflow?: boolean
}

/** Composes the independent Career API application. */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false })
  const repository = new SqliteCareerRepository(options.databasePath)
  const runtime: CareerRuntimePort = options.runtime ?? new DeterministicCareerRuntime()
  const policyConfig = options.policyConfig ?? DEFAULT_CAREER_POLICY
  const runtimeView = options.runtimeView ?? {
    version: 'built-in',
    activeProviderId: 'local-demo',
    activeProtocol: 'deterministic',
    providers: [{
      id: 'local-demo',
      name: '本地确定性演示',
      protocol: 'deterministic',
      enabled: true,
      configured: true,
    }],
    degraded: false,
  } satisfies RuntimeCatalogView

  const channels = new ControlledMockChannels()

  let workflow: LangGraphWorkflowAdapter | null = null
  if (options.enableWorkflow) {
    const checkpointDbPath = options.databasePath.replace(/\.sqlite$/, '.checkpoints.db')
    workflow = new LangGraphWorkflowAdapter({ dbPath: checkpointDbPath })
  }

  const orchestrator = new CareerOrchestrator({
    repository,
    runtime,
    channels,
    clock: { now: () => new Date().toISOString() },
    ids: { next: () => randomUUID() },
    policy: createPolicyEvaluator(policyConfig),
    ...(workflow ? { workflow } : {}),
  })

  // Wire the executor callback now that orchestrator exists
  if (workflow) {
    workflow.setExecutor(async (actionId: string) => {
      await orchestrator.completeApprovedAction(actionId)
    })
  }

  await app.register(cors, { origin: true })
  registerRoutes(app, orchestrator, {
    runtime: runtimeView,
    policy: policyConfig,
    databaseHealthy: () => repository.healthCheck(),
    ...(workflow ? { workflow } : {}),
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      void reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: '请求字段不完整或格式错误。',
        issues: error.issues,
      })
      return
    }
    if (error instanceof CareerDomainError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 409
      void reply.status(status).send({
        code: error.code,
        message: error.message,
      })
      return
    }
    void reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: error.message,
    })
  })

  app.addHook('onClose', async () => {
    repository.close()
    await runtime.close?.()
    await workflow?.close()
  })
  await app.ready()
  return app
}
