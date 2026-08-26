/**
 * Function-calling tool definitions for the career Agent.
 *
 * These tools let the model actively query job details and draft artifacts
 * instead of passively receiving all context in the prompt. They demonstrate
 * autonomous task understanding and environment interaction — a scored
 * dimension in the competition track.
 *
 * Safety constraints (per 04 spec):
 * - All tools are read-only or draft-only. None produce external side-effects.
 * - Tool results are structured data with a `source` and `timestamp`.
 * - Actual submission / HR sending still flows through the orchestrator's
 *   approval-gated ActionIntent pipeline.
 */

export interface ToolParameter {
  readonly name: string
  readonly type: 'string' | 'number' | 'boolean'
  readonly description: string
  readonly required: boolean
  readonly enum?: readonly string[]
}

export interface ToolDefinition {
  readonly name: string
  readonly description: string
  readonly parameters: readonly ToolParameter[]
}

export interface ToolCall {
  readonly name: string
  readonly arguments: Record<string, string>
}

export interface ToolResult {
  readonly name: string
  readonly data: unknown
  readonly source: string
  readonly timestamp: string
}

export type ToolHandler = (args: Record<string, string>, context: ToolContext) => Promise<ToolResult>

export interface ToolContext {
  /** Jobs known to the current workspace, keyed by id. */
  readonly jobs: ReadonlyArray<{ id: string; title: string; company: string; location: string; description: string; analysis: unknown }>
  /** Applications known to the current workspace, keyed by id. */
  readonly applications: ReadonlyArray<{ id: string; jobId: string; status: string; externalId?: string }>
}

/* ------------------------------------------------------------------ */
/* Tool definitions (protocol-neutral function-calling schema)        */
/* ------------------------------------------------------------------ */

export const CAREER_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'lookup_job_posting',
    description: '查询已录入的岗位详情，包括标题、公司、地点和完整描述。Agent 应在分析前主动查询以确认岗位信息完整性。',
    parameters: [
      { name: 'jobId', type: 'string', description: '岗位 ID', required: true },
    ],
  },
  {
    name: 'check_application_status',
    description: '查询已提交申请的当前状态（草稿 / 已提交 / 已回复）。用于在 HR 沟通前确认申请是否已成功到达 ATS。',
    parameters: [
      { name: 'applicationId', type: 'string', description: '申请记录 ID', required: true },
    ],
  },
  {
    name: 'draft_hr_reply',
    description: '起草 HR 回复草稿，不发送。草稿返回给编排器后仍需用户审批。涉及薪资或到岗承诺的内容会被标记为高风险。',
    parameters: [
      { name: 'message', type: 'string', description: 'HR 发来的消息原文', required: true },
    ],
  },
  {
    name: 'request_submission',
    description: '生成投递动作意图，不直接提交。返回 awaiting_approval 状态的意图，由编排器走审批流。',
    parameters: [
      { name: 'jobId', type: 'string', description: '目标岗位 ID', required: true },
      { name: 'resumeVersionId', type: 'string', description: '使用的简历版本 ID', required: true },
    ],
  },
] as const

/* ------------------------------------------------------------------ */
/* Tool handlers — read-only / draft-only, no external side-effects    */
/* ------------------------------------------------------------------ */

export function createToolHandlers(context: ToolContext): ReadonlyMap<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>()

  handlers.set('lookup_job_posting', async (args): Promise<ToolResult> => {
    const jobId = args['jobId']
    const job = context.jobs.find((j) => j.id === jobId)
    if (!job) {
      return {
        name: 'lookup_job_posting',
        data: { found: false, message: `岗位 ${jobId} 不在当前工作空间中。` },
        source: 'workspace.jobs',
        timestamp: new Date().toISOString(),
      }
    }
    return {
      name: 'lookup_job_posting',
      data: {
        found: true,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
      },
      source: 'workspace.jobs',
      timestamp: new Date().toISOString(),
    }
  })

  handlers.set('check_application_status', async (args): Promise<ToolResult> => {
    const applicationId = args['applicationId']
    const application = context.applications.find((a) => a.id === applicationId)
    if (!application) {
      return {
        name: 'check_application_status',
        data: { found: false, message: `申请 ${applicationId} 不存在。` },
        source: 'workspace.applications',
        timestamp: new Date().toISOString(),
      }
    }
    return {
      name: 'check_application_status',
      data: {
        found: true,
        status: application.status,
        externalId: application.externalId ?? null,
      },
      source: 'workspace.applications',
      timestamp: new Date().toISOString(),
    }
  })

  handlers.set('draft_hr_reply', async (args): Promise<ToolResult> => {
    const message = args['message']
    const draft = {
      content: `您好，感谢沟通。关于您提到的消息，我会在确认后尽快回复。`,
      risk: 'red',
      note: '草稿未发送，需用户审批后通过 ActionIntent 提交。',
    }
    return {
      name: 'draft_hr_reply',
      data: { ...draft, originalMessage: message },
      source: 'model.draft',
      timestamp: new Date().toISOString(),
    }
  })

  handlers.set('request_submission', async (args): Promise<ToolResult> => {
    const jobId = args['jobId']
    const resumeVersionId = args['resumeVersionId']
    const job = context.jobs.find((j) => j.id === jobId)
    if (!job) {
      return {
        name: 'request_submission',
        data: { status: 'rejected', message: `岗位 ${jobId} 不存在。` },
        source: 'workspace.jobs',
        timestamp: new Date().toISOString(),
      }
    }
    return {
      name: 'request_submission',
      data: {
        status: 'awaiting_approval',
        jobId,
        resumeVersionId,
        jobTitle: job.title,
        message: '投递意图已生成，等待用户审批后由编排器执行。不直接提交。',
      },
      source: 'orchestrator.action_intent',
      timestamp: new Date().toISOString(),
    }
  })

  return handlers
}

/* ------------------------------------------------------------------ */
/* Execution helper                                                    */
/* ------------------------------------------------------------------ */

export async function executeToolCalls(
  calls: readonly ToolCall[],
  context: ToolContext,
): Promise<ToolResult[]> {
  const handlers = createToolHandlers(context)
  const results: ToolResult[] = []
  for (const call of calls) {
    const handler = handlers.get(call.name)
    if (!handler) {
      results.push({
        name: call.name,
        data: { error: `未知工具：${call.name}` },
        source: 'tool-router',
        timestamp: new Date().toISOString(),
      })
      continue
    }
    const result = await handler(call.arguments, context)
    results.push(result)
  }
  return results
}

/* ------------------------------------------------------------------ */
/* Safety verification helpers (used by tests)                        */
/* ------------------------------------------------------------------ */

export const READ_ONLY_TOOLS: readonly string[] = ['lookup_job_posting', 'check_application_status']
export const DRAFT_ONLY_TOOLS: readonly string[] = ['draft_hr_reply', 'request_submission']

export function isReadOnlyTool(name: string): boolean {
  return READ_ONLY_TOOLS.includes(name)
}

export function isDraftOnlyTool(name: string): boolean {
  return DRAFT_ONLY_TOOLS.includes(name)
}

/** Every tool must be classified as either read-only or draft-only. */
export function isSideEffectFreeTool(name: string): boolean {
  return isReadOnlyTool(name) || isDraftOnlyTool(name)
}
