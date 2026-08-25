import { FileText, Radar, GraduationCap } from 'lucide-react'
import type { AgentKind } from '@career/contracts'

const agents = [
  { id: 'advantage_resume' as const, label: '优势简历 Agent', icon: FileText, responsibility: '事实与表达' },
  { id: 'job_execution' as const, label: '求职执行 Agent', icon: Radar, responsibility: '机会与行动' },
  { id: 'interview_growth' as const, label: '面试成长 Agent', icon: GraduationCap, responsibility: '差距与成长' },
]

export function AgentStrip({ owner }: { owner: AgentKind }) {
  return (
    <section className="agent-strip" aria-label="业务 Agent 协作状态">
      {agents.map((agent) => {
        const Icon = agent.icon
        const active = agent.id === owner
        return (
          <div className={active ? 'agent-chip is-owner' : 'agent-chip'} key={agent.id}>
            <span className="agent-icon"><Icon size={17} /></span>
            <span className="agent-copy">
              <strong>{agent.label}</strong>
              <small>{active ? '当前主责' : agent.responsibility}</small>
            </span>
            <span className={active ? 'live-dot is-active' : 'live-dot'} aria-label={active ? '正在执行' : '待命'} />
          </div>
        )
      })}
    </section>
  )
}
