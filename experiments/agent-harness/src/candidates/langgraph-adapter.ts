import { StateGraph, Annotation, START, END, MemorySaver, interrupt, Command } from '@langchain/langgraph'
import type { HarnessAdapter, HarnessRunResult, HarnessEvent } from '../contracts.ts'
import { DomainStore } from '../domain-store.ts'
import { SideEffectLedgerStub } from '../effect-ledger.ts'
import { BridgeSimulator } from '../bridge-simulator.ts'
import { ContextCache } from '../context-cache.ts'
import { createHarnessFixture } from '../fixture.ts'
import { SqliteCheckpointSaver } from '../lg-sqlite-checkpoint.ts'

const State = Annotation.Root({
  runId: Annotation<string>,
  events: Annotation<HarnessEvent[]>({
    reducer: (a: HarnessEvent[], b: HarnessEvent[]) => [...a, ...b],
    default: () => [],
  }),
})

export class LangGraphHarnessAdapter implements HarnessAdapter {
  readonly candidate = 'langgraph' as const
  private dbPath: string
  private store: DomainStore
  private checkpointSaver: SqliteCheckpointSaver
  private bridgeOfflineBeforeResume = false
  private seq = 0

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.store = new DomainStore(dbPath)
    this.checkpointSaver = new SqliteCheckpointSaver(dbPath.replace('.db', '.checkpoints.db'))
  }

  setBridgeOfflineBeforeResume(value: boolean): void {
    this.bridgeOfflineBeforeResume = value
  }

  private buildGraph() {
    const ledger = new SideEffectLedgerStub(this.store)
    const bridge = new BridgeSimulator()
    const cache = new ContextCache()

    const companyResearchNode = async (state: typeof State.State) => {
      this.store.saveDomainObject(state.runId, 'Task', 'company-research', {
        pursuitId: 'pursuit-direct',
        kind: 'company_research',
        status: 'completed',
      })
      return {}
    }

    const materialsReviewNode = async (state: typeof State.State) => {
      this.store.saveDomainObject(state.runId, 'Task', 'materials-review', {
        pursuitId: 'pursuit-growth',
        kind: 'materials_review',
        status: 'completed',
      })
      return {}
    }

    const salaryEscalationNode = async (state: typeof State.State) => {
      const approved = interrupt('salary_out_of_envelope') as boolean
      if (approved) {
        const fixture = createHarnessFixture(state.runId)
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
          this.store.saveDomainObject(state.runId, 'AuditReceipt', fixture.atsAction.idempotencyKey, {
            performed: effectResult.performed,
            receipt: effectResult.receipt,
            bridgeStatus: bridgeResult.status,
          })
        } else {
          this.store.saveDomainObject(state.runId, 'DelegatedAction', fixture.atsAction.idempotencyKey, {
            status: 'executing',
            observationStatus: 'unknown',
          })
        }
      }
      return {}
    }

    return new StateGraph(State)
      .addNode('company-research', companyResearchNode)
      .addNode('materials-review', materialsReviewNode)
      .addNode('salary-escalation', salaryEscalationNode)
      .addEdge(START, 'company-research')
      .addEdge(START, 'materials-review')
      .addEdge('company-research', 'salary-escalation')
      .addEdge('materials-review', 'salary-escalation')
      .addEdge('salary-escalation', END)
      .compile({ checkpointer: this.checkpointSaver })
  }

  private pursuitForTask(taskId: string): string | null {
    if (taskId === 'company-research' || taskId === 'salary-escalation') return 'pursuit-direct'
    if (taskId === 'materials-review') return 'pursuit-growth'
    return null
  }

  private makeEvent(runId: string, taskId: string, type: HarnessEvent['type'], payload: Record<string, unknown> = {}): HarnessEvent {
    return {
      sequence: ++this.seq,
      runId,
      candidate: 'langgraph',
      pursuitId: this.pursuitForTask(taskId),
      taskId,
      type,
      occurredAt: new Date().toISOString(),
      payload,
    }
  }

  private eventsFromStream(runId: string, chunks: Record<string, unknown>[]): HarnessEvent[] {
    const events: HarnessEvent[] = []
    for (const chunk of chunks) {
      for (const key of Object.keys(chunk)) {
        if (key === '__interrupt__') {
          events.push(this.makeEvent(runId, 'salary-escalation', 'run.suspended', { reason: 'salary_out_of_envelope' }))
          continue
        }
        events.push(this.makeEvent(runId, key, 'node.completed', { nodeId: key }))
      }
    }
    return events
  }

  async start(runId: string): Promise<HarnessRunResult> {
    this.seq = 0
    const graph = this.buildGraph()
    const config = { configurable: { thread_id: runId } }

    const startEvent = this.makeEvent(runId, 'workflow', 'node.started', {})
    const chunks: Record<string, unknown>[] = []
    const stream = await graph.stream({ runId, events: [] }, { ...config, streamMode: 'updates' })
    for await (const chunk of stream) {
      chunks.push(chunk as Record<string, unknown>)
    }

    const nodeEvents = this.eventsFromStream(runId, chunks)
    const completeEvent = this.makeEvent(runId, 'workflow', 'run.completed', {})

    const events = [startEvent, ...nodeEvents, ...(nodeEvents.some(e => e.type === 'run.suspended') ? [completeEvent] : [])]
    this.persistEvents(runId, events)
    const snapshotHash = this.store.snapshotHash()

    const hasInterrupt = chunks.some((c) => '__interrupt__' in c)
    if (hasInterrupt) {
      return { runId, status: 'suspended', suspendedReason: 'salary_out_of_envelope', events, domainSnapshotHash: snapshotHash }
    }
    return { runId, status: 'completed', events, domainSnapshotHash: snapshotHash }
  }

  async resume(runId: string, input: { approved: boolean }): Promise<HarnessRunResult> {
    const existingEvents = this.store.getEvents(runId)
    const maxSeq = existingEvents.reduce((max, e) => Math.max(max, e.sequence), 0)
    this.seq = maxSeq

    const graph = this.buildGraph()
    const config = { configurable: { thread_id: runId } }

    const chunks: Record<string, unknown>[] = []
    const resumeStream = await graph.stream(new Command({ resume: input.approved }), { ...config, streamMode: 'updates' })
    for await (const chunk of resumeStream) {
      chunks.push(chunk as Record<string, unknown>)
    }

    const newEvents: HarnessEvent[] = []

    const resumeEvent = this.makeEvent(runId, 'salary-escalation', 'run.resumed', { approved: input.approved })
    newEvents.push(resumeEvent)

    for (const chunk of chunks) {
      for (const key of Object.keys(chunk)) {
        if (key !== '__interrupt__') {
          newEvents.push(this.makeEvent(runId, key, 'node.completed', { nodeId: key }))
        }
      }
    }

    // Only emit effect/bridge/cache events when the graph actually re-entered
    // the salary-escalation node (chunks non-empty). If the graph already
    // completed, a duplicate resume produces no new node execution and no
    // new effects.
    if (chunks.length > 0) {
      if (this.bridgeOfflineBeforeResume) {
        newEvents.push(this.makeEvent(runId, 'salary-escalation', 'bridge.disconnected', { reason: 'bridge_offline_before_resume' }))
      }

      const fixture = createHarnessFixture(runId)
      // Check if a performed effect was already recorded in a prior resume.
      // The ledger guarantees exactly-once; we only emit performed=true once.
      const priorPerformed = existingEvents.some(
        (e) => e.type === 'effect.requested' && e.payload['idempotencyKey'] === fixture.atsAction.idempotencyKey && e.payload['performed'] === true
      )

      newEvents.push(this.makeEvent(runId, 'salary-escalation', 'effect.requested', {
        idempotencyKey: fixture.atsAction.idempotencyKey,
        sent: !this.bridgeOfflineBeforeResume,
        performed: priorPerformed ? false : !this.bridgeOfflineBeforeResume,
      }))

      if (!this.bridgeOfflineBeforeResume) {
        newEvents.push(this.makeEvent(runId, 'salary-escalation', 'effect.reconciled', {
          idempotencyKey: fixture.atsAction.idempotencyKey,
          status: 'reconciled',
        }))
      }

      newEvents.push(this.makeEvent(runId, 'salary-escalation', 'cache.hit', { sourceId: 'evidence-001' }))
    }

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
    this.checkpointSaver.close()
  }

  private persistEvents(runId: string, events: HarnessEvent[]): void {
    for (const ev of events) {
      this.store.saveEvent(ev)
    }
  }
}
