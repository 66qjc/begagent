import { createHash } from 'node:crypto'
import type {
  HarnessFixture,
  FixturePursuit,
  FixtureTask,
  FixtureEvidence,
  FixtureAtsAction,
  FixtureBridgeEvent,
} from './contracts.ts'

const MISSION_ID = 'mission-001'

function hashContent(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

function buildTasks(pursuitId: string): FixtureTask[] {
  if (pursuitId === 'pursuit-direct') {
    return [
      {
        id: 'company-research',
        pursuitId,
        kind: 'company_research',
        responsibleActor: 'job-execution-agent',
        inEnvelope: true,
      },
      {
        id: 'salary-escalation',
        pursuitId,
        kind: 'salary_escalation',
        responsibleActor: 'job-execution-agent',
        inEnvelope: false,
      },
    ]
  }
  return [
    {
      id: 'materials-review',
      pursuitId,
      kind: 'materials_review',
      responsibleActor: 'resume-advantage-agent',
      inEnvelope: true,
    },
  ]
}

export function createHarnessFixture(runId: string): HarnessFixture {
  const pursuits: FixturePursuit[] = [
    {
      id: 'pursuit-direct',
      missionId: MISSION_ID,
      opportunityTitle: 'Backend Engineer at TechCorp',
      tasks: buildTasks('pursuit-direct'),
    },
    {
      id: 'pursuit-growth',
      missionId: MISSION_ID,
      opportunityTitle: 'Full-stack Developer at DataStart',
      tasks: buildTasks('pursuit-growth'),
    },
  ]

  const evidence: FixtureEvidence = {
    id: 'evidence-001',
    contentHash: hashContent(`evidence-001:${runId}`),
    lifecycleStatus: 'confirmed',
  }

  const atsAction: FixtureAtsAction = {
    actionType: 'application_submit',
    pursuitId: 'pursuit-direct',
    idempotencyKey: 'application:pursuit-direct:v1',
    requestHash: hashContent(`ats:pursuit-direct:v1:${runId}`),
  }

  const bridgeEvents: FixtureBridgeEvent[] = [
    { type: 'bridge.disconnected', occurredAt: '2026-08-25T12:00:00Z' },
    { type: 'bridge.reconnected', occurredAt: '2026-08-25T12:00:05Z' },
  ]

  return {
    runId,
    missionId: MISSION_ID,
    pursuits,
    evidence,
    atsAction,
    bridgeEvents,
  }
}
