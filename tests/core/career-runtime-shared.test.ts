import { describe, expect, it } from 'vitest'
import * as infrastructure from '@career/infrastructure'

const {
  buildAnalyzeJobPrompt,
  buildEvidenceSprintPrompt,
  buildResumePrompt,
  buildHrReplyPrompt,
  validateArtifact,
  JobAnalysisSchema,
  HrReplySchema,
} = infrastructure as Record<string, unknown>

const jobInput = {
  title: 'AI 产品实习生',
  company: '星河科技',
  location: '杭州',
  description: '岗位描述'.repeat(40),
}

describe('shared career prompt builders', () => {
  it('buildAnalyzeJobPrompt embeds job input and returns a role-bearing system prompt', () => {
    const fn = buildAnalyzeJobPrompt as (input: typeof jobInput) => { system: string; prompt: string }
    const { system, prompt } = fn(jobInput)

    expect(system).toContain('求职执行 Agent')
    expect(system).toContain('gaps')
    expect(system).toContain('evidenceStrength')
    expect(prompt).toContain(JSON.stringify(jobInput))
  })

  it('buildEvidenceSprintPrompt returns a growth-agent system prompt', () => {
    const fn = buildEvidenceSprintPrompt as () => { system: string; prompt: string }
    const { system, prompt } = fn()

    expect(system).toContain('面试成长 Agent')
    expect(system).toContain('title')
    expect(system).toContain('objective')
    expect(prompt).toBeTruthy()
  })

  it('buildResumePrompt embeds job, evidence and memory context with STAR rules', () => {
    const fn = buildResumePrompt as (input: {
      evidenceTitle: string
      evidenceSummary: string
      jobTitle: string
      jobDescription: string
      jobGaps: string[]
      memories: ReadonlyArray<{ layer: string; title: string; content: string }>
    }) => { system: string; prompt: string }
    const input = {
      evidenceTitle: '测试证据',
      evidenceSummary: '完成证据约束方案',
      jobTitle: 'AI 产品实习生',
      jobDescription: '负责 AI 产品调研',
      jobGaps: ['缺少 Agent 产品成果'],
      memories: [{ layer: 'user', title: '教育背景', content: '数字媒体技术本科' }],
    }
    const { system, prompt } = fn(input)

    expect(system).toContain('优势简历 Agent')
    expect(system).toContain('sections')
    expect(system).toContain('skills')
    expect(system).toContain('动词分级')
    expect(system).toContain('主导')
    expect(system).toContain('反造假')
    expect(prompt).toContain(input.jobTitle)
    expect(prompt).toContain(input.evidenceTitle)
    expect(prompt).toContain(input.memories[0]!.title)
  })

  it('buildHrReplyPrompt embeds HR message input', () => {
    const fn = buildHrReplyPrompt as (input: { message: string }) => { system: string; prompt: string }
    const input = { message: '请问你的期望薪资？' }
    const { system, prompt } = fn(input)

    expect(system).toContain('求职执行 Agent')
    expect(system).toContain('red')
    expect(prompt).toContain(JSON.stringify(input))
  })
})

describe('validateArtifact', () => {
  const schema = JobAnalysisSchema as { safeParse(value: unknown): { success: boolean; data?: unknown; error?: { issues: { message: string }[] } } }
  const validate = validateArtifact as (artifact: string, text: string, schema: unknown) => unknown

  it('strips a JSON code fence and returns validated data', () => {
    const text = '```json\n{"recommendation":"growth_application","summary":"建议补齐证据","gaps":["缺少作品"],"evidenceStrength":"medium"}\n```'
    const result = validate('job analysis', text, schema) as Record<string, unknown>

    expect(result['recommendation']).toBe('growth_application')
    expect(result['gaps']).toEqual(['缺少作品'])
  })

  it('rejects missing fields with a validation error', () => {
    const text = '{"summary":"缺字段"}'
    expect(() => validate('job analysis', text, schema)).toThrow('job analysis output failed validation')
  })

  it('rejects non-JSON text', () => {
    expect(() => validate('job analysis', 'not json at all', schema)).toThrow('job analysis output was not valid JSON')
  })

  it('validates HR reply risk must be red', () => {
    const hrSchema = HrReplySchema as { safeParse(value: unknown): { success: boolean; data?: unknown; error?: { issues: { message: string }[] } } }
    expect(() => validate('HR reply', '{"content":"hi","risk":"green"}', hrSchema)).toThrow('failed validation')
    expect(() => validate('HR reply', '{"content":"hi","risk":"red"}', hrSchema)).not.toThrow()
  })
})
