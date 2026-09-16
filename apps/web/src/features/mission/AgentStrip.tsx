import { FileText, Radar, GraduationCap, Zap, CheckCircle2 } from 'lucide-react'
import type { AgentKind } from '@career/contracts'

const agents = [
  {
    id: 'advantage_resume' as const,
    label: '优势简历 Agent',
    icon: FileText,
    responsibility: '事实与表达',
    detail: '真实经历锚定 · 动词量化',
    kindClass: 'agent-resume',
  },
  {
    id: 'job_execution' as const,
    label: '求职执行 Agent',
    icon: Radar,
    responsibility: '机会与行动',
    detail: '岗位雷达 · ATS 与 HR 联动',
    kindClass: 'agent-exec',
  },
  {
    id: 'interview_growth' as const,
    label: '面试成长 Agent',
    icon: GraduationCap,
    responsibility: '差距与成长',
    detail: '短板突破 · 证据冲刺交付',
    kindClass: 'agent-growth',
  },
]

export function AgentStrip({ owner }: { owner: AgentKind }) {
  return (
    <section className="agent-strip" aria-label="业务 Agent 协作状态">
      {agents.map((agent) => {
        const Icon = agent.icon
        const active = agent.id === owner
        return (
          <div className={`agent-chip ${agent.kindClass}${active ? ' is-owner' : ''}`} key={agent.id}>
            <div className="agent-icon-wrapper">
              <span className="agent-icon"><Icon size={18} /></span>
              {active && <span className="agent-active-ring" />}
            </div>
            <div className="agent-copy">
              <div className="ac-header">
                <strong>{agent.label}</strong>
                {active ? (
                  <span className="owner-crown-tag">
                    <Zap size={11} className="zap-icon" /> 当前主责
                  </span>
                ) : (
                  <span className="agent-idle-tag"><CheckCircle2 size={11} /> 待命协同</span>
                )}
              </div>
              <small>{active ? agent.detail : agent.responsibility}</small>
            </div>
          </div>
        )
      })}
    </section>
  )
}

