import { MemoryStick, ServerCog } from 'lucide-react'
import type { WorkspaceState } from '@career/core'

export function MemoryPanel({ workspace }: { workspace: WorkspaceState }) {
  const confirmed = workspace.memories.filter((item) => item.status === 'confirmed').length
  const layers = new Set(workspace.memories.map((item) => item.layer)).size
  return (
    <section className="side-card memory-card">
      <div className="side-card-title"><MemoryStick size={18} /><h2>分层职业记忆</h2></div>
      <div className="memory-stats"><div><strong>{confirmed}</strong><span>已确认事实</span></div><div><strong>{layers}</strong><span>活跃记忆层</span></div></div>
      <ul className="scope-list">
        <li><span className="scope-dot user" />用户长期记忆<small>按需读取</small></li>
        <li><span className="scope-dot evidence" />职业素材与证据<small>可追溯</small></li>
        <li><span className="scope-dot mission" />求职计划记忆<small>编排层维护</small></li>
      </ul>
    </section>
  )
}

export function ChannelPanel({ workspace }: { workspace: WorkspaceState }) {
  const application = workspace.applications.at(-1)
  const outbound = workspace.hrMessages.filter((message) => message.direction === 'outbound').length
  return (
    <section className="side-card channel-card">
      <div className="side-card-title"><ServerCog size={18} /><h2>受控执行通道</h2></div>
      <div className="channel-row"><span className="channel-icon ats">ATS</span><div><strong>Mock ATS</strong><small>{application?.status === 'submitted' ? '申请已接收' : '等待批准投递'}</small></div><span className="channel-status" /></div>
      <div className="channel-row"><span className="channel-icon hr">HR</span><div><strong>Mock HR</strong><small>{outbound > 0 ? '敏感回复已确认' : '上下文通道就绪'}</small></div><span className="channel-status" /></div>
    </section>
  )
}
