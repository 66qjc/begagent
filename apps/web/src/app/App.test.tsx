// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyWorkspaceState, type WorkspaceState } from '@career/core'
import { App } from './App.tsx'
import type { CareerApi } from './api.ts'

function client(result: Promise<WorkspaceState>): CareerApi {
  const passthrough = async () => result
  return {
    getWorkspace: () => result,
    resetDemo: passthrough,
    analyzeJob: passthrough,
    chooseChallenge: passthrough,
    completeEvidence: passthrough,
    requestApplication: passthrough,
    decideAction: passthrough,
    simulateHr: passthrough,
    createPursuit: passthrough,
  }
}

function activeWorkspace(): WorkspaceState {
  const state = createEmptyWorkspaceState()
  state.mission = {
    id: 'mission-1',
    name: 'AI 产品实习求职计划',
    targetRole: 'AI 产品实习生',
    status: 'active',
    ownerAgent: 'interview_growth',
    version: 4,
    createdAt: '2026-08-24T01:00:00.000Z',
    updatedAt: '2026-08-24T01:10:00.000Z',
  }
  state.pursuits.push({
    id: 'pursuit-1',
    missionId: 'mission-1',
    jobId: 'job-1',
    stage: 'evidence_sprint',
    route: 'growth',
    version: 3,
    createdAt: '2026-08-24T01:00:00.000Z',
    updatedAt: '2026-08-24T01:10:00.000Z',
  })
  state.tasks.push({
    id: 'task-1',
    missionId: 'mission-1',
    pursuitId: 'pursuit-1',
    title: '完成大学生求职 Agent 产品证据冲刺',
    ownerAgent: 'interview_growth',
    status: 'active',
    createdAt: '2026-08-24T01:10:00.000Z',
  })
  state.events.push({
    id: 'event-1',
    seq: 1,
    missionId: 'mission-1',
    type: 'agent.handoff',
    actor: 'system',
    summary: '求职执行 Agent 将证据冲刺交接给面试成长 Agent',
    data: {},
    createdAt: '2026-08-24T01:10:00.000Z',
  })
  state.actions.push({
    id: 'action-1',
    missionId: 'mission-1',
    pursuitId: 'pursuit-1',
    type: 'send_hr_reply',
    risk: 'red',
    status: 'awaiting_approval',
    reason: '涉及薪资与到岗承诺',
    payload: { content: '需要确认后回复。' },
    idempotencyKey: 'intent-1',
    version: 1,
    createdAt: '2026-08-24T01:10:00.000Z',
  })
  return state
}

describe('Career command center', () => {
  afterEach(() => cleanup())

  it('shows a loading state while connecting', () => {
    render(<App client={client(new Promise(() => undefined))} />)
    expect(screen.getByLabelText('正在加载职业工作区')).toBeTruthy()
  })

  it('shows a useful empty state', async () => {
    render(<App client={client(Promise.resolve(createEmptyWorkspaceState()))} />)
    await waitFor(() => expect(screen.getByText('还没有正在执行的求职计划')).toBeTruthy())
    expect(screen.getByRole('button', { name: '载入黄金演示' })).toBeTruthy()
  })

  it('shows mission ownership, next task, trace and pending approval', async () => {
    render(<App client={client(Promise.resolve(activeWorkspace()))} />)
    await waitFor(() => expect(screen.getByText('AI 产品实习求职计划')).toBeTruthy())
    expect(screen.getByText('面试成长 主责')).toBeTruthy()
    expect(screen.getAllByText('完成大学生求职 Agent 产品证据冲刺').length).toBeGreaterThan(0)
    expect(screen.getByText('等待你的确认')).toBeTruthy()
    expect(screen.getByRole('button', { name: '批准并执行' })).toBeTruthy()
    expect(screen.getByText('求职执行 Agent 将证据冲刺交接给面试成长 Agent')).toBeTruthy()
  })

  it('switches between black and white presentation themes', async () => {
    render(<App client={client(Promise.resolve(activeWorkspace()))} />)
    await waitFor(() => expect(screen.getByText('AI 产品实习求职计划')).toBeTruthy())

    const toggle = screen.getByRole('button', { name: '切换为黑色主题' })
    expect(document.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('light')
    toggle.click()
    await waitFor(() => expect(document.querySelector('.app-shell')?.getAttribute('data-theme')).toBe('dark'))
    expect(screen.getByRole('button', { name: '切换为白色主题' })).toBeTruthy()
  })

  it('turns the sidebar into a concrete critical-step journey', async () => {
    const view = render(<App client={client(Promise.resolve(activeWorkspace()))} />)
    await waitFor(() => expect(within(view.container).getByText('AI 产品实习求职计划')).toBeTruthy())

    const journey = within(view.container).getByRole('list', { name: '求职关键步骤' })
    expect(within(journey).getByText('发现目标岗位')).toBeTruthy()
    expect(within(journey).getByText('选择推进方式')).toBeTruthy()
    expect(within(journey).getByText('补齐关键证据')).toBeTruthy()
    expect(within(journey).getByText('生成岗位简历')).toBeTruthy()
    expect(within(journey).getByText('确认并完成投递')).toBeTruthy()
    expect(within(journey).getByText('跟进 HR 沟通')).toBeTruthy()

    const activeStep = within(journey).getByText('补齐关键证据').closest('li')
    expect(activeStep?.getAttribute('aria-current')).toBe('step')
    expect(within(activeStep!).getByText('完成一项可验证成果')).toBeTruthy()
  })

  it('shows an actionable API error state', async () => {
    render(<App client={client(Promise.reject(new Error('offline')))} />)
    await waitFor(() => expect(screen.getByText('无法读取职业工作区')).toBeTruthy())
    expect(screen.getByRole('button', { name: '重新连接' })).toBeTruthy()
  })
})
