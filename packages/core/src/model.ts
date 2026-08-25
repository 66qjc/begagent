import type { ActionRisk, AgentKind } from '@career/contracts'

export const MISSION_STAGES = [
  'profile_ready',
  'job_analyzed',
  'challenge_selected',
  'evidence_sprint',
  'resume_updated',
  'application_awaiting_approval',
  'application_submitted',
  'hr_active',
  'completed',
] as const

export type MissionStage = (typeof MISSION_STAGES)[number]

export interface ActionPolicyInput {
  risk: ActionRisk
  actionType: string
  authorizedActionTypes: readonly string[]
}

export interface PolicyDecision {
  outcome: 'execute' | 'awaiting_approval' | 'forbidden'
  reason: string
  ruleId?: string
}

export interface TaskOwner {
  agent: AgentKind
  reason: string
}

export type TaskStatus = 'active' | 'awaiting_approval' | 'completed' | 'failed'
export type ActionStatus = 'awaiting_approval' | 'executing' | 'executed' | 'rejected' | 'failed'

export interface CareerMission {
  id: string
  name: string
  targetRole: string
  stage: MissionStage
  ownerAgent: AgentKind
  version: number
  createdAt: string
  updatedAt: string
}

export interface AgentHandoff {
  id: string
  fromAgent: AgentKind
  toAgent: AgentKind
  objective: string
  memoryRefs: string[]
  permissions: string[]
  expectedArtifact: string
  createdAt: string
}

export interface CareerTask {
  id: string
  missionId: string
  title: string
  ownerAgent: AgentKind
  status: TaskStatus
  createdAt: string
  completedAt?: string
  handoff?: AgentHandoff
}

export interface JobAnalysis {
  recommendation: string
  summary: string
  gaps: string[]
  evidenceStrength: string
}

export interface JobOpportunity {
  id: string
  missionId: string
  title: string
  company: string
  location: string
  description: string
  analysis: JobAnalysis
  createdAt: string
}

export interface MemoryItem {
  id: string
  missionId: string
  layer: 'user' | 'evidence' | 'mission' | 'job' | 'working'
  title: string
  content: string
  status: 'confirmed' | 'derived' | 'pending_confirmation'
  source: string
  evidenceIds: string[]
  readableBy: AgentKind[]
  createdAt: string
}

export interface EvidenceItem {
  id: string
  missionId: string
  title: string
  summary: string
  proofUrl: string
  source: string
  status: 'confirmed'
  createdAt: string
}

export interface ResumeVersion {
  id: string
  missionId: string
  version: number
  headline: string
  summary: string
  claims: string[]
  evidenceIds: string[]
  createdAt: string
}

export interface ActionIntent {
  id: string
  missionId: string
  type: 'submit_application' | 'send_hr_reply'
  risk: ActionRisk
  status: ActionStatus
  reason: string
  payload: Record<string, unknown>
  idempotencyKey: string
  version: number
  createdAt: string
  decidedAt?: string
}

export interface ApplicationRecord {
  id: string
  missionId: string
  jobId: string
  resumeVersionId: string
  status: 'draft' | 'submitted'
  actionIntentId: string
  externalId?: string
  createdAt: string
  submittedAt?: string
}

export interface HrMessage {
  id: string
  missionId: string
  direction: 'inbound' | 'outbound'
  content: string
  risk: ActionRisk
  createdAt: string
  externalId?: string
}

export interface DomainEvent {
  id: string
  seq: number
  missionId: string
  type: string
  actor: AgentKind | 'system' | 'user'
  summary: string
  data: Record<string, unknown>
  createdAt: string
}

export interface WorkspaceState {
  mission: CareerMission | null
  jobs: JobOpportunity[]
  tasks: CareerTask[]
  memories: MemoryItem[]
  evidence: EvidenceItem[]
  resumes: ResumeVersion[]
  actions: ActionIntent[]
  applications: ApplicationRecord[]
  hrMessages: HrMessage[]
  events: DomainEvent[]
}

export function createEmptyWorkspaceState(): WorkspaceState {
  return {
    mission: null,
    jobs: [],
    tasks: [],
    memories: [],
    evidence: [],
    resumes: [],
    actions: [],
    applications: [],
    hrMessages: [],
    events: [],
  }
}
