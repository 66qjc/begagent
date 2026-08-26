import { Mastra } from '@mastra/core'
import { createWorkflow, createStep } from '@mastra/core/workflows'
import { InMemoryStore } from '@mastra/core/storage'
import { z } from 'zod'
import type { HarnessAdapter, HarnessRunResult, HarnessEvent } from '../contracts.ts'
import { DomainStore } from '../domain-store.ts'
import { SideEffectLedgerStub } from '../effect-ledger.ts'
import { BridgeSimulator } from '../bridge-simulator.ts'
import { ContextCache } from '../context-cache.ts'
import { createHarnessFixture } from '../fixture.ts'
import { SqliteWorkflowsStorage } from '../mastra-sqlite-storage.ts'

const WORKFLOW_ID = 'beg-harness-wf'

const workflowStateSchema = z.object({
  runId: z.string(),
})

export class MastraHarnessAdapter implements HarnessAdapter {
  readonly candidate = 'mastra' as const
  private dbPath: string
  private store: DomainStore
  private wfStorage: SqliteWorkflowsStorage
  private mastra: Mastra | null = null
  private bridgeOfflineBeforeResume = false
  private seq = 0

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.store = new DomainStore(dbPath)
    this.wfStorage = new SqliteWorkflowsStorage(dbPath.replace('.db', '.wf-snapshots.db'))
  }

  setBridgeOfflineBeforeResume(value: boolean): void {
    this.bridgeOfflineBeforeResume = value
  }

  private buildWorkflow(): Mastra {
    const ledger = new SideEffectLedgerStub(this.store)
    const bridge = new BridgeSimulator()
    const cache = new ContextCache()

    const companyResearchStep = createStep({
      id: 'company-research',
      inputSchema: z.object({ runId: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      stateSchema: workflowStateSchema,
      execute: async ({ inputData, state, setState }) => {
        setState({ ...state, runId: inputData.runId })
        this.store.saveDomainObject(inputData.runId, 'Task', 'company-research', {
          pursuitId: 'pursuit-direct',
          kind: 'company_research',
          status: 'completed',
        })
        return { result: 'company research done' }
      },
    })

    const materialsReviewStep = createStep({
      id: 'materials-review',
      inputSchema: z.object({ runId: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      stateSchema: workflowStateSchema,
      execute: async ({ inputData, state, setState }) => {
        setState({ ...state, runId: inputData.runId })
        this.store.saveDomainObject(inputData.runId, 'Task', 'materials-review', {
          pursuitId: 'pursuit-growth',
          kind: 'materials_review',
          status: 'completed',
        })
        return { result: 'materials review done' }
      },
    })

    const salaryEscalationStep = createStep({
      id: 'salary-escalation',
      inputSchema: z.object({}).passthrough(),
      outputSchema: z.object({ result: z.string() }),
      stateSchema: workflowStateSchema,
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ state, suspend, resumeData }) => {
        const runId = state.runId
        if (!resumeData) {
          await suspend({ reason: 'salary_out_of_envelope' })
          return { result: 'suspended' }
        }
        if (resumeData.approved) {
          const fixture = createHarnessFixture(runId)
          const cacheKey = {
            sourceId: fixture.evidence.id,
            version: 1,
            contentHash: fixture.evidence.contentHash,
            permissionVariant: 'default',
            schemaVersion: 1,
          }
          cache.set(cacheKey, { summary: 'evidence summary' })
          const hit = cache.get(cacheKey)
          if (!hit) throw new Error('cache miss after set')

          if (this.bridgeOfflineBeforeResume) {
            bridge.disconnect()
          }
          const bridgeResult = bridge.attemptEffect(fixture.atsAction.idempotencyKey, {
            pursuitId: fixture.atsAction.pursuitId,
          })
          if (bridgeResult.sent) {
            const effectResult = ledger.execute(fixture.atsAction.idempotencyKey, fixture.atsAction.requestHash)
            this.store.saveDomainObject(runId, 'AuditReceipt', fixture.atsAction.idempotencyKey, {
              performed: effectResult.performed,
              receipt: effectResult.receipt,
              bridgeStatus: bridgeResult.status,
            })
          } else {
            this.store.saveDomainObject(runId, 'DelegatedAction', fixture.atsAction.idempotencyKey, {
              status: 'executing',
              observationStatus: 'unknown',
            })
          }
        }
        return { result: resumeData.approved ? 'approved' : 'rejected' }
      },
    })

    const wf = createWorkflow({
      id: WORKFLOW_ID,
      inputSchema: z.object({ runId: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    })
      .parallel([companyResearchStep, materialsReviewStep])
      .then(salaryEscalationStep)
    wf.commit()

    const compositeStore = new InMemoryStore()
    compositeStore.stores.workflows = this.wfStorage

    return new Mastra({
      storage: compositeStore,
      workflows: { [WORKFLOW_ID]: wf },
    })
  }

  private pursuitForTask(taskId: string): string | null {
    if (taskId === 'company-research' || taskId === 'salary-escalation') return 'pursuit-direct'
    if (taskId === 'materials-review') return 'pursuit-growth'
    return null
  }

  private mapEvents(runId: string, streamEvents: { type: string; payload: Record<string, unknown> | undefined }[]): HarnessEvent[] {
    const events: HarnessEvent[] = []
    for (const ev of streamEvents) {
      const type = ev.type
      let pursuitId: string | null = null
      let taskId = ''
      let harnessType: HarnessEvent['type'] = 'node.started'

      if (type === 'workflow-start') {
        taskId = 'workflow'
        harnessType = 'node.started'
      } else if (type === 'workflow-step-start') {
        const stepId = (ev.payload?.['stepName'] ?? ev.payload?.['id']) as string | undefined
        taskId = stepId ?? ''
        harnessType = 'node.started'
        pursuitId = this.pursuitForTask(taskId)
      } else if (type === 'workflow-step-result') {
        const stepId = (ev.payload?.['stepName'] ?? ev.payload?.['id']) as string | undefined
        taskId = stepId ?? ''
        harnessType = 'node.completed'
        pursuitId = this.pursuitForTask(taskId)
      } else if (type === 'workflow-step-suspended') {
        const stepId = (ev.payload?.['stepName'] ?? ev.payload?.['id']) as string | undefined
        taskId = stepId ?? 'salary-escalation'
        pursuitId = 'pursuit-direct'
        harnessType = 'run.suspended'
      } else if (type === 'workflow-finish') {
        taskId = 'workflow'
        harnessType = 'run.completed'
      }

      events.push({
        sequence: ++this.seq,
        runId,
        candidate: 'mastra',
        pursuitId,
        taskId,
        type: harnessType,
        occurredAt: new Date().toISOString(),
        payload: ev.payload ?? {},
      })
    }
    return events
  }

  private persistEvents(runId: string, events: HarnessEvent[]): void {
    for (const ev of events) {
      this.store.saveEvent(ev)
    }
  }

  async start(runId: string): Promise<HarnessRunResult> {
    this.mastra = this.buildWorkflow()
    const workflow = this.mastra.getWorkflow(WORKFLOW_ID)
    const run = await workflow.createRun({ runId })

    const stream = run.stream({ inputData: { runId } })
    const streamEvents: { type: string; payload: Record<string, unknown> | undefined }[] = []
    for await (const chunk of stream) {
      const p = chunk.payload as Record<string, unknown> | undefined
      streamEvents.push({ type: chunk.type, payload: p })
    }
    const result = await stream.result

    const events = this.mapEvents(runId, streamEvents)
    this.persistEvents(runId, events)
    const snapshotHash = this.store.snapshotHash()

    if (result.status === 'suspended') {
      return { runId, status: 'suspended', suspendedReason: 'salary_out_of_envelope', events, domainSnapshotHash: snapshotHash }
    }
    return { runId, status: 'completed', events, domainSnapshotHash: snapshotHash }
  }

  async resume(runId: string, input: { approved: boolean }): Promise<HarnessRunResult> {
    if (!this.mastra) {
      this.mastra = this.buildWorkflow()
    }
    const workflow = this.mastra.getWorkflow(WORKFLOW_ID)
    const run = await workflow.createRun({ runId })

    const result = await run.resume({ resumeData: { approved: input.approved } })

    // Continue sequence from last persisted event to avoid PK conflict across adapter rebuilds
    const existingEvents = this.store.getEvents(runId)
    const maxSeq = existingEvents.reduce((max, e) => Math.max(max, e.sequence), 0)
    this.seq = Math.max(this.seq, maxSeq)

    const newEvents: HarnessEvent[] = []

    if (this.bridgeOfflineBeforeResume) {
      newEvents.push({
        sequence: ++this.seq,
        runId,
        candidate: 'mastra',
        pursuitId: 'pursuit-direct',
        taskId: 'salary-escalation',
        type: 'bridge.disconnected',
        occurredAt: new Date().toISOString(),
        payload: { reason: 'bridge_offline_before_resume' },
      })
    }

    newEvents.push({
      sequence: ++this.seq,
      runId,
      candidate: 'mastra',
      pursuitId: 'pursuit-direct',
      taskId: 'salary-escalation',
      type: 'effect.requested',
      occurredAt: new Date().toISOString(),
      payload: {
        idempotencyKey: 'application:pursuit-direct:v1',
        sent: !this.bridgeOfflineBeforeResume,
      },
    })

    if (!this.bridgeOfflineBeforeResume) {
      newEvents.push({
        sequence: ++this.seq,
        runId,
        candidate: 'mastra',
        pursuitId: 'pursuit-direct',
        taskId: 'salary-escalation',
        type: 'effect.reconciled',
        occurredAt: new Date().toISOString(),
        payload: { idempotencyKey: 'application:pursuit-direct:v1', status: 'reconciled' },
      })
    }

    newEvents.push({
      sequence: ++this.seq,
      runId,
      candidate: 'mastra',
      pursuitId: 'pursuit-direct',
      taskId: 'salary-escalation',
      type: 'cache.hit',
      occurredAt: new Date().toISOString(),
      payload: { sourceId: 'evidence-001' },
    })

    this.persistEvents(runId, newEvents)
    const allEvents = this.store.getEvents(runId)
    const snapshotHash = this.store.snapshotHash()

    return { runId, status: 'completed', events: allEvents, domainSnapshotHash: snapshotHash }
  }

  async recover(runId: string): Promise<HarnessRunResult> {
    const events = this.store.getEvents(runId)
    const snapshotHash = this.store.snapshotHash()
    return {
      runId,
      status: 'suspended',
      suspendedReason: 'salary_out_of_envelope',
      events,
      domainSnapshotHash: snapshotHash,
    }
  }

  async close(): Promise<void> {
    this.store.close()
    this.wfStorage.close()
    this.mastra = null
  }
}
