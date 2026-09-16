import { describe, expect, it } from 'vitest'
import * as core from '@career/core'

interface WorkspaceLike {
  mission: { id: string; status: string; ownerAgent: string; version: number } | null
  pursuits: Array<{ id: string; stage: string; route: string; version: number }>
  jobs: Array<{ id: string; pursuitId: string; title: string }>
  tasks: Array<{ pursuitId: string; ownerAgent: string; status: string; handoff?: { fromAgent: string; toAgent: string; memoryRefs: string[] } }>
  evidence: Array<{ id: string; pursuitId: string; source: string; status: string }>
  memories: Array<{ id: string; evidenceIds: string[]; status: string }>
  resumes: Array<{ pursuitId: string; version: number; evidenceIds: string[] }>
  actions: Array<{ id: string; pursuitId: string; type: string; risk: string; status: string; version: number }>
  applications: Array<{ pursuitId: string; status: string; externalId?: string }>
  hrMessages: Array<{ pursuitId: string; direction: string; content: string }>
  events: Array<{ seq: number; type: string }>
}

interface OrchestratorLike {
  resetDemo(): Promise<WorkspaceLike>
  getWorkspace(): Promise<WorkspaceLike>
  analyzeJob(input: { title: string; company: string; location: string; description: string; pursuitId?: string }): Promise<WorkspaceLike>
  chooseChallenge(pursuitId: string): Promise<WorkspaceLike>
  completeEvidenceSprint(pursuitId: string, input: { title: string; summary: string; proofUrl: string }): Promise<WorkspaceLike>
  requestApplication(pursuitId: string): Promise<WorkspaceLike>
  decideAction(input: { actionId: string; expectedVersion: number; decision: 'approve' | 'reject' }): Promise<WorkspaceLike>
  simulateHrMessage(pursuitId: string, input: { kind: 'salary_question' }): Promise<WorkspaceLike>
}

function orchestrator(): { service: OrchestratorLike; submitted: string[]; sentReplies: string[] } {
  const state = { current: undefined as WorkspaceLike | undefined }
  const repository = {
    async transaction<T>(work: (draft: WorkspaceLike) => Promise<T> | T): Promise<T> {
      const draft = structuredClone(state.current ?? {
        mission: null,
        pursuits: [],
        jobs: [],
        tasks: [],
        evidence: [],
        memories: [],
        resumes: [],
        actions: [],
        applications: [],
        hrMessages: [],
        events: [],
      })
      const result = await work(draft)
      state.current = draft
      return result
    },
    async snapshot(): Promise<WorkspaceLike> {
      return structuredClone(state.current!)
    },
    async healthCheck(): Promise<boolean> {
      return true
    },
  }
  const runtime = {
    async analyzeJob() {
      return {
        recommendation: 'growth_application',
        summary: '岗位值得挑战，产品证据不足但可在短期补齐。',
        gaps: ['缺少可验证的 AI 产品方案'],
        evidenceStrength: 'medium',
      }
    },
    async planEvidenceSprint() {
      return { title: 'AI 求职工作台方案', objective: '形成可演示且可解释的产品证据' }
    },
    async updateResume() {
      return {
        headline: 'AI 产品实习生｜Agent 工作流与用户研究',
        summary: '围绕大学生求职场景设计可恢复的多 Agent 执行闭环。',
        sections: [{
          title: 'Agent 产品证据冲刺',
          role: '产品负责人',
          bullets: [{ text: '**方案设计：**完成求职 Agent 状态流与证据约束方案', verbTier: '负责', evidenceIds: [] }],
        }],
        skills: [{ name: '产品方法论', keywords: ['用户研究', '原型设计'] }],
      }
    },
    async draftHrReply() {
      return { content: '您好，我期望的实习薪资需要结合工作职责进一步确认。', risk: 'red' as const }
    },
  }
  const submitted: string[] = []
  const sentReplies: string[] = []
  const channels = {
    async submitApplication(input: { idempotencyKey: string }) {
      submitted.push(input.idempotencyKey)
      return { externalId: 'mock-ats-001' }
    },
    async sendHrReply(input: { content: string }) {
      sentReplies.push(input.content)
      return { externalId: 'mock-hr-001' }
    },
  }
  const constructor = (core as Record<string, unknown>).CareerOrchestrator
  expect(constructor, 'CareerOrchestrator must be exported').toBeTypeOf('function')
  const service = new (constructor as new (dependencies: unknown) => OrchestratorLike)({
    repository,
    runtime,
    channels,
    clock: { now: () => '2026-08-24T01:00:00.000Z' },
    ids: { next: (() => { let value = 0; return () => `id-${++value}` })() },
  })
  return { service, submitted, sentReplies }
}

const jd = {
  title: 'AI 产品实习生',
  company: '星河科技',
  location: '杭州',
  description: '负责 AI Agent 产品需求分析、用户研究、原型设计和效果评估，要求能够将真实用户问题拆解为可执行工作流，并使用数据和作品证明判断。'.repeat(2),
}

describe('CareerOrchestrator golden loop', () => {
  it('enforces single ownership, evidence provenance and approval-gated external actions', async () => {
    const { service, submitted, sentReplies } = orchestrator()

    let workspace = await service.resetDemo()
    expect(workspace.mission).toMatchObject({ status: 'active', ownerAgent: 'job_execution' })
    expect(workspace.pursuits).toHaveLength(1)
    expect(workspace.pursuits[0]).toMatchObject({ stage: 'discovered', route: 'direct' })
    const pursuitId = workspace.pursuits[0]!.id

    workspace = await service.analyzeJob(jd)
    expect(workspace.pursuits[0]).toMatchObject({ stage: 'qualified', route: 'direct' })

    workspace = await service.chooseChallenge(pursuitId)
    expect(workspace.pursuits[0]).toMatchObject({ stage: 'evidence_sprint', route: 'growth' })
    expect(workspace.tasks.at(-1)?.handoff).toMatchObject({
      fromAgent: 'job_execution',
      toAgent: 'interview_growth',
    })

    workspace = await service.completeEvidenceSprint(pursuitId, {
      title: '大学生求职 Agent 产品方案',
      summary: '完成用户问题、状态流、审批节点与恢复机制设计。',
      proofUrl: 'local://portfolio/career-agent',
    })
    expect(workspace.pursuits[0]).toMatchObject({ stage: 'materials_ready' })
    expect(workspace.evidence).toHaveLength(1)
    expect(workspace.memories.some((item) => item.evidenceIds.includes(workspace.evidence[0]!.id))).toBe(true)
    expect(workspace.resumes[0]?.evidenceIds).toEqual([workspace.evidence[0]!.id])

    workspace = await service.requestApplication(pursuitId)
    const applicationAction = workspace.actions.at(-1)!
    expect(applicationAction).toMatchObject({
      type: 'submit_application',
      risk: 'yellow',
      status: 'awaiting_approval',
    })
    expect(submitted).toHaveLength(0)

    workspace = await service.decideAction({
      actionId: applicationAction.id,
      expectedVersion: applicationAction.version,
      decision: 'approve',
    })
    expect(workspace.pursuits[0]?.stage).toBe('application_submitted')
    expect(workspace.applications[0]).toMatchObject({ status: 'submitted', externalId: 'mock-ats-001' })
    expect(submitted).toHaveLength(1)

    workspace = await service.simulateHrMessage(pursuitId, { kind: 'salary_question' })
    const replyAction = workspace.actions.at(-1)!
    expect(workspace.pursuits[0]?.stage).toBe('hr_active')
    expect(replyAction).toMatchObject({ type: 'send_hr_reply', risk: 'red', status: 'awaiting_approval' })
    expect(sentReplies).toHaveLength(0)

    workspace = await service.decideAction({
      actionId: replyAction.id,
      expectedVersion: replyAction.version,
      decision: 'approve',
    })
    expect(sentReplies).toHaveLength(1)
    expect(workspace.hrMessages.filter((message) => message.direction === 'outbound')).toHaveLength(1)
    expect(workspace.events.map((event) => event.seq)).toEqual(
      workspace.events.map((_, index) => index + 1),
    )
  })

  it('rejects stale or repeated approval decisions', async () => {
    const { service } = orchestrator()
    await service.resetDemo()
    const ws0 = await service.getWorkspace()
    const pursuitId = ws0.pursuits[0]!.id
    await service.analyzeJob(jd)
    await service.chooseChallenge(pursuitId)
    await service.completeEvidenceSprint(pursuitId, {
      title: '大学生求职 Agent 产品方案',
      summary: '完成用户问题、状态流、审批节点与恢复机制设计。',
      proofUrl: 'local://portfolio/career-agent',
    })
    const workspace = await service.requestApplication(pursuitId)
    const action = workspace.actions.at(-1)!
    await service.decideAction({ actionId: action.id, expectedVersion: action.version, decision: 'approve' })

    await expect(service.decideAction({
      actionId: action.id,
      expectedVersion: action.version,
      decision: 'approve',
    })).rejects.toThrow(/stale|already decided/i)
  })
})
