import { describe, expect, it } from 'vitest'
import * as infrastructure from '@career/infrastructure'

const {
  CAREER_TOOLS,
  createToolHandlers,
  executeToolCalls,
  isReadOnlyTool,
  isDraftOnlyTool,
  isSideEffectFreeTool,
} = infrastructure as Record<string, unknown>

const tools = CAREER_TOOLS as readonly {
  name: string
  description: string
  parameters: readonly { name: string; type: string; description: string; required: boolean }[]
}[]

const sampleContext = {
  jobs: [
    {
      id: 'job-1',
      title: 'AI 产品实习生',
      company: '星河科技',
      location: '杭州',
      description: '负责 AI 产品调研与原型设计。',
      analysis: {},
    },
  ],
  applications: [
    { id: 'app-1', jobId: 'job-1', status: 'submitted', externalId: 'ext-001' },
    { id: 'app-2', jobId: 'job-1', status: 'draft' },
  ],
}

describe('career tool definitions', () => {
  it('defines exactly four tools with unique names', () => {
    const names = tools.map((t) => t.name)
    expect(names).toHaveLength(4)
    expect(new Set(names).size).toBe(4)
  })

  it('every tool has a non-empty description and at least one parameter', () => {
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(10)
      expect(tool.parameters.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('required parameters are marked as required', () => {
    for (const tool of tools) {
      const required = tool.parameters.filter((p) => p.required)
      expect(required.length).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('tool safety classification', () => {
  const isRO = isReadOnlyTool as (name: string) => boolean
  const isDraft = isDraftOnlyTool as (name: string) => boolean
  const isSafe = isSideEffectFreeTool as (name: string) => boolean

  it('classifies lookup_job_posting and check_application_status as read-only', () => {
    expect(isRO('lookup_job_posting')).toBe(true)
    expect(isRO('check_application_status')).toBe(true)
    expect(isRO('draft_hr_reply')).toBe(false)
    expect(isRO('request_submission')).toBe(false)
  })

  it('classifies draft_hr_reply and request_submission as draft-only', () => {
    expect(isDraft('draft_hr_reply')).toBe(true)
    expect(isDraft('request_submission')).toBe(true)
    expect(isDraft('lookup_job_posting')).toBe(false)
  })

  it('every tool is side-effect-free', () => {
    for (const tool of tools) {
      expect(isSafe(tool.name)).toBe(true)
    }
  })
})

describe('tool handlers', () => {
  const createHandlers = createToolHandlers as (ctx: typeof sampleContext) => Map<string, (args: Record<string, string>, ctx: typeof sampleContext) => Promise<unknown>>
  const handlers = createHandlers(sampleContext)

  it('lookup_job_posting returns job details for a known job', async () => {
    const handler = handlers.get('lookup_job_posting')!
    const result = await handler({ jobId: 'job-1' }, sampleContext) as { data: Record<string, unknown>; source: string }
    expect(result.data['found']).toBe(true)
    expect(result.data['title']).toBe('AI 产品实习生')
    expect(result.source).toBe('workspace.jobs')
  })

  it('lookup_job_posting returns not-found for an unknown job', async () => {
    const handler = handlers.get('lookup_job_posting')!
    const result = await handler({ jobId: 'unknown' }, sampleContext) as { data: Record<string, unknown> }
    expect(result.data['found']).toBe(false)
  })

  it('check_application_status returns status for a known application', async () => {
    const handler = handlers.get('check_application_status')!
    const result = await handler({ applicationId: 'app-1' }, sampleContext) as { data: Record<string, unknown>; source: string }
    expect(result.data['found']).toBe(true)
    expect(result.data['status']).toBe('submitted')
    expect(result.data['externalId']).toBe('ext-001')
    expect(result.source).toBe('workspace.applications')
  })

  it('draft_hr_reply returns a draft with red risk, never sends', async () => {
    const handler = handlers.get('draft_hr_reply')!
    const result = await handler({ message: '请问你的期望薪资？' }, sampleContext) as { data: Record<string, unknown> }
    expect(result.data['risk']).toBe('red')
    expect(result.data['note']).toContain('需用户审批')
  })

  it('request_submission returns awaiting_approval, never submits directly', async () => {
    const handler = handlers.get('request_submission')!
    const result = await handler({ jobId: 'job-1', resumeVersionId: 'res-1' }, sampleContext) as { data: Record<string, unknown> }
    expect(result.data['status']).toBe('awaiting_approval')
    expect(result.data['jobTitle']).toBe('AI 产品实习生')
  })

  it('request_submission rejects when job does not exist', async () => {
    const handler = handlers.get('request_submission')!
    const result = await handler({ jobId: 'nope', resumeVersionId: 'res-1' }, sampleContext) as { data: Record<string, unknown> }
    expect(result.data['status']).toBe('rejected')
  })
})

describe('executeToolCalls', () => {
  const exec = executeToolCalls as (calls: readonly { name: string; arguments: Record<string, string> }[], ctx: typeof sampleContext) => Promise<unknown[]>

  it('executes multiple tool calls in order', async () => {
    const results = await exec(
      [
        { name: 'lookup_job_posting', arguments: { jobId: 'job-1' } },
        { name: 'check_application_status', arguments: { applicationId: 'app-2' } },
      ],
      sampleContext,
    ) as Array<{ name: string; data: Record<string, unknown> }>
    expect(results).toHaveLength(2)
    expect(results[0]!.name).toBe('lookup_job_posting')
    expect(results[0]!.data['found']).toBe(true)
    expect(results[1]!.name).toBe('check_application_status')
    expect(results[1]!.data['status']).toBe('draft')
  })

  it('returns an error result for unknown tool names', async () => {
    const results = await exec(
      [{ name: 'nonexistent_tool', arguments: {} }],
      sampleContext,
    ) as Array<{ name: string; data: Record<string, unknown> }>
    expect(results).toHaveLength(1)
    expect(results[0]!.data['error']).toContain('未知工具')
  })

  it('every result includes a source and timestamp', async () => {
    const results = await exec(
      [{ name: 'lookup_job_posting', arguments: { jobId: 'job-1' } }],
      sampleContext,
    ) as Array<{ source: string; timestamp: string }>
    expect(results[0]!.source).toBeTruthy()
    expect(results[0]!.timestamp).toBeTruthy()
  })
})
