export type CandidateId = 'langgraph' | 'mastra'

export type HarnessEventType =
  | 'node.started'
  | 'node.completed'
  | 'run.suspended'
  | 'run.resumed'
  | 'effect.requested'
  | 'effect.reconciled'
  | 'bridge.disconnected'
  | 'bridge.reconnected'
  | 'cache.hit'
  | 'cache.invalidated'
  | 'run.completed'

export interface HarnessEvent {
  sequence: number
  runId: string
  candidate: CandidateId
  pursuitId: string | null
  taskId: string
  type: HarnessEventType
  occurredAt: string
  payload: Record<string, unknown>
}

export interface HarnessRunResult {
  runId: string
  status: 'suspended' | 'completed' | 'failed'
  suspendedReason?: 'salary_out_of_envelope' | 'bridge_disconnected'
  events: HarnessEvent[]
  domainSnapshotHash: string
}

export interface HarnessAdapter {
  readonly candidate: CandidateId
  start(runId: string): Promise<HarnessRunResult>
  resume(runId: string, input: { approved: boolean }): Promise<HarnessRunResult>
  recover(runId: string): Promise<HarnessRunResult>
  close(): Promise<void>
}

export type TaskKind =
  | 'company_research'
  | 'materials_review'
  | 'salary_escalation'

export interface FixtureTask {
  id: string
  pursuitId: string
  kind: TaskKind
  responsibleActor: string
  inEnvelope: boolean
}

export interface FixturePursuit {
  id: string
  missionId: string
  opportunityTitle: string
  tasks: FixtureTask[]
}

export interface FixtureEvidence {
  id: string
  contentHash: string
  lifecycleStatus: 'confirmed' | 'captured'
}

export interface FixtureAtsAction {
  actionType: 'application_submit'
  pursuitId: string
  idempotencyKey: string
  requestHash: string
}

export interface FixtureBridgeEvent {
  type: 'bridge.disconnected' | 'bridge.reconnected'
  occurredAt: string
}

export interface HarnessFixture {
  runId: string
  missionId: string
  pursuits: FixturePursuit[]
  evidence: FixtureEvidence
  atsAction: FixtureAtsAction
  bridgeEvents: FixtureBridgeEvent[]
}
