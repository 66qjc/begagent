import type { FastifyInstance, FastifyPluginCallback } from 'fastify'
import { z } from 'zod'
import { AnalyzeJobRequestSchema } from '@career/contracts'
import type { CareerOrchestrator, WorkflowPort } from '@career/core'

const ChallengeSchema = z.object({ pursuitId: z.string().min(1) })
const EvidenceSchema = z.object({
  pursuitId: z.string().min(1),
  title: z.string().trim().min(4).max(160),
  summary: z.string().trim().min(12).max(2_000),
  proofUrl: z.string().trim().min(8).max(2_000),
})
const ActionParamsSchema = z.object({ id: z.string().min(1) })
const ActionDecisionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
})
const HrSimulationSchema = z.object({ pursuitId: z.string().min(1), kind: z.literal('salary_question') })
const CreatePursuitSchema = AnalyzeJobRequestSchema
const WorkflowResumeParamsSchema = z.object({ runId: z.string().min(1) })
const WorkflowResumeSchema = z.object({
  actionId: z.string().min(1),
  approved: z.boolean(),
})

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
  app.post('/api/pursuits', async (request) => {
    return opts.orchestrator.createPursuit(CreatePursuitSchema.parse(request.body))
  })
  app.post('/api/jobs/analyze', async (request) => {
    return opts.orchestrator.analyzeJob(AnalyzeJobRequestSchema.parse(request.body))
  })
  app.post('/api/missions/challenge', async (request) => {
    const body = ChallengeSchema.parse(request.body)
    return opts.orchestrator.chooseChallenge(body.pursuitId)
  })
  app.post('/api/evidence/complete', async (request) => {
    const body = EvidenceSchema.parse(request.body)
    return opts.orchestrator.completeEvidenceSprint(body.pursuitId, {
      title: body.title,
      summary: body.summary,
      proofUrl: body.proofUrl,
    })
  })
  app.post('/api/applications/request', async (request) => {
    const body = z.object({ pursuitId: z.string().min(1) }).parse(request.body)
    return opts.orchestrator.requestApplication(body.pursuitId)
  })
  app.post('/api/actions/:id/decision', async (request) => {
    const params = ActionParamsSchema.parse(request.params)
    const body = ActionDecisionSchema.parse(request.body)
    return opts.orchestrator.decideAction({ actionId: params.id, ...body })
  })
  app.post('/api/hr/simulate', async (request) => {
    const body = HrSimulationSchema.parse(request.body)
    return opts.orchestrator.simulateHrMessage(body.pursuitId, { kind: body.kind })
  })
  done()
}

/** Workflow routes — durable workflow resume endpoint for LangGraph integration. */
const workflowPlugin: FastifyPluginCallback<{ workflow: WorkflowPort; orchestrator: CareerOrchestrator }> = (app, opts, done) => {
  app.post('/api/workflow/:runId/resume', async (request) => {
    const params = WorkflowResumeParamsSchema.parse(request.params)
    const body = WorkflowResumeSchema.parse(request.body)
    await opts.workflow.resumeMission({
      runId: params.runId,
      approved: body.approved,
      actionId: body.actionId,
    })
    return opts.orchestrator.getWorkspace()
  })
  done()
}

export interface SystemConfigView {
  runtime: import('@career/infrastructure').RuntimeCatalogView
  policy: import('@career/contracts').CareerPolicyConfig
  databaseHealthy: () => Promise<boolean>
  workflow?: WorkflowPort
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
      degraded: systemConfig.runtime.degraded,
      policyVersion: systemConfig.policy.version,
      database: database ? 'career-domain' : 'unreachable',
      workflow: systemConfig.workflow ? 'langgraph' : 'none',
    }
  })
  app.get('/api/system/config', async () => systemConfig)

  app.register(queryPlugin, { orchestrator })
  app.register(commandPlugin, { orchestrator })

  if (systemConfig.workflow) {
    app.register(workflowPlugin, { workflow: systemConfig.workflow, orchestrator })
  }
}
