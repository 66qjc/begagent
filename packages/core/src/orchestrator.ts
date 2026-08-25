import type { AnalyzeJobRequest } from '@career/contracts'
import { NotFoundError, StaleActionError } from './errors.ts'
import { evaluateActionPolicy } from './policy.ts'
import type {
  ActionIntent,
  AgentHandoff,
  CareerMission,
  DomainEvent,
  MemoryItem,
  WorkspaceState,
} from './model.ts'
import type {
  ActionPolicyEvaluator,
  CareerRepository,
  CareerRuntimePort,
  Clock,
  ExternalChannelPort,
  IdGenerator,
} from './ports.ts'
import { assertMissionTransition } from './workflow.ts'

interface Dependencies {
  repository: CareerRepository
  runtime: CareerRuntimePort
  channels: ExternalChannelPort
  clock: Clock
  ids: IdGenerator
  policy?: ActionPolicyEvaluator
}

export class CareerOrchestrator {
  private readonly repository: CareerRepository
  private readonly runtime: CareerRuntimePort
  private readonly channels: ExternalChannelPort
  private readonly clock: Clock
  private readonly ids: IdGenerator
  private readonly policy: ActionPolicyEvaluator

  constructor(dependencies: Dependencies) {
    this.repository = dependencies.repository
    this.runtime = dependencies.runtime
    this.channels = dependencies.channels
    this.clock = dependencies.clock
    this.ids = dependencies.ids
    this.policy = dependencies.policy ?? evaluateActionPolicy
  }

  async resetDemo(): Promise<WorkspaceState> {
    await this.repository.transaction((draft) => {
      const now = this.clock.now()
      const missionId = this.ids.next()
      Object.assign(draft, {
        ...this.emptyState(),
        mission: {
          id: missionId,
          name: 'AI 产品实习求职计划',
          targetRole: 'AI 产品实习生',
          stage: 'profile_ready',
          ownerAgent: 'job_execution',
          version: 1,
          createdAt: now,
          updatedAt: now,
        } satisfies CareerMission,
      })
      draft.memories.push(
        this.memory(missionId, 'user', '教育背景', '数字媒体技术本科，2027 届。', 'confirmed', 'user_confirmed'),
        this.memory(missionId, 'evidence', '项目经历', '完成校园服务产品调研与交互原型。', 'confirmed', 'user_confirmed'),
        this.memory(missionId, 'mission', '求职边界', '优先杭州，可实习四个月；薪资与到岗时间需逐次确认。', 'confirmed', 'user_confirmed'),
      )
      draft.tasks.push({
        id: this.ids.next(),
        missionId,
        title: '发现并判断目标岗位',
        ownerAgent: 'job_execution',
        status: 'active',
        createdAt: now,
      })
      this.event(draft, 'mission.created', 'system', '创建 AI 产品实习求职计划')
    })
    return this.repository.snapshot()
  }

  async analyzeJob(input: AnalyzeJobRequest): Promise<WorkspaceState> {
    const analysis = await this.runtime.analyzeJob(input)
    await this.repository.transaction((draft) => {
      const mission = this.requireMission(draft)
      assertMissionTransition(mission.stage, 'job_analyzed')
      const now = this.clock.now()
      draft.jobs.push({ id: this.ids.next(), missionId: mission.id, ...input, analysis, createdAt: now })
      this.completeActiveTask(draft)
      this.moveMission(mission, 'job_analyzed', 'job_execution')
      this.event(draft, 'job.analyzed', 'job_execution', analysis.summary, { gaps: analysis.gaps })
    })
    return this.repository.snapshot()
  }

  async chooseChallenge(input: { strategy: 'evidence_sprint' }): Promise<WorkspaceState> {
    const sprint = await this.runtime.planEvidenceSprint()
    await this.repository.transaction((draft) => {
      const mission = this.requireMission(draft)
      assertMissionTransition(mission.stage, 'challenge_selected')
      this.moveMission(mission, 'challenge_selected', 'job_execution')
      this.event(draft, 'challenge.selected', 'user', '选择完成岗位证据冲刺后投递', { strategy: input.strategy })
      assertMissionTransition(mission.stage, 'evidence_sprint')
      const handoff = this.handoff(draft, 'job_execution', 'interview_growth', sprint.objective, 'confirmed_evidence')
      draft.tasks.push({
        id: this.ids.next(),
        missionId: mission.id,
        title: sprint.title,
        ownerAgent: 'interview_growth',
        status: 'active',
        createdAt: this.clock.now(),
        handoff,
      })
      this.moveMission(mission, 'evidence_sprint', 'interview_growth')
      this.event(draft, 'agent.handoff', 'system', '求职执行 Agent 将证据冲刺交接给面试成长 Agent', {
        handoffId: handoff.id,
      })
    })
    return this.repository.snapshot()
  }

  async completeEvidenceSprint(input: { title: string; summary: string; proofUrl: string }): Promise<WorkspaceState> {
    const resume = await this.runtime.updateResume({ evidenceTitle: input.title, evidenceSummary: input.summary })
    await this.repository.transaction((draft) => {
      const mission = this.requireMission(draft)
      assertMissionTransition(mission.stage, 'resume_updated')
      const now = this.clock.now()
      const evidenceId = this.ids.next()
      draft.evidence.push({
        id: evidenceId,
        missionId: mission.id,
        title: input.title,
        summary: input.summary,
        proofUrl: input.proofUrl,
        source: 'user_completed_sprint',
        status: 'confirmed',
        createdAt: now,
      })
      draft.memories.push({
        ...this.memory(mission.id, 'evidence', input.title, input.summary, 'confirmed', 'evidence_sprint'),
        evidenceIds: [evidenceId],
      })
      this.completeActiveTask(draft)
      const resumeHandoff = this.handoff(draft, 'interview_growth', 'advantage_resume', '将新证据写入岗位版简历', 'resume_version')
      draft.tasks.push({
        id: this.ids.next(),
        missionId: mission.id,
        title: '更新 AI 产品岗位版简历',
        ownerAgent: 'advantage_resume',
        status: 'completed',
        createdAt: now,
        completedAt: now,
        handoff: resumeHandoff,
      })
      draft.resumes.push({
        id: this.ids.next(),
        missionId: mission.id,
        version: draft.resumes.length + 1,
        ...resume,
        evidenceIds: [evidenceId],
        createdAt: now,
      })
      const executionHandoff = this.handoff(draft, 'advantage_resume', 'job_execution', '使用已确认的岗位版简历申请目标岗位', 'application_draft')
      draft.tasks.push({
        id: this.ids.next(),
        missionId: mission.id,
        title: '准备岗位申请',
        ownerAgent: 'job_execution',
        status: 'active',
        createdAt: now,
        handoff: executionHandoff,
      })
      this.moveMission(mission, 'resume_updated', 'job_execution')
      this.event(draft, 'evidence.confirmed', 'interview_growth', '新证据已确认并写入职业记忆', { evidenceId })
      this.event(draft, 'resume.version_created', 'advantage_resume', '岗位版简历已根据新证据更新', {
        resumeVersion: draft.resumes.length,
      })
    })
    return this.repository.snapshot()
  }

  async requestApplication(): Promise<WorkspaceState> {
    await this.repository.transaction((draft) => {
      const mission = this.requireMission(draft)
      assertMissionTransition(mission.stage, 'application_awaiting_approval')
      const job = draft.jobs.at(-1)
      const resume = draft.resumes.at(-1)
      if (!job || !resume) throw new NotFoundError('Application requires a job and resume version.')
      const decision = this.policy({ risk: 'yellow', actionType: 'submit_application', authorizedActionTypes: [] })
      const action = this.action(mission.id, 'submit_application', 'yellow', decision.outcome, {
        jobId: job.id,
        resumeVersionId: resume.id,
      }, decision.reason)
      draft.actions.push(action)
      draft.applications.push({
        id: this.ids.next(),
        missionId: mission.id,
        jobId: job.id,
        resumeVersionId: resume.id,
        status: 'draft',
        actionIntentId: action.id,
        createdAt: this.clock.now(),
      })
      const activeTask = draft.tasks.find((task) => task.status === 'active')
      if (activeTask) activeTask.status = 'awaiting_approval'
      this.moveMission(mission, 'application_awaiting_approval', 'job_execution')
      this.event(draft, 'action.awaiting_approval', 'job_execution', '岗位申请等待用户确认', { actionIntentId: action.id })
    })
    return this.repository.snapshot()
  }

  async decideAction(input: { actionId: string; expectedVersion: number; decision: 'approve' | 'reject' }): Promise<WorkspaceState> {
    const action = await this.repository.transaction((draft) => {
      const found = draft.actions.find((candidate) => candidate.id === input.actionId)
      if (!found) throw new NotFoundError('Action intent not found.')
      if (found.version !== input.expectedVersion) throw new StaleActionError('Stale action intent version.')
      if (found.status !== 'awaiting_approval') throw new StaleActionError('Action intent was already decided.')
      found.decidedAt = this.clock.now()
      found.version += 1
      if (input.decision === 'reject') {
        found.status = 'rejected'
        this.event(draft, 'action.rejected', 'user', '用户拒绝外部动作', { actionIntentId: found.id })
        return structuredClone(found)
      }
      found.status = 'executing'
      this.event(draft, 'action.approved', 'user', '用户批准外部动作', { actionIntentId: found.id })
      return structuredClone(found)
    })

    if (input.decision === 'reject') return this.repository.snapshot()

    try {
      const externalId = await this.executeAction(action)
      await this.repository.transaction((draft) => {
        const mission = this.requireMission(draft)
        const current = draft.actions.find((candidate) => candidate.id === action.id)!
        current.status = 'executed'
        current.version += 1
        if (current.type === 'submit_application') {
          const application = draft.applications.find((candidate) => candidate.actionIntentId === current.id)!
          application.status = 'submitted'
          application.externalId = externalId
          application.submittedAt = this.clock.now()
          this.completeActiveTask(draft)
          assertMissionTransition(mission.stage, 'application_submitted')
          this.moveMission(mission, 'application_submitted', 'job_execution')
          this.event(draft, 'application.submitted', 'job_execution', '受控 ATS 已接收岗位申请', { externalId })
        } else {
          draft.hrMessages.push({
            id: this.ids.next(),
            missionId: mission.id,
            direction: 'outbound',
            content: String(current.payload['content']),
            risk: current.risk,
            externalId,
            createdAt: this.clock.now(),
          })
          this.event(draft, 'hr.reply_sent', 'job_execution', '经用户确认的 HR 回复已发送', { externalId })
        }
      })
    } catch (error) {
      await this.repository.transaction((draft) => {
        const current = draft.actions.find((candidate) => candidate.id === action.id)!
        current.status = 'failed'
        current.version += 1
        this.event(draft, 'action.failed', 'system', '外部动作执行失败', {
          message: error instanceof Error ? error.message : String(error),
        })
      })
      throw error
    }
    return this.repository.snapshot()
  }

  async simulateHrMessage(input: { kind: 'salary_question' }): Promise<WorkspaceState> {
    const content = input.kind === 'salary_question'
      ? '同学你好，请问你的期望实习薪资是多少？下周可以到岗吗？'
      : ''
    const reply = await this.runtime.draftHrReply({ message: content })
    await this.repository.transaction((draft) => {
      const mission = this.requireMission(draft)
      assertMissionTransition(mission.stage, 'hr_active')
      draft.hrMessages.push({
        id: this.ids.next(),
        missionId: mission.id,
        direction: 'inbound',
        content,
        risk: 'red',
        createdAt: this.clock.now(),
      })
      const decision = this.policy({ risk: reply.risk, actionType: 'send_hr_reply', authorizedActionTypes: [] })
      const action = this.action(mission.id, 'send_hr_reply', reply.risk, decision.outcome, { content: reply.content }, decision.reason)
      draft.actions.push(action)
      draft.tasks.push({
        id: this.ids.next(),
        missionId: mission.id,
        title: '确认薪资与到岗时间回复',
        ownerAgent: 'job_execution',
        status: 'awaiting_approval',
        createdAt: this.clock.now(),
      })
      this.moveMission(mission, 'hr_active', 'job_execution')
      this.event(draft, 'hr.message_received', 'system', '收到涉及薪资与到岗时间的 HR 消息', { actionIntentId: action.id })
    })
    return this.repository.snapshot()
  }

  async getWorkspace(): Promise<WorkspaceState> {
    return this.repository.snapshot()
  }

  private async executeAction(action: ActionIntent): Promise<string> {
    if (action.type === 'submit_application') {
      const result = await this.channels.submitApplication({
        missionId: action.missionId,
        idempotencyKey: action.idempotencyKey,
        jobId: String(action.payload['jobId']),
        resumeVersionId: String(action.payload['resumeVersionId']),
      })
      return result.externalId
    }
    const result = await this.channels.sendHrReply({
      missionId: action.missionId,
      idempotencyKey: action.idempotencyKey,
      content: String(action.payload['content']),
    })
    return result.externalId
  }

  private action(
    missionId: string,
    type: ActionIntent['type'],
    risk: ActionIntent['risk'],
    outcome: 'execute' | 'awaiting_approval' | 'forbidden',
    payload: Record<string, unknown>,
    reason: string,
  ): ActionIntent {
    if (outcome === 'forbidden') throw new Error(reason)
    return {
      id: this.ids.next(),
      missionId,
      type,
      risk,
      status: outcome === 'execute' ? 'executing' : 'awaiting_approval',
      reason,
      payload,
      idempotencyKey: this.ids.next(),
      version: 1,
      createdAt: this.clock.now(),
    }
  }

  private handoff(
    draft: WorkspaceState,
    fromAgent: AgentHandoff['fromAgent'],
    toAgent: AgentHandoff['toAgent'],
    objective: string,
    expectedArtifact: string,
  ): AgentHandoff {
    return {
      id: this.ids.next(),
      fromAgent,
      toAgent,
      objective,
      memoryRefs: draft.memories.filter((item) => item.status === 'confirmed').map((item) => item.id),
      permissions: ['read_scoped_memory', 'write_structured_artifact'],
      expectedArtifact,
      createdAt: this.clock.now(),
    }
  }

  private memory(
    missionId: string,
    layer: 'user' | 'evidence' | 'mission',
    title: string,
    content: string,
    status: 'confirmed',
    source: string,
  ): MemoryItem {
    return {
      id: this.ids.next(),
      missionId,
      layer,
      title,
      content,
      status,
      source,
      evidenceIds: [],
      readableBy: ['advantage_resume', 'job_execution', 'interview_growth'],
      createdAt: this.clock.now(),
    }
  }

  private completeActiveTask(draft: WorkspaceState): void {
    const task = draft.tasks.find((candidate) => candidate.status === 'active' || candidate.status === 'awaiting_approval')
    if (task) {
      task.status = 'completed'
      task.completedAt = this.clock.now()
    }
  }

  private moveMission(mission: CareerMission, stage: CareerMission['stage'], ownerAgent: CareerMission['ownerAgent']): void {
    mission.stage = stage
    mission.ownerAgent = ownerAgent
    mission.version += 1
    mission.updatedAt = this.clock.now()
  }

  private requireMission(draft: WorkspaceState): CareerMission {
    if (!draft.mission) throw new NotFoundError('No active career mission.')
    return draft.mission
  }

  private event(
    draft: WorkspaceState,
    type: string,
    actor: DomainEvent['actor'],
    summary: string,
    data: Record<string, unknown> = {},
  ): void {
    const mission = this.requireMission(draft)
    draft.events.push({
      id: this.ids.next(),
      seq: draft.events.length + 1,
      missionId: mission.id,
      type,
      actor,
      summary,
      data,
      createdAt: this.clock.now(),
    })
  }

  private emptyState(): WorkspaceState {
    return {
      mission: null,
      jobs: [],
      tasks: [],
      memories: [],
      evidence: [],
      resumes: [],
      actions: [],
      applications: [],
      hrMessages: [],
      events: [],
    }
  }
}
