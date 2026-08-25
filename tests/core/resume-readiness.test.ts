import { describe, expect, it } from 'vitest'
import { evaluateResumeReadiness } from '@career/core'
import type { DocumentVerification, ResumeDraft, ResumeReview } from '@career/contracts'

const draft: ResumeDraft = {
  targetJobId: 'job-1',
  sourceProfileVersion: 1,
  headline: 'AI 产品实习生',
  summary: '围绕真实用户问题设计可执行的 Agent 工作流。',
  claims: [{
    text: '完成求职 Agent 状态流、审批节点与恢复机制设计',
    evidenceIds: ['evidence-1'],
  }],
}

const review: ResumeReview = {
  reviewerRunId: 'review-1',
  verdict: 'approved',
  groundingStatus: 'passed',
  findings: [],
  proposedEdits: [],
}

const verification: DocumentVerification = {
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

function evaluate(overrides: {
  draft?: ResumeDraft
  review?: ResumeReview
  verification?: DocumentVerification
} = {}) {
  return evaluateResumeReadiness({
    draft: overrides.draft ?? draft,
    review: overrides.review ?? review,
    verification: overrides.verification ?? verification,
  })
}

describe('resume application readiness', () => {
  it('allows an evidence-grounded, approved and fully verified resume', () => {
    expect(evaluate()).toEqual({ ready: true, blockers: [] })
  })

  it('blocks a review that requires changes or failed grounding', () => {
    const result = evaluate({
      review: {
        ...review,
        verdict: 'changes_required',
        groundingStatus: 'failed',
        findings: [{
          category: 'grounding',
          severity: 'blocking',
          message: '一条成果没有证据来源',
          claimIndex: 0,
          evidenceIds: [],
        }],
      },
    })

    expect(result.ready).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'review_changes_required',
      'grounding_failed',
      'review_has_blocking_findings',
    ]))
  })

  it('blocks reviewer references to a claim outside the reviewed draft', () => {
    const result = evaluate({
      review: {
        ...review,
        verdict: 'changes_required',
        findings: [{
          category: 'style',
          severity: 'warning',
          message: '引用了不存在的简历表述',
          claimIndex: 3,
          evidenceIds: [],
        }],
      },
    })

    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('review_claim_out_of_range:3')
  })

  it('blocks any mandatory document check that did not pass', () => {
    const result = evaluate({
      verification: { ...verification, textLayerStatus: 'failed' },
    })

    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('text_layer_not_passed')
  })

  it('blocks a supported keyword that the resume omitted', () => {
    const result = evaluate({
      verification: {
        ...verification,
        keywordCoverage: [{
          keyword: '需求分析',
          priority: 'required',
          status: 'missing_but_supported',
          note: '证据库已有能力，但简历没有表达',
        }],
      },
    })

    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('keyword_missing_but_supported:需求分析')
  })

  it('keeps an honest real gap visible without blocking readiness', () => {
    const result = evaluate({
      verification: {
        ...verification,
        keywordCoverage: [{
          keyword: '企业级 MLOps',
          priority: 'preferred',
          status: 'missing_real_gap',
          note: '候选人目前没有对应经历',
        }],
      },
    })

    expect(result).toEqual({ ready: true, blockers: [] })
  })

  it('blocks a degraded verification even when the skipped check is explicit', () => {
    const result = evaluate({
      verification: {
        ...verification,
        visualStatus: 'not_run',
        degradedReasons: ['浏览器渲染器不可用'],
      },
    })

    expect(result.ready).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'visual_not_passed',
      'verification_degraded',
    ]))
  })
})
