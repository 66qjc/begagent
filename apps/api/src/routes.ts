import type { FastifyInstance, FastifyPluginCallback } from 'fastify'
import { z } from 'zod'
import { AnalyzeJobRequestSchema } from '@career/contracts'
import type { CareerOrchestrator } from '@career/core'

/** Shared Zod schemas for command routes — validation lives in the API layer, not the orchestrator. */
const ChallengeSchema = z.object({ strategy: z.literal('evidence_sprint') })
const EvidenceSchema = z.object({
  title: z.string().trim().min(4).max(160),
  summary: z.string().trim().min(12).max(2_000),
  proofUrl: z.string().trim().min(8).max(2_000),
})
const ActionParamsSchema = z.object({ id: z.string().min(1) })
const ActionDecisionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
})
const HrSimulationSchema = z.object({ kind: z.literal('salary_question') })

interface RouteDeps {
  orchestrator: CareerOrchestrator
}

/** Query routes — read-only endpoints that never mutate mission state. */
const queryPlugin: FastifyPluginCallback<RouteDeps> = (app, opts, done) => {
  app.get('/api/workspace', async () => opts.orchestrator.getWorkspace())
  done()
}

/** Command routes — every mutation flows through the orchestrator. */
const commandPlugin: FastifyPluginCallback<RouteDeps> = (app, opts, done) => {
  app.post('/api/demo/reset', async () => opts.orchestrator.resetDemo())
  app.post('/api/jobs/analyze', async (request) => {
    return opts.orchestrator.analyzeJob(AnalyzeJobRequestSchema.parse(request.body))
  })
  app.post('/api/missions/challenge', async (request) => {
    return opts.orchestrator.chooseChallenge(ChallengeSchema.parse(request.body))
  })
  app.post('/api/evidence/complete', async (request) => {
    return opts.orchestrator.completeEvidenceSprint(EvidenceSchema.parse(request.body))
  })
  app.post('/api/applications/request', async () => opts.orchestrator.requestApplication())
  app.post('/api/actions/:id/decision', async (request) => {
    const params = ActionParamsSchema.parse(request.params)
    const body = ActionDecisionSchema.parse(request.body)
    return opts.orchestrator.decideAction({ actionId: params.id, ...body })
  })
  app.post('/api/hr/simulate', async (request) => {
    return opts.orchestrator.simulateHrMessage(HrSimulationSchema.parse(request.body))
  })
  done()
}

export interface SystemConfigView {
  runtime: import('@career/infrastructure').RuntimeCatalogView
  policy: import('@career/contracts').CareerPolicyConfig
  databaseHealthy: () => Promise<boolean>
}

/** Registers the modular command/query HTTP surface over CareerOrchestrator. */
export function registerRoutes(
  app: FastifyInstance,
  orchestrator: CareerOrchestrator,
  systemConfig: SystemConfigView,
): void {
  app.get('/api/health', async () => {
    const database = await systemConfig.databaseHealthy()
    return {
      status: database ? 'ok' : 'degraded',
      runtime: systemConfig.runtime.activeProtocol,
      provider: systemConfig.runtime.activeProviderId,
      policyVersion: systemConfig.policy.version,
      database: database ? 'career-domain' : 'unreachable',
    }
  })
  app.get('/api/system/config', async () => systemConfig)

  app.register(queryPlugin, { orchestrator })
  app.register(commandPlugin, { orchestrator })
}
