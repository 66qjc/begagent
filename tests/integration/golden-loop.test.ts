import { describe, expect, it } from 'vitest'
import { CareerOrchestrator } from '@career/core'
import * as infrastructure from '@career/infrastructure'

describe('keyless controlled golden loop', () => {
  it('produces every required career artifact without a model key', async () => {
    const Repository = (infrastructure as Record<string, unknown>).SqliteCareerRepository as new (path: string) => {
      close(): void
    }
    const Runtime = (infrastructure as Record<string, unknown>).DeterministicCareerRuntime as new () => unknown
    const Channels = (infrastructure as Record<string, unknown>).ControlledMockChannels as new () => unknown
    expect(Runtime, 'DeterministicCareerRuntime must be exported').toBeTypeOf('function')
    expect(Channels, 'ControlledMockChannels must be exported').toBeTypeOf('function')
    const repository = new Repository(':memory:')
    const orchestrator = new CareerOrchestrator({
      repository: repository as never,
      runtime: new Runtime() as never,
      channels: new Channels() as never,
      clock: { now: () => '2026-08-24T03:00:00.000Z' },
      ids: { next: (() => { let value = 0; return () => `golden-${++value}` })() },
    })

    await orchestrator.resetDemo()
    await orchestrator.analyzeJob({
      title: 'AI 产品实习生',
      company: '星河科技',
      location: '杭州',
      description: '负责 AI Agent 产品需求分析、用户研究、原型设计和效果评估，要求能够将真实用户问题拆解为可执行工作流，并使用数据和作品证明判断。'.repeat(2),
    })
    await orchestrator.chooseChallenge({ strategy: 'evidence_sprint' })
    await orchestrator.completeEvidenceSprint({
      title: '大学生求职执行 Agent',
      summary: '完成任务编排、证据约束、用户审批和中断恢复方案。',
      proofUrl: 'local://portfolio/career-agent',
    })
    let workspace = await orchestrator.requestApplication()
    const applicationAction = workspace.actions.at(-1)!
    workspace = await orchestrator.decideAction({
      actionId: applicationAction.id,
      expectedVersion: applicationAction.version,
      decision: 'approve',
    })
    workspace = await orchestrator.simulateHrMessage({ kind: 'salary_question' })
    const replyAction = workspace.actions.at(-1)!
    workspace = await orchestrator.decideAction({
      actionId: replyAction.id,
      expectedVersion: replyAction.version,
      decision: 'approve',
    })
    repository.close()

    expect(workspace.jobs).toHaveLength(1)
    expect(workspace.tasks.some((task) => task.handoff?.toAgent === 'interview_growth')).toBe(true)
    expect(workspace.evidence).toHaveLength(1)
    expect(workspace.resumes).toHaveLength(1)
    expect(workspace.applications[0]?.status).toBe('submitted')
    expect(workspace.hrMessages.map((message) => message.direction)).toEqual(['inbound', 'outbound'])
    expect(workspace.actions.every((action) => action.status === 'executed')).toBe(true)
    expect(workspace.events.length).toBeGreaterThanOrEqual(10)
  })
})
