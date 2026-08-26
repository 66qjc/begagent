import { afterEach, describe, expect, it } from 'vitest'
import * as api from '@career/api'

interface TestApp {
  inject(options: { method: string; url: string; payload?: unknown }): Promise<{
    statusCode: number
    json(): unknown
  }>
  close(): Promise<void>
}

const apps: TestApp[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

async function app(): Promise<TestApp> {
  const build = (api as Record<string, unknown>).buildApp
  expect(build, 'buildApp must be exported').toBeTypeOf('function')
  const instance = await (build as (options: unknown) => Promise<TestApp>)({ databasePath: ':memory:' })
  apps.push(instance)
  return instance
}

const jd = {
  title: 'AI 产品实习生',
  company: '星河科技',
  location: '杭州',
  description: '负责 AI Agent 产品需求分析、用户研究、原型设计和效果评估，要求能够将真实用户问题拆解为可执行工作流，并使用数据和作品证明判断。'.repeat(2),
}

describe('Career Agent HTTP API', () => {
  it('runs the complete approval-gated golden loop', async () => {
    const instance = await app()
    const health = await instance.inject({ method: 'GET', url: '/api/health' })
    expect(health.statusCode).toBe(200)
    expect(health.json()).toMatchObject({ status: 'ok', runtime: 'deterministic' })

    const systemConfig = await instance.inject({ method: 'GET', url: '/api/system/config' })
    expect(systemConfig.statusCode).toBe(200)
    const system = systemConfig.json() as {
      runtime: { activeProviderId: string; activeProtocol: string }
      policy: { version: string; rules: Array<{ id: string }> }
    }
    expect(system).toMatchObject({
      runtime: {
        activeProviderId: 'local-demo',
        activeProtocol: 'deterministic',
      },
      policy: {
        version: '2026-08-24',
      },
    })
    expect(system.policy.rules.map((rule) => rule.id)).toContain('integrity-block')
    expect(JSON.stringify(system)).not.toMatch(/apiKey|secret/i)

    const empty = await instance.inject({ method: 'GET', url: '/api/workspace' })
    expect(empty.statusCode).toBe(200)
    expect(empty.json()).toMatchObject({ mission: null })

    expect((await instance.inject({ method: 'POST', url: '/api/demo/reset' })).statusCode).toBe(200)
    // Get the pursuitId created by resetDemo
    const ws0 = (await instance.inject({ method: 'GET', url: '/api/workspace' })).json() as {
      pursuits: Array<{ id: string }>
    }
    const pursuitId = ws0.pursuits[0]!.id

    expect((await instance.inject({ method: 'POST', url: '/api/jobs/analyze', payload: jd })).statusCode).toBe(200)
    expect((await instance.inject({
      method: 'POST',
      url: '/api/missions/challenge',
      payload: { pursuitId },
    })).statusCode).toBe(200)
    expect((await instance.inject({
      method: 'POST',
      url: '/api/evidence/complete',
      payload: {
        pursuitId,
        title: '大学生求职执行 Agent',
        summary: '完成任务编排、证据约束、用户审批和中断恢复方案。',
        proofUrl: 'local://portfolio/career-agent',
      },
    })).statusCode).toBe(200)

    let response = await instance.inject({ method: 'POST', url: '/api/applications/request', payload: { pursuitId } })
    let workspace = response.json() as {
      pursuits: Array<{ stage: string }>
      actions: Array<{ id: string; status: string; version: number }>
    }
    expect(workspace.pursuits[0]!.stage).toBe('application_awaiting_approval')
    const applicationAction = workspace.actions.at(-1)!

    response = await instance.inject({
      method: 'POST',
      url: `/api/actions/${applicationAction.id}/decision`,
      payload: { expectedVersion: applicationAction.version, decision: 'approve' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ pursuits: [{ stage: 'application_submitted' }] })

    response = await instance.inject({
      method: 'POST',
      url: '/api/hr/simulate',
      payload: { pursuitId, kind: 'salary_question' },
    })
    workspace = response.json() as typeof workspace
    const hrAction = workspace.actions.at(-1)!
    expect(hrAction.status).toBe('awaiting_approval')

    response = await instance.inject({
      method: 'POST',
      url: `/api/actions/${hrAction.id}/decision`,
      payload: { expectedVersion: hrAction.version, decision: 'approve' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      pursuits: [{ stage: 'hr_active' }],
      hrMessages: [{ direction: 'inbound' }, { direction: 'outbound' }],
    })
  })

  it('returns validation and stale-decision errors without duplicating effects', async () => {
    const instance = await app()
    await instance.inject({ method: 'POST', url: '/api/demo/reset' })
    const invalid = await instance.inject({
      method: 'POST',
      url: '/api/jobs/analyze',
      payload: { title: 'AI 产品实习生' },
    })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.json()).toMatchObject({ code: 'VALIDATION_ERROR' })

    const workspace = (await instance.inject({ method: 'GET', url: '/api/workspace' })).json() as {
      pursuits: Array<{ stage: string }>
      jobs: unknown[]
    }
    expect(workspace.pursuits[0]!.stage).toBe('discovered')
    expect(workspace.jobs).toHaveLength(1)
  })
})
