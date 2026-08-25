import type { ActionRisk, AnalyzeJobRequest } from '@career/contracts'
import type { ActionPolicyInput, PolicyDecision, WorkspaceState } from './model.ts'

export type ActionPolicyEvaluator = (input: ActionPolicyInput) => PolicyDecision

export interface CareerRepository {
  transaction<T>(work: (draft: WorkspaceState) => T): Promise<T>
  snapshot(): Promise<WorkspaceState>
  /** Returns true when the underlying store is reachable and readable. */
  healthCheck(): Promise<boolean>
}

export interface CareerRuntimePort {
  analyzeJob(input: AnalyzeJobRequest): Promise<{
    recommendation: string
    summary: string
    gaps: string[]
    evidenceStrength: string
  }>
  planEvidenceSprint(): Promise<{ title: string; objective: string }>
  updateResume(input: { evidenceTitle: string; evidenceSummary: string }): Promise<{
    headline: string
    summary: string
    claims: string[]
  }>
  draftHrReply(input: { message: string }): Promise<{ content: string; risk: Extract<ActionRisk, 'red'> }>
  close?(): Promise<void>
}

export interface ExternalChannelPort {
  submitApplication(input: {
    missionId: string
    idempotencyKey: string
    jobId: string
    resumeVersionId: string
  }): Promise<{ externalId: string }>
  sendHrReply(input: {
    missionId: string
    idempotencyKey: string
    content: string
  }): Promise<{ externalId: string }>
}

export interface Clock {
  now(): string
}

export interface IdGenerator {
  next(): string
}
