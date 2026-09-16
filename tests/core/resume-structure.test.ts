import { describe, expect, it } from 'vitest'
import { DeterministicCareerRuntime } from '@career/infrastructure'

const runtime = new DeterministicCareerRuntime()

const sampleInput = {
  evidenceTitle: 'Agent 产品证据冲刺',
  evidenceSummary: '完成多 Agent 协作与审批恢复闭环',
  jobTitle: 'AI 产品实习生',
  jobDescription: '负责 AI 产品调研、用户研究与交互原型设计。',
  jobGaps: ['缺少 AI Agent 产品成果'],
  memories: [
    { layer: 'user', title: '教育背景', content: '数字媒体技术本科' },
    { layer: 'evidence', title: '项目经历', content: '完成校园服务产品调研' },
  ],
}

describe('DeterministicCareerRuntime structured resume output', () => {
  const result = runtime.updateResume(sampleInput)

  it('returns a headline and summary that match the job title', async () => {
    const resume = await result
    expect(resume.headline).toContain('AI 产品实习生')
    expect(resume.summary.length).toBeGreaterThan(20)
  })

  it('produces at least two structured experience sections', async () => {
    const resume = await result
    expect(resume.sections.length).toBeGreaterThanOrEqual(2)
  })

  it('every section has a title and at least one bullet', async () => {
    const resume = await result
    for (const section of resume.sections) {
      expect(section.title.length).toBeGreaterThan(0)
      expect(section.bullets.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('every bullet has a verbTier from the allowed set', async () => {
    const resume = await result
    const allowed = ['支持', '协助', '参与', '负责', '推动', '主导']
    for (const section of resume.sections) {
      for (const bullet of section.bullets) {
        expect(allowed).toContain(bullet.verbTier)
      }
    }
  })

  it('every bullet text uses the bold lead-in format (**概括：** detail)', async () => {
    const resume = await result
    for (const section of resume.sections) {
      for (const bullet of section.bullets) {
        expect(bullet.text).toMatch(/\*\*.+?[：:]\*\*/)
      }
    }
  })

  it('at least one bullet carries quantified metrics', async () => {
    const resume = await result
    const hasMetrics = resume.sections.some((s) =>
      s.bullets.some((b) => b.metrics !== undefined && b.metrics.length > 0),
    )
    expect(hasMetrics).toBe(true)
  })

  it('metrics have a value and dimension when present', async () => {
    const resume = await result
    for (const section of resume.sections) {
      for (const bullet of section.bullets) {
        if (bullet.metrics) {
          for (const metric of bullet.metrics) {
            expect(metric.value.length).toBeGreaterThan(0)
            expect(metric.dimension.length).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('produces at least one skill group with keywords', async () => {
    const resume = await result
    expect(resume.skills.length).toBeGreaterThanOrEqual(1)
    for (const group of resume.skills) {
      expect(group.name.length).toBeGreaterThan(0)
      expect(group.keywords.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('skills cover AI/product/method dimensions for an AI product role', async () => {
    const resume = await result
    const skillNames = resume.skills.map((s) => s.name)
    expect(skillNames.some((n) => n.includes('AI') || n.includes('LLM'))).toBe(true)
  })
})
