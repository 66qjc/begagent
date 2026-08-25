import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  History,
  Play,
  RefreshCcw,
  RotateCcw,
  ServerCog,
  Target,
  WifiOff,
  X,
} from 'lucide-react'
import type { ActionIntent, MissionStage, WorkspaceState } from '@career/core'
import { ApprovalPanel } from '../features/mission/ApprovalPanel.tsx'
import { AgentStrip } from '../features/mission/AgentStrip.tsx'
import { StageRail } from '../features/mission/StageRail.tsx'
import { TraceTimeline } from '../features/mission/TraceTimeline.tsx'
import { WorkspaceSkeleton } from '../features/mission/WorkspaceSkeleton.tsx'
import { Sidebar } from '../features/mission/Sidebar.tsx'
import { JobCard, EvidenceCard, ResumeCard } from '../features/mission/ArtifactCards.tsx'
import { MemoryPanel, ChannelPanel } from '../features/mission/SidePanels.tsx'
import { careerApi, type CareerApi } from './api.ts'
import '../styles/tokens.css'
import '../styles/global.css'

export interface AppProps {
  client?: CareerApi
}

export function App(_props: AppProps) {
  const client = _props.client ?? careerApi
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      setWorkspace(await client.getWorkspace())
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [client])

  useEffect(() => { void load() }, [load])

  const showNotice = useCallback((message: string) => {
    clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = setTimeout(() => setNotice(null), 4000)
  }, [])

  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  const run = useCallback(async (label: string, command: () => Promise<WorkspaceState>) => {
    setBusy(true)
    setNotice(null)
    try {
      setWorkspace(await command())
      setStatus('ready')
      showNotice(label)
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '动作执行失败，请重试。')
    } finally {
      setBusy(false)
    }
  }, [showNotice])

  if (status === 'loading') return <WorkspaceSkeleton />
  if (status === 'error') return <ErrorScreen onRetry={() => { void load() }} />
  if (!workspace?.mission) {
    return <EmptyScreen busy={busy} onReset={() => { void run('黄金演示已载入', client.resetDemo) }} />
  }

  const mission = workspace.mission
  const pendingAction = workspace.actions.find((action) => action.status === 'awaiting_approval')
  const activeTask = [...workspace.tasks].reverse().find((task) => task.status === 'active' || task.status === 'awaiting_approval')
  const next = nextCommand(mission.stage, client)

  const decide = (action: ActionIntent, decision: 'approve' | 'reject') => {
    const label = decision === 'approve' ? '外部动作已获授权并执行' : '外部动作已拒绝'
    void run(label, () => client.decideAction(action.id, action.version, decision))
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">跳到主要内容</a>
      <Sidebar />
      <main className="app-main" id="main">
        <header className="topbar">
          <div className="mission-heading">
            <div className="mission-mark"><Target size={20} /></div>
            <div><span>Career Mission</span><h1>{mission.name}</h1></div>
          </div>
          <div className="topbar-actions">
            <span className="runtime-chip"><span /> 本地运行正常</span>
            <button className="icon-button" aria-label="重置黄金演示" disabled={busy} onClick={() => { void run('演示数据已重置', client.resetDemo) }}>
              <RotateCcw size={17} />
            </button>
          </div>
        </header>

        <div className="workspace">
          <AgentStrip owner={mission.ownerAgent} />
          {notice ? (
            <div className="toast" role="status" aria-live="polite">
              <CheckCircle2 size={17} />
              <span className="toast-text">{notice}</span>
              <button className="toast-close" aria-label="关闭通知" onClick={() => setNotice(null)}><X size={14} /></button>
            </div>
          ) : null}

          <section className="mission-overview panel">
            <div className="overview-copy">
              <span className="status-kicker"><Activity size={14} /> 当前阶段</span>
              <h2>{stageTitle(mission.stage)}</h2>
              <p>{stageDescription(mission.stage)}</p>
            </div>
            <div className="overview-meta">
              <div><Clock3 size={15} /><span>最近更新</span><strong>{formatTime(mission.updatedAt)}</strong></div>
              <div><History size={15} /><span>状态版本</span><strong>v{mission.version}</strong></div>
              <div><ServerCog size={15} /><span>运行模式</span><strong>确定性演示</strong></div>
            </div>
            <StageRail current={mission.stage} />
          </section>

          <div className="workspace-grid">
            <div className="primary-column">
              <section className="next-action panel">
                <div className="panel-heading">
                  <div><h2>当前任务</h2><p>单任务、单负责人，完成后再交接</p></div>
                  <span className="owner-badge">{agentShortName(mission.ownerAgent)} 主责</span>
                </div>
                <div className="action-body">
                  <div className="action-symbol"><Play size={23} fill="currentColor" /></div>
                  <div className="action-copy">
                    <h3>{activeTask?.title ?? next.title}</h3>
                    <p>{next.description}</p>
                  </div>
                  {next.command && !pendingAction ? (
                    <button className="button button-primary" disabled={busy} onClick={() => { void run(next.success, next.command!) }}>
                      {busy ? '正在执行' : next.button} <ArrowRight size={16} />
                    </button>
                  ) : <span className="waiting-label">{pendingAction ? '等待审批' : '当前阶段已完成'}</span>}
                </div>
              </section>

              <div className="artifact-grid">
                <JobCard workspace={workspace} />
                <EvidenceCard workspace={workspace} />
                <ResumeCard workspace={workspace} />
              </div>

              <TraceTimeline events={workspace.events} />
            </div>

            <aside className="side-column" aria-label="任务辅助信息">
              <ApprovalPanel action={pendingAction} busy={busy} onDecision={decide} />
              <MemoryPanel workspace={workspace} />
              <ChannelPanel workspace={workspace} />
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}

function ErrorScreen({ onRetry }: { onRetry(): void }) {
  return (
    <div className="center-screen error-screen">
      <div className="error-mark"><WifiOff size={25} /></div>
      <h1>无法读取职业工作区</h1>
      <p>API 暂时不可用。确认本地服务启动后重新连接。</p>
      <button className="button button-primary" onClick={onRetry}><RefreshCcw size={16} />重新连接</button>
    </div>
  )
}

function EmptyScreen({ busy, onReset }: { busy: boolean; onReset(): void }) {
  return (
    <div className="empty-shell">
      <div className="brand-lockup"><span className="brand-symbol">启</span><strong>启程 Career OS</strong></div>
      <section className="empty-card">
        <div className="empty-icon"><BriefcaseBusiness size={28} /></div>
        <h1>还没有正在执行的求职计划</h1>
        <p>载入一条完整的 AI 产品实习黄金路径，体验岗位判断、Agent 交接、证据冲刺、投递审批与 HR 沟通。</p>
        <button className="button button-primary" disabled={busy} onClick={onReset}>载入黄金演示 <ArrowRight size={16} /></button>
      </section>
    </div>
  )
}

function nextCommand(stage: MissionStage, client: CareerApi) {
  const commands: Record<MissionStage, { title: string; description: string; button: string; success: string; command?: () => Promise<WorkspaceState> }> = {
    profile_ready: { title: '导入并判断 AI 产品实习岗位', description: '解析硬性条件、兴趣、竞争证据、差距与投入价值。', button: '开始岗位判断', success: '岗位判断已完成', command: client.analyzeJob },
    job_analyzed: { title: '选择成长型投递路径', description: '把可补齐的岗位差距转化为短期证据冲刺。', button: '接受证据挑战', success: '成长路径已确认', command: client.chooseChallenge },
    challenge_selected: { title: '创建岗位证据冲刺', description: '编排器正在准备结构化 Agent 交接。', button: '继续', success: '证据冲刺已创建' },
    evidence_sprint: { title: '完成大学生求职 Agent 产品证据冲刺', description: '确认成果真实完成后，写入证据记忆并触发简历更新。', button: '提交已完成证据', success: '新证据与简历版本已生成', command: client.completeEvidence },
    resume_updated: { title: '准备岗位申请并生成动作意图', description: '申请信息将写入受控 ATS，最终提交前必须确认。', button: '生成投递申请', success: '投递动作正在等待确认', command: client.requestApplication },
    application_awaiting_approval: { title: '确认岗位申请', description: '投递被权限策略暂停，批准后只执行一次。', button: '查看审批', success: '等待确认' },
    application_submitted: { title: '等待并处理 HR 后续消息', description: '模拟 HR 发起一条包含薪资与到岗时间的敏感询问。', button: '模拟 HR 消息', success: '已收到 HR 敏感询问', command: client.simulateHr },
    hr_active: { title: '维护有上下文的 HR 对话', description: '低风险沟通可自动处理，承诺性内容持续由用户确认。', button: '继续沟通', success: 'HR 上下文已更新' },
    completed: { title: '当前求职任务已完成', description: '所有产物和执行轨迹均已归档。', button: '查看归档', success: '任务已完成' },
  }
  return commands[stage]
}

function stageTitle(stage: MissionStage): string {
  const labels: Record<MissionStage, string> = {
    profile_ready: '职业档案已就绪', job_analyzed: '岗位判断已完成', challenge_selected: '挑战路径已确认',
    evidence_sprint: '正在完成岗位证据冲刺', resume_updated: '岗位版简历已更新', application_awaiting_approval: '申请等待你的确认',
    application_submitted: '岗位申请已提交', hr_active: 'HR 沟通正在进行', completed: '求职任务已完成',
  }
  return labels[stage]
}

function stageDescription(stage: MissionStage): string {
  const labels: Record<MissionStage, string> = {
    profile_ready: '系统已装载确认事实、求职偏好与沟通边界。', job_analyzed: '五层岗位判断已经形成，可选择直接投递或补强证据。',
    challenge_selected: '系统正在创建跨 Agent 任务包。', evidence_sprint: '面试成长 Agent 主责，真实成果完成后才会写入简历。',
    resume_updated: '新证据已经进入职业素材库，求职执行 Agent 重新接管。', application_awaiting_approval: '外部动作尚未发生，审批记录将进入执行轨迹。',
    application_submitted: '受控 ATS 返回投递回执，后续状态会持续写回。', hr_active: '对话保留岗位、申请材料与已确认事实的完整上下文。',
    completed: '产物、授权与外部结果已经形成可回放闭环。',
  }
  return labels[stage]
}

function agentShortName(agent: WorkspaceState['mission'] extends infer _T ? NonNullable<WorkspaceState['mission']>['ownerAgent'] : never): string {
  return { advantage_resume: '优势简历', job_execution: '求职执行', interview_growth: '面试成长' }[agent]
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
