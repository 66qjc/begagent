import type { AnalyzeJobRequest } from '@career/contracts'
import { NotFoundError, StaleActionError } from './errors.ts'
import { evaluateActionPolicy } from './policy.ts'
import type {
  ActionIntent,
  AgentHandoff,
  CareerMission,
  DomainEvent,
  JobPursuit,
  MemoryItem,
  PursuitStage,
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
import type { WorkflowPort } from './workflow-port.ts'
import { assertMissionTransition, assertPursuitTransition } from './workflow.ts'

interface Dependencies {
  repository: CareerRepository
  runtime: CareerRuntimePort
  channels: ExternalChannelPort
  clock: Clock
  ids: IdGenerator
  policy?: ActionPolicyEvaluator
  workflow?: WorkflowPort
}

export class CareerOrchestrator {
  private readonly repository: CareerRepository
  private readonly runtime: CareerRuntimePort
  private readonly channels: ExternalChannelPort
  private readonly clock: Clock
  private readonly ids: IdGenerator
  private readonly policy: ActionPolicyEvaluator
  private readonly workflow: WorkflowPort | null

  constructor(dependencies: Dependencies) {
    this.repository = dependencies.repository
    this.runtime = dependencies.runtime
    this.channels = dependencies.channels
    this.clock = dependencies.clock
    this.ids = dependencies.ids
    this.policy = dependencies.policy ?? evaluateActionPolicy
    this.workflow = dependencies.workflow ?? null
  }

  async resetDemo(): Promise<WorkspaceState> {
    await this.repository.transaction((draft) => {
      const now = this.clock.now()
      const missionId = this.ids.next()
      const pursuitId = this.ids.next()
      const jobId = this.ids.next()
      Object.assign(draft, {
        ...this.emptyState(),
        mission: {
          id: missionId,
          name: 'AI 产品实习求职计划',
          targetRole: 'AI 产品实习生',
          status: 'active',
          ownerAgent: 'job_execution',
          version: 1,
          createdAt: now,
          updatedAt: now,
        } satisfies CareerMission,
      })
      draft.pursuits.push({
        id: pursuitId,
        missionId,
        jobId,
        stage: 'discovered',
        route: 'direct',
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      draft.jobs.push({
        id: jobId,
        missionId,
        pursuitId,
        title: 'AI 产品实习生',
        company: '示例科技',
        location: '杭州',
        description: 'AI 产品方向实习岗位，负责需求调研、用户访谈与交互原型验证。要求熟悉产品流程，���独立完成竞品分析与原型设计。',
        analysis: { recommendation: '', summary: '', gaps: [], evidenceStrength: '' },
        createdAt: now,
      })
      draft.memories.push(
        this.memory(missionId, 'user', '教育背景', '数字媒体技术本科，2027 届。', 'confirmed', 'user_confirmed'),
        this.memory(missionId, 'evidence', '项目经历', '完成校园服务产品调研与交互原型。', 'confirmed', 'user_confirmed'),
        this.memory(missionId, 'mission', '求职边界', '优先杭州，可实习四个月；薪资与到岗时间需逐次确认。', 'confirmed', 'user_confirmed'),
      )
      draft.tasks.push({
        id: this.ids.next(),
        missionId,
        pursuitId,
        title: '发现并判断目标岗位',
        ownerAgent: 'job_execution',
        status: 'active',
        createdAt: now,
      })
      this.event(draft, 'mission.created', 'system', '创建 AI 产品实习求职计划')
      this.event(draft, 'pursuit.created', 'system', '创建岗位追求', { pursuitId })
    })
    return this.repository.snapshot()
  }

  async createPursuit(input: AnalyzeJobRequest): Promise<WorkspaceState> {
    await this.repository.transaction((draft) => {
      const mission = this.requireMission(draft)
      const now = this.clock.now()
      const pursuitId = this.ids.next()
      const jobId = this.ids.next()
      draft.pursuits.push({
        id: pursuitId,
        missionId: mission.id,
        jobId,
        stage: 'discovered',
        route: 'direct',
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      draft.jobs.push({
        id: jobId,
        missionId: mission.id,
        pursuitId,
        ...input,
        analysis: { recommendation: '', summary: '', gaps: [], evidenceStrength: '' },
        createdAt: now,
      })
      draft.tasks.push({
        id: this.ids.next(),
        missionId: mission.id,
        pursuitId,
        title: `判断岗位：${input.title}`,
        ownerAgent: 'job_execution',
        status: 'active',
        createdAt: now,
      })
      this.event(draft, 'pursuit.created', 'system', `创建岗位追求：${input.title}`, { pursuitId })
    })
    return this.repository.snapshot()
  }

  async analyzeJob(input: AnalyzeJobRequest & { pursuitId?: string }): Promise<WorkspaceState> {
    const analysis = await this.runtime.analyzeJob(input)
    await this.repository.transaction((draft) => {
      const mission = this.requireMission(draft)
      const pursuit = this.requirePursuit(draft, input.pursuitId ?? this.firstPursuitId(draft))
      assertPursuitTransition(pursuit.stage, 'qualified')
      const now = this.clock.now()
      const job = draft.jobs.find((j) => j.id === pursuit.jobId)
      if (job) {
        job.analysis = analysis
      } else {
        draft.jobs.push({ id: pursuit.jobId, missionId: mission.id, pursuitId: pursuit.id, ...input, analysis, createdAt: now })
      }
      this.completeActiveTask(draft, pursuit.id)
      this.movePursuit(pursuit, 'qualified', 'job_execution')
      this.event(draft, 'job.analyzed', 'job_execution', analysis.summary, { pursuitId: pursuit.id, gaps: analysis.gaps })
    })
    return this.repository.snapshot()
  }

  async chooseChallenge(pursuitId: string): Promise<WorkspaceState> {
    const sprint = await this.runtime.planEvidenceSprint()
    await this.repository.transaction((draft) => {
      const mission = this.requireMission(draft)
      const pursuit = this.requirePursuit(draft, pursuitId)
      assertPursuitTransition(pursuit.stage, 'growth_plan')
      pursuit.route = 'growth'
      this.movePursuit(pursuit, 'growth_plan', 'job_execution')
      this.event(draft, 'challenge.selected', 'user', '选择完成岗位证据冲刺后投递', { pursuitId })
      assertPursuitTransition(pursuit.stage, 'evidence_sprint')
      const handoff = this.handoff(draft, 'job_execution', 'interview_growth', sprint.objective, 'confirmed_evidence')
      draft.tasks.push({
        id: this.ids.next(),
        missionId: mission.id,
        pursuitId: pursuit.id,
        title: sprint.title,
        ownerAgent: 'interview_growth',
        status: 'active',
        createdAt: this.clock.now(),
        handoff,
      })
      this.movePursuit(pursuit, 'evidence_sprint', 'interview_growth')
      this.event(draft, 'agent.handoff', 'system', '求职执行 Agent 将证据冲刺交接给面试成长 Agent', {
        pursuitId, handoffId: handoff.id,
      })
    })
    return this.repository.snapshot()
  }

  async completeEvidenceSprint(pursuitId: string, input: { title: string; summary: string; proofUrl: string }): Promise<WorkspaceState> {
    const snapshot = await this.repository.snapshot()
    const pursuit = snapshot.pursuits.find((p) => p.id === pursuitId)
    const job = snapshot.jobs.find((j) => j.id === pursuit?.jobId)
    const resume = await this.runtime.updateResume({
      evidenceTitle: input.title,
      evidenceSummary: input.summary,
      jobTitle: job?.title ?? '',
      jobDescription: job?.description ?? '',
      jobGaps: job?.analysis.gaps ?? [],
      memories: snapshot.memories
        .filter((m) => m.status === 'confirmed')
        .map((m) => ({ layer: m.layer, title: m.title, content: m.content })),
    })
    await this.repository.transaction((draft) => {
      const mission = this.requireMission(draft)
      const pursuit = this.requirePursuit(draft, pursuitId)
      assertPursuitTransition(pursuit.stage, 'materials_ready')
      const now = this.clock.now()
      const evidenceId = this.ids.next()
      draft.evidence.push({
        id: evidenceId,
        missionId: mission.id,
        pursuitId: pursuit.id,
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
      this.completeActiveTask(draft, pursuit.id)
      const resumeHandoff = this.handoff(draft, 'interview_growth', 'advantage_resume', '将新证据写入岗位版简历', 'resume_version')
      draft.tasks.push({
        id: this.ids.next(),
        missionId: mission.id,
        pursuitId: pursuit.id,
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
        pursuitId: pursuit.id,
        version: draft.resumes.filter((r) => r.pursuitId === pursuit.id).length + 1,
        ...resume,
        evidenceIds: [evidenceId],
        createdAt: now,
      })
      const executionHandoff = this.handoff(draft, 'advantage_resume', 'job_execution', '使用已确认的岗位版简历申请目标岗位', 'application_draft')
      draft.tasks.push({
        id: this.ids.next(),
        missionId: mission.id,
        pursuitId: pursuit.id,
        title: '准备岗位申请',
        ownerAgent: 'job_execution',
        status: 'active',
        createdAt: now,
        handoff: executionHandoff,
      })
      this.movePursuit(pursuit, 'materials_ready', 'job_execution')
      this.event(draft, 'evidence.confirmed', 'interview_growth', '新证据已确认并写入职业记忆', { pursuitId, evidenceId })
      this.event(draft, 'resume.version_created', 'advantage_resume', '岗位版简历已根据新证据更新', {
        pursuitId, resumeVersion: draft.resumes.filter((r) => r.pursuitId === pursuit.id).length,
      })
    })
    return this.repository.snapshot()
  }

  async requestApplication(pursuitId: string): Promise<WorkspaceState> {
    const action = await this.repository.transaction((draft) => {
      const mission = this.requireMission(draft)
      const pursuit = this.requirePursuit(draft, pursuitId)
      assertPursuitTransition(pursuit.stage, 'application_awaiting_approval')
      const job = draft.jobs.find((j) => j.id === pursuit.jobId)
      const resume = draft.resumes.filter((r) => r.pursuitId === pursuit.id).at(-1)
      if (!job || !resume) throw new NotFoundError('Application requires a job and resume version.')
      const decision = this.policy({ risk: 'yellow', actionType: 'submit_application', authorizedActionTypes: [] })
      const action = this.action(mission.id, pursuit.id, 'submit_application', 'yellow', decision.outcome, {
        jobId: job.id,
        resumeVersionId: resume.id,
      }, decision.reason)
      draft.actions.push(action)
      draft.applications.push({
        id: this.ids.next(),
        missionId: mission.id,
        pursuitId: pursuit.id,
        jobId: job.id,
        resumeVersionId: resume.id,
        status: 'draft',
        actionIntentId: action.id,
        createdAt: this.clock.now(),
      })
      const activeTask = draft.tasks.find((task) => task.pursuitId === pursuit.id && task.status === 'active')
      if (activeTask) activeTask.status = 'awaiting_approval'
      this.movePursuit(pursuit, 'application_awaiting_approval', 'job_execution')
      this.event(draft, 'action.awaiting_approval', 'job_execution', '岗位申请等待用户确认', { pursuitId, actionIntentId: action.id })
      return structuredClone(action)
    })

    if (this.workflow) {
      await this.workflow.runMission({
        runId: action.missionId,
        stage: 'application_awaiting_approval',
        command: { kind: 'request_application' },
        actionId: action.id,
      })
    }
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

    if (this.workflow) {
      await this.workflow.resumeMission({
        runId: action.missionId,
        approved: true,
        actionId: action.id,
      })
      return this.repository.snapshot()
    }

    await this.completeApprovedAction(action.id)
    return this.repository.snapshot()
  }

  async simulateHrMessage(pursuitId: string, input: { kind: 'salary_question' }): Promise<WorkspaceState> {
    const content = input.kind === 'salary_question'
      ? '同学你好，请问你的期望实习薪资是多少？下周可以到岗吗？'
      : ''
    const reply = await this.runtime.draftHrReply({ message: content })
    const action = await this.repository.transaction((draft) => {
      const mission = this.requireMission(draft)
      const pursuit = this.requirePursuit(draft, pursuitId)
      assertPursuitTransition(pursuit.stage, 'hr_active')
      draft.hrMessages.push({
        id: this.ids.next(),
        missionId: mission.id,
        pursuitId: pursuit.id,
        direction: 'inbound',
        content,
        risk: 'red',
        createdAt: this.clock.now(),
      })
      const decision = this.policy({ risk: reply.risk, actionType: 'send_hr_reply', authorizedActionTypes: [] })
      const action = this.action(mission.id, pursuit.id, 'send_hr_reply', reply.risk, decision.outcome, { content: reply.content }, decision.reason)
      draft.actions.push(action)
      draft.tasks.push({
        id: this.ids.next(),
        missionId: mission.id,
        pursuitId: pursuit.id,
        title: '确认薪资与到岗时间回复',
        ownerAgent: 'job_execution',
        status: 'awaiting_approval',
        createdAt: this.clock.now(),
      })
      this.movePursuit(pursuit, 'hr_active', 'job_execution')
      this.event(draft, 'hr.message_received', 'system', '收到涉及薪资与到岗时间的 HR 消息', { pursuitId, actionIntentId: action.id })
      return structuredClone(action)
    })

    if (this.workflow) {
      await this.workflow.runMission({
        runId: action.missionId,
        stage: 'hr_active',
        command: { kind: 'simulate_hr', input: { kind: 'salary_question' } },
        actionId: action.id,
      })
    }
    return this.repository.snapshot()
  }

  async getWorkspace(): Promise<WorkspaceState> {
    return this.repository.snapshot()
  }

  async completeApprovedAction(actionId: string): Promise<void> {
    let action: ActionIntent | undefined
    let pursuitId = ''
    await this.repository.transaction((draft) => {
      action = draft.actions.find((candidate) => candidate.id === actionId)
      if (action) pursuitId = action.pursuitId
    })
    if (!action) throw new NotFoundError('Action intent not found.')

    try {
      const externalId = await this.executeAction(action)
      await this.repository.transaction((draft) => {
        const mission = this.requireMission(draft)
        const pursuit = this.requirePursuit(draft, pursuitId)
        const current = draft.actions.find((candidate) => candidate.id === action!.id)!
        current.status = 'executed'
        current.version += 1
        if (current.type === 'submit_application') {
          const application = draft.applications.find((candidate) => candidate.actionIntentId === current.id)!
          application.status = 'submitted'
          application.externalId = externalId
          application.submittedAt = this.clock.now()
          this.completeActiveTask(draft, pursuit.id)
          assertPursuitTransition(pursuit.stage, 'application_submitted')
          this.movePursuit(pursuit, 'application_submitted', 'job_execution')
          this.event(draft, 'application.submitted', 'job_execution', '受控 ATS 已接收岗位申请', { pursuitId, externalId })
        } else {
          draft.hrMessages.push({
            id: this.ids.next(),
            missionId: mission.id,
            pursuitId: pursuit.id,
            direction: 'outbound',
            content: String(current.payload['content']),
            risk: current.risk,
            externalId,
            createdAt: this.clock.now(),
          })
          this.event(draft, 'hr.reply_sent', 'job_execution', '经用户确认的 HR 回复已发送', { pursuitId, externalId })
        }
      })
    } catch (error) {
      await this.repository.transaction((draft) => {
        const current = draft.actions.find((candidate) => candidate.id === action!.id)!
        current.status = 'failed'
        current.version += 1
        this.event(draft, 'action.failed', 'system', '外部动作执行失败', {
          message: error instanceof Error ? error.message : String(error),
        })
      })
      throw error
    }
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
    pursuitId: string,
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
      pursuitId,
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

  private completeActiveTask(draft: WorkspaceState, pursuitId: string): void {
    const task = draft.tasks.find((candidate) => candidate.pursuitId === pursuitId && (candidate.status === 'active' || candidate.status === 'awaiting_approval'))
    if (task) {
      task.status = 'completed'
      task.completedAt = this.clock.now()
    }
  }

  private movePursuit(pursuit: JobPursuit, stage: PursuitStage, _ownerAgent: CareerMission['ownerAgent']): void {
    void _ownerAgent
    pursuit.stage = stage
    pursuit.version += 1
    pursuit.updatedAt = this.clock.now()
  }

  private requireMission(draft: WorkspaceState): CareerMission {
    if (!draft.mission) throw new NotFoundError('No active career mission.')
    return draft.mission
  }

  private requirePursuit(draft: WorkspaceState, pursuitId: string): JobPursuit {
    const pursuit = draft.pursuits.find((p) => p.id === pursuitId)
    if (!pursuit) throw new NotFoundError(`Pursuit ${pursuitId} not found.`)
    return pursuit
  }

  private firstPursuitId(draft: WorkspaceState): string {
    const pursuit = draft.pursuits[0]
    if (!pursuit) throw new NotFoundError('No pursuit exists.')
    return pursuit.id
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
      pursuits: [],
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
