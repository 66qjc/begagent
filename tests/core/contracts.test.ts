import { describe, expect, it } from 'vitest'
import * as contracts from '@career/contracts'

type SchemaLike = { safeParse(value: unknown): { success: boolean } }

function schema(name: string): SchemaLike {
  const value = (contracts as Record<string, unknown>)[name]
  expect(value, `${name} must be exported`).toBeDefined()
  return value as SchemaLike
}

describe('career platform contracts', () => {
  it('rejects an unsupported task owner', () => {
    const result = schema('AgentKindSchema').safeParse('memory-agent')
    expect(result.success).toBe(false)
  })

  it('rejects an unsupported action risk', () => {
    const result = schema('ActionRiskSchema').safeParse('sometimes-safe')
    expect(result.success).toBe(false)
  })

  it('rejects an incomplete JD analysis request', () => {
    const result = schema('AnalyzeJobRequestSchema').safeParse({ title: 'AI 产品实习生' })
    expect(result.success).toBe(false)
  })

  it('requires every resume claim to cite confirmed evidence', () => {
    const draft = {
      targetJobId: 'job-1',
      sourceProfileVersion: 1,
      headline: 'AI 产品实习生',
      summary: '围绕真实用户问题设计可执行的 Agent 工作流。',
      claims: [{ text: '完成求职 Agent 状态流与审批节点设计', evidenceIds: ['evidence-1'] }],
    }

    expect(schema('ResumeDraftSchema').safeParse(draft).success).toBe(true)
    expect(schema('ResumeDraftSchema').safeParse({
      ...draft,
      claims: [{ text: '没有来源的成果', evidenceIds: [] }],
    }).success).toBe(false)
  })

  it('rejects an approved review with failed grounding or unapplied edits', () => {
    const review = {
      reviewerRunId: 'review-1',
      verdict: 'approved',
      groundingStatus: 'passed',
      findings: [],
      proposedEdits: [],
    }

    expect(schema('ResumeReviewSchema').safeParse(review).success).toBe(true)
    expect(schema('ResumeReviewSchema').safeParse({ ...review, groundingStatus: 'failed' }).success).toBe(false)
    expect(schema('ResumeReviewSchema').safeParse({
      ...review,
      proposedEdits: [{
        claimIndex: 0,
        replacement: '更新后的证据化表述',
        reason: '补充事实来源',
        evidenceIds: ['evidence-1'],
      }],
    }).success).toBe(false)
  })

  it('requires an explicit degraded reason when a document check did not run', () => {
    const verification = {
      renderStatus: 'passed',
      visualStatus: 'passed',
      textLayerStatus: 'passed',
      requiredFieldsStatus: 'passed',
      keywordCoverage: [{
        keyword: '用户研究',
        priority: 'required',
        status: 'covered',
        note: '出现在项目经历中',
      }],
      degradedReasons: [],
    }

    expect(schema('DocumentVerificationSchema').safeParse(verification).success).toBe(true)
    expect(schema('DocumentVerificationSchema').safeParse({
      ...verification,
      textLayerStatus: 'not_run',
    }).success).toBe(false)
    expect(schema('DocumentVerificationSchema').safeParse({
      ...verification,
      textLayerStatus: 'not_run',
      degradedReasons: ['Poppler 不可用'],
    }).success).toBe(true)
  })
})
