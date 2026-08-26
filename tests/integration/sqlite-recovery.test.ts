import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CareerOrchestrator } from '@career/core'
import * as infrastructure from '@career/infrastructure'

const cleanup: string[] = []

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

function runtime() {
  return {
    analyzeJob: async () => ({
      recommendation: 'growth_application',
      summary: '建议补强后投递。',
      gaps: ['缺少 AI 产品证据'],
      evidenceStrength: 'medium',
    }),
    planEvidenceSprint: async () => ({ title: 'AI 产品证据冲刺', objective: '形成岗位证据' }),
    updateResume: async () => ({ headline: 'AI 产品实习生', summary: '具备 Agent 产品证据。', claims: ['完成 Agent 方案'] }),
    draftHrReply: async () => ({ content: '需要确认后回复。', risk: 'red' as const }),
  }
}

function channels() {
  return {
    submitApplication: async () => ({ externalId: 'mock-ats-001' }),
    sendHrReply: async () => ({ externalId: 'mock-hr-001' }),
  }
}

const jd = {
  title: 'AI 产品实习生',
  company: '星河科技',
  location: '杭州',
  description: '负责 AI Agent 产品需求分析、用户研究、原型设计和效果评估，要求能够将真实用户问题拆解为可执行工作流，并使用数据和作品证明判断。'.repeat(2),
}

describe('SQLite career repository', () => {
  it('healthCheck returns true when the database is open and false after close', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'career-health-'))
    cleanup.push(directory)
    const databasePath = join(directory, 'career.sqlite')
    const Repository = (infrastructure as Record<string, unknown>).SqliteCareerRepository as new (
      path: string,
    ) => { healthCheck(): Promise<boolean>; close(): void }

    const repo = new Repository(databasePath)
    expect(await repo.healthCheck()).toBe(true)
    repo.close()
    expect(await repo.healthCheck()).toBe(false)
  })

  it('restores a pending approval and ordered trace after reopening the database', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'career-recovery-'))
    cleanup.push(directory)
    const databasePath = join(directory, 'career.sqlite')
    const Repository = (infrastructure as Record<string, unknown>).SqliteCareerRepository
    expect(Repository, 'SqliteCareerRepository must be exported').toBeTypeOf('function')

    const first = new (Repository as new (path: string) => { close(): void }) (databasePath)
    const orchestrator = new CareerOrchestrator({
      repository: first as never,
      runtime: runtime(),
      channels: channels(),
      clock: { now: () => '2026-08-24T02:00:00.000Z' },
      ids: { next: (() => { let value = 0; return () => `recovery-${++value}` })() },
    })
    await orchestrator.resetDemo()
    const ws0 = await orchestrator.getWorkspace()
    const pursuitId = ws0.pursuits[0]!.id
    await orchestrator.analyzeJob(jd)
    await orchestrator.chooseChallenge(pursuitId)
    await orchestrator.completeEvidenceSprint(pursuitId, {
      title: '求职 Agent 产品方案',
      summary: '完成完整状态流和授权设计。',
      proofUrl: 'local://portfolio/career-agent',
    })
    const before = await orchestrator.requestApplication(pursuitId)
    first.close()

    const second = new (Repository as new (path: string) => {
      snapshot(): Promise<Awaited<ReturnType<typeof orchestrator.getWorkspace>>>
      close(): void
    })(databasePath)
    const restored = await second.snapshot()
    second.close()

    expect(restored.actions.at(-1)).toMatchObject({ type: 'submit_application', status: 'awaiting_approval' })
    expect(restored.events).toEqual(before.events)
    expect(restored.events.map((event) => event.seq)).toEqual(restored.events.map((_, index) => index + 1))
  })
})
