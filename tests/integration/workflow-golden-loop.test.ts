import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
const dirs: string[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function workflowApp(): Promise<{ app: TestApp; dbPath: string }> {
  const build = (api as Record<string, unknown>).buildApp
  expect(build, 'buildApp must be exported').toBeTypeOf('function')
  const directory = await mkdtemp(join(tmpdir(), 'career-wf-'))
  dirs.push(directory)
  const dbPath = join(directory, 'career.sqlite')
  const instance = await (build as (options: unknown) => Promise<TestApp>)({
    databasePath: dbPath,
    enableWorkflow: true,
  })
  apps.push(instance)
  return { app: instance, dbPath }
}

async function reopenWorkflowApp(dbPath: string): Promise<TestApp> {
  const build = (api as Record<string, unknown>).buildApp
  const instance = await (build as (options: unknown) => Promise<TestApp>)({
    databasePath: dbPath,
    enableWorkflow: true,
  })
  apps.push(instance)
  return instance
}

const jd = {
  title: 'AI 产品实习生',
  company: '星河科技',
  location: '杭州',
  description: '负责 AI Agent 产品需求分析、用户研究、原型设计和效果评估，要求能够将真实用户问题拆解为可执行工作流，并使用数据和作品证明判断。'.repeat(2),
}

interface Workspace {
  mission: { id: string }
  pursuits: Array<{ id: string; stage: string }>
  actions: Array<{ id: string; status: string; version: number; type: string }>
  applications: Array<{ status: string; externalId?: string }>
  hrMessages: Array<{ direction: string }>
  events: Array<{ seq: number; type: string }>
}

async function getWorkspace(app: TestApp): Promise<Workspace> {
  return (await app.inject({ method: 'GET', url: '/api/workspace' })).json() as Workspace
}

async function getPursuitId(app: TestApp): Promise<string> {
  const ws = await getWorkspace(app)
  return ws.pursuits[0]!.id
}

async function runEvidenceSprint(app: TestApp, pursuitId: string): Promise<void> {
  await app.inject({ method: 'POST', url: '/api/missions/challenge', payload: { pursuitId } })
  await app.inject({
    method: 'POST',
    url: '/api/evidence/complete',
    payload: {
      pursuitId,
      title: '大学生求职执行 Agent',
      summary: '完成任务编排、证据约束、用户审批和中断恢复方案。',
      proofUrl: 'local://portfolio/career-agent',
    },
  })
}

describe('LangGraph workflow golden loop', () => {
  it('drives the full golden loop through workflow interrupt and resume', async () => {
    const { app } = await workflowApp()

    const health = await app.inject({ method: 'GET', url: '/api/health' })
    expect(health.json()).toMatchObject({
      status: 'ok',
      runtime: 'deterministic',
      workflow: 'langgraph',
    })

    await app.inject({ method: 'POST', url: '/api/demo/reset' })
    const pursuitId = await getPursuitId(app)
    await app.inject({ method: 'POST', url: '/api/jobs/analyze', payload: jd })
    await runEvidenceSprint(app, pursuitId)

    // requestApplication should create the action intent AND suspend the workflow
    let response = await app.inject({ method: 'POST', url: '/api/applications/request', payload: { pursuitId } })
    expect(response.statusCode).toBe(200)
    let workspace = response.json() as Workspace
    expect(workspace.pursuits[0]!.stage).toBe('application_awaiting_approval')
    const applicationAction = workspace.actions.at(-1)!
    expect(applicationAction.status).toBe('awaiting_approval')

    // decideAction with approve triggers workflow resume → executor → completeApprovedAction
    response = await app.inject({
      method: 'POST',
      url: `/api/actions/${applicationAction.id}/decision`,
      payload: { expectedVersion: applicationAction.version, decision: 'approve' },
    })
    expect(response.statusCode).toBe(200)
    workspace = response.json() as Workspace
    expect(workspace.pursuits[0]!.stage).toBe('application_submitted')
    expect(workspace.applications[0]?.status).toBe('submitted')
    expect(workspace.applications[0]?.externalId).toBeDefined()

    // HR salary question creates a red action intent and suspends the workflow
    response = await app.inject({ method: 'POST', url: '/api/hr/simulate', payload: { pursuitId, kind: 'salary_question' } })
    expect(response.statusCode).toBe(200)
    workspace = response.json() as Workspace
    const hrAction = workspace.actions.at(-1)!
    expect(hrAction.status).toBe('awaiting_approval')
    expect(hrAction.type).toBe('send_hr_reply')

    // approve the HR reply → workflow resume → executor sends the reply
    response = await app.inject({
      method: 'POST',
      url: `/api/actions/${hrAction.id}/decision`,
      payload: { expectedVersion: hrAction.version, decision: 'approve' },
    })
    expect(response.statusCode).toBe(200)
    workspace = response.json() as Workspace
    expect(workspace.hrMessages.map((m) => m.direction)).toEqual(['inbound', 'outbound'])

    // All actions should be executed
    workspace = await getWorkspace(app)
    expect(workspace.actions.every((a) => a.status === 'executed')).toBe(true)
    expect(workspace.events.length).toBeGreaterThanOrEqual(10)
  })

  it('rejects an action without executing external side effects', async () => {
    const { app } = await workflowApp()
    await app.inject({ method: 'POST', url: '/api/demo/reset' })
    const pursuitId = await getPursuitId(app)
    await app.inject({ method: 'POST', url: '/api/jobs/analyze', payload: jd })
    await runEvidenceSprint(app, pursuitId)

    let response = await app.inject({ method: 'POST', url: '/api/applications/request', payload: { pursuitId } })
    const workspace = response.json() as Workspace
    const applicationAction = workspace.actions.at(-1)!

    response = await app.inject({
      method: 'POST',
      url: `/api/actions/${applicationAction.id}/decision`,
      payload: { expectedVersion: applicationAction.version, decision: 'reject' },
    })
    expect(response.statusCode).toBe(200)
    const after = response.json() as Workspace
    const rejected = after.actions.find((a) => a.id === applicationAction.id)!
    expect(rejected.status).toBe('rejected')
    // Application should remain in draft — never submitted
    expect(after.applications[0]?.status).toBe('draft')
    expect(after.applications[0]?.externalId).toBeUndefined()
  })

  it('restores the pending workflow checkpoint after process restart', async () => {
    const { app: firstApp, dbPath } = await workflowApp()
    await firstApp.inject({ method: 'POST', url: '/api/demo/reset' })
    const pursuitId = await getPursuitId(firstApp)
    await firstApp.inject({ method: 'POST', url: '/api/jobs/analyze', payload: jd })
    await runEvidenceSprint(firstApp, pursuitId)
    let response = await firstApp.inject({ method: 'POST', url: '/api/applications/request', payload: { pursuitId } })
    let workspace = response.json() as Workspace
    const missionId = workspace.mission.id
    const applicationAction = workspace.actions.at(-1)!

    // Close the first process — simulates crash/restart
    await firstApp.close()

    // Reopen with the same database — the workflow checkpoint should persist
    const secondApp = await reopenWorkflowApp(dbPath)
    workspace = await getWorkspace(secondApp)
    expect(workspace.pursuits[0]!.stage).toBe('application_awaiting_approval')

    // The action intent should still be awaiting approval
    const restoredAction = workspace.actions.find((a) => a.id === applicationAction.id)!
    expect(restoredAction).toBeDefined()
    expect(restoredAction.status).toBe('awaiting_approval')

    // The resume endpoint should work after restart
    response = await secondApp.inject({
      method: 'POST',
      url: `/api/workflow/${missionId}/resume`,
      payload: { actionId: applicationAction.id, approved: true },
    })
    expect(response.statusCode).toBe(200)
    workspace = response.json() as Workspace
    expect(workspace.pursuits[0]!.stage).toBe('application_submitted')
    expect(workspace.applications[0]?.status).toBe('submitted')
  })

  it('does not duplicate external effects on duplicate resume', async () => {
    const { app } = await workflowApp()
    await app.inject({ method: 'POST', url: '/api/demo/reset' })
    const pursuitId = await getPursuitId(app)
    await app.inject({ method: 'POST', url: '/api/jobs/analyze', payload: jd })
    await runEvidenceSprint(app, pursuitId)

    let response = await app.inject({ method: 'POST', url: '/api/applications/request', payload: { pursuitId } })
    let workspace = response.json() as Workspace
    const missionId = workspace.mission.id
    const applicationAction = workspace.actions.at(-1)!

    // First approve — should execute once
    response = await app.inject({
      method: 'POST',
      url: `/api/actions/${applicationAction.id}/decision`,
      payload: { expectedVersion: applicationAction.version, decision: 'approve' },
    })
    expect(response.statusCode).toBe(200)
    workspace = response.json() as Workspace
    const firstExternalId = workspace.applications[0]?.externalId
    expect(firstExternalId).toBeDefined()

    // Attempt resume again via the workflow resume endpoint — should not re-execute
    const resumeResponse = await app.inject({
      method: 'POST',
      url: `/api/workflow/${missionId}/resume`,
      payload: { actionId: applicationAction.id, approved: true },
    })
    // The resume may succeed or fail depending on graph state, but the key
    // invariant is: the external effect is not duplicated.
    workspace = await getWorkspace(app)
    expect(workspace.applications[0]?.externalId).toBe(firstExternalId)
  })
})
