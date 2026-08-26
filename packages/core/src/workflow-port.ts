import type { PursuitStage } from './model.ts'

/**
 * Commands that the orchestrator delegates to a durable workflow runtime.
 * Only approval-gated commands flow through the workflow port; the rest
 * of the golden loop is handled directly by the orchestrator.
 */
export type WorkflowCommand =
  | { kind: 'request_application' }
  | { kind: 'simulate_hr'; input: { kind: 'salary_question' } }

export interface WorkflowResult {
  stage: PursuitStage
  status: 'completed' | 'suspended' | 'failed'
  /** Action id that the workflow is waiting on, when suspended. */
  suspendedActionId?: string
  /** Human-readable reason for suspension. */
  suspendedReason?: string
}

/**
 * Abstraction over a durable workflow engine (LangGraph.js in production).
 * The orchestrator uses this port to suspend execution at approval gates
 * and resume after the user decides. The implementation owns checkpoint
 * persistence and interrupt/resume mechanics; it must NOT own domain state.
 *
 * `packages/core` does not import any workflow framework — this interface
 * is implemented in `packages/infrastructure`.
 */
export interface WorkflowPort {
  /**
   * Start or advance a workflow run to the next approval gate (or completion).
   * Returns `suspended` when the workflow pauses at an approval gate.
   * The `actionId` is the id of the action intent the workflow is gating on;
   * it is stored in the checkpoint and passed to the executor on resume.
   */
  runMission(input: {
    runId: string
    stage: PursuitStage
    command: WorkflowCommand
    actionId: string
  }): Promise<WorkflowResult>

  /**
   * Resume a suspended workflow after the user approves or rejects the action.
   * The executor callback is invoked for approved external side effects.
   */
  resumeMission(input: {
    runId: string
    approved: boolean
    actionId: string
  }): Promise<WorkflowResult>

  /**
   * Recover a workflow run after process restart. Returns `null` if the run
   * is not found in the checkpoint store.
   */
  recoverMission(runId: string): Promise<WorkflowResult | null>

  /** Release resources (close DB connections, etc.). */
  close(): Promise<void>
}

/**
 * Callback the workflow invokes when an approved action needs external execution.
 * The orchestrator injects this so the workflow never touches channels directly.
 * Returns void — the executor persists results through the repository, not via
 * a return value.
 */
export type WorkflowExecutor = (actionId: string) => Promise<void>
