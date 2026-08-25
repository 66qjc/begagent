import type { WorkspaceState } from '@career/core'

export interface CareerApi {
  getWorkspace(): Promise<WorkspaceState>
  resetDemo(): Promise<WorkspaceState>
  analyzeJob(): Promise<WorkspaceState>
  chooseChallenge(): Promise<WorkspaceState>
  completeEvidence(): Promise<WorkspaceState>
  requestApplication(): Promise<WorkspaceState>
  decideAction(actionId: string, expectedVersion: number, decision: 'approve' | 'reject'): Promise<WorkspaceState>
  simulateHr(): Promise<WorkspaceState>
}

const seededJob = {
  title: 'AI 产品实习生',
  company: '星河科技',
  location: '杭州',
  description: '负责 AI Agent 产品需求分析、用户研究、原型设计和效果评估，要求能够将真实用户问题拆解为可执行工作流，并使用数据和作品证明判断。'.repeat(2),
}

const seededEvidence = {
  title: '大学生求职执行 Agent',
  summary: '完成任务编排、证据约束、用户审批和中断恢复方案。',
  proofUrl: 'local://portfolio/career-agent',
}

async function request(path: string, init?: RequestInit): Promise<WorkspaceState> {
  const response = await fetch(path, {
    ...init,
    ...(init?.body === undefined ? {} : { headers: { 'content-type': 'application/json', ...init.headers } }),
  })
  const payload = await response.json() as WorkspaceState | { message?: string }
  if (!response.ok) {
    throw new Error('message' in payload && payload.message ? payload.message : `请求失败：${response.status}`)
  }
  return payload as WorkspaceState
}

function post(path: string, payload?: unknown): Promise<WorkspaceState> {
  return request(path, {
    method: 'POST',
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })
}

export const careerApi: CareerApi = {
  getWorkspace: () => request('/api/workspace'),
  resetDemo: () => post('/api/demo/reset'),
  analyzeJob: () => post('/api/jobs/analyze', seededJob),
  chooseChallenge: () => post('/api/missions/challenge', { strategy: 'evidence_sprint' }),
  completeEvidence: () => post('/api/evidence/complete', seededEvidence),
  requestApplication: () => post('/api/applications/request'),
  decideAction: (actionId, expectedVersion, decision) => post(`/api/actions/${actionId}/decision`, {
    expectedVersion,
    decision,
  }),
  simulateHr: () => post('/api/hr/simulate', { kind: 'salary_question' }),
}
