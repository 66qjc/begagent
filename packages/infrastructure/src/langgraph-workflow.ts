import { StateGraph, Annotation, START, END, interrupt, Command } from '@langchain/langgraph'
import type { WorkflowPort, WorkflowResult, WorkflowExecutor } from '@career/core'
import type { PursuitStage } from '@career/core'
import { SqliteCheckpointSaver } from './lg-sqlite-checkpoint.ts'

const WorkflowState = Annotation.Root({
  runId: Annotation<string>,
  stage: Annotation<string>,
  actionId: Annotation<string>,
  actionType: Annotation<string>,
})

/**
 * LangGraph.js implementation of WorkflowPort.
 *
 * Owns: workflow checkpoint persistence, interrupt/resume mechanics,
 * node scheduling. The graph state only stores the run id, current stage,
 * and the action id awaiting approval — never domain objects.
 *
 * Does NOT own: mission state, action intents, evidence, memory, or any
 * business data. Those live in SqliteCareerRepository.
 *
 * The executor callback (injected at construction) is called after resume
 * to perform the approved external side effect. This keeps channel access
 * in the orchestrator, not in the workflow.
 */
export class LangGraphWorkflowAdapter implements WorkflowPort {
  private checkpointer: SqliteCheckpointSaver
  private executor: WorkflowExecutor

  constructor(options: { dbPath: string; executor?: WorkflowExecutor }) {
    this.checkpointer = new SqliteCheckpointSaver(options.dbPath)
    this.executor = options.executor ?? (async () => {})
  }

  /**
   * Inject the real executor after construction. Needed because the orchestrator
   * owns completeApprovedAction, but the adapter must be constructed first so the
   * orchestrator can receive it as a workflow dependency.
   */
  setExecutor(executor: WorkflowExecutor): void {
    this.executor = executor
  }

  private buildGraph() {
    const executor = this.executor

    const approvalNode = async (state: typeof WorkflowState.State) => {
      const approved = interrupt('awaiting_approval') as boolean
      if (approved) {
        await executor(state.actionId)
      }
      return { stage: state.stage }
    }

    return new StateGraph(WorkflowState)
      .addNode('approval_gate', approvalNode)
      .addEdge(START, 'approval_gate')
      .addEdge('approval_gate', END)
      .compile({ checkpointer: this.checkpointer })
  }

  async runMission(input: {
    runId: string
    stage: PursuitStage
    command: { kind: 'request_application' } | { kind: 'simulate_hr'; input: { kind: 'salary_question' } }
    actionId: string
  }): Promise<WorkflowResult> {
    const graph = this.buildGraph()
    const config = { configurable: { thread_id: input.runId } }
    const actionType = input.command.kind === 'request_application' ? 'submit_application' : 'send_hr_reply'

    const stream = await graph.stream(
      { runId: input.runId, stage: input.stage, actionId: input.actionId, actionType },
      { ...config, streamMode: 'updates' }
    )
    const chunks: Record<string, unknown>[] = []
    for await (const chunk of stream) {
      chunks.push(chunk as Record<string, unknown>)
    }

    const hasInterrupt = chunks.some((c) => '__interrupt__' in c)
    if (hasInterrupt) {
      return {
        stage: input.stage,
        status: 'suspended',
        suspendedReason: 'awaiting_approval',
      }
    }
    return { stage: input.stage, status: 'completed' }
  }

  async resumeMission(input: {
    runId: string
    approved: boolean
    actionId: string
  }): Promise<WorkflowResult> {
    const graph = this.buildGraph()
    const config = { configurable: { thread_id: input.runId } }

    const stream = await graph.stream(
      new Command({ resume: input.approved }),
      { ...config, streamMode: 'updates' }
    )
    for await (const _chunk of stream) {
      // Consume stream — executor is called inside the node on resume
    }

    // Read final state to determine completed stage
    const finalState = await graph.getState(config)
    const stage = (finalState.values?.['stage'] as string | undefined) ?? 'unknown'

    return { stage: stage as PursuitStage, status: 'completed' }
  }

  async recoverMission(runId: string): Promise<WorkflowResult | null> {
    const graph = this.buildGraph()
    const config = { configurable: { thread_id: runId } }
    const state = await graph.getState(config)
    if (!state || !state.values) return null
    const stage = (state.values['stage'] as string | undefined) ?? 'unknown'
    const isInterrupted = state.next.length > 0
    if (isInterrupted) {
      return { stage: stage as PursuitStage, status: 'suspended', suspendedReason: 'awaiting_approval' }
    }
    return { stage: stage as PursuitStage, status: 'completed' }
  }

  async close(): Promise<void> {
    this.checkpointer.close()
  }
}
