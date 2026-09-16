import { MemoryStick, ServerCog, Inbox, Send, FileText, CheckCircle2, ShieldCheck, Wifi } from 'lucide-react'
import type { WorkspaceState } from '@career/core'

export function MemoryPanel({ workspace }: { workspace: WorkspaceState }) {
  const confirmed = workspace.memories.filter((item) => item.status === 'confirmed')
  const layers = new Set(workspace.memories.map((item) => item.layer))
  const layerCounts: Record<string, number> = {}
  for (const item of workspace.memories) {
    layerCounts[item.layer] = (layerCounts[item.layer] ?? 0) + 1
  }
  const layerOrder = ['user', 'evidence', 'mission', 'job', 'working'] as const
  const layerName: Record<string, string> = {
    user: '用户长期记忆',
    evidence: '职业素材与证据',
    mission: '求职计划记忆',
    job: '岗位判断记忆',
    working: '工作上下文',
  }

  return (
    <section className="side-card memory-card">
      <div className="side-card-title">
        <div className="title-icon-badge text-cyan">
          <MemoryStick size={18} />
        </div>
        <div>
          <h2>分层职业记忆</h2>
          <span className="side-card-subtitle">跨 Agent 可信数据总线</span>
        </div>
      </div>

      <div className="memory-stats">
        <div className="mem-stat-box">
          <strong>{confirmed.length}</strong>
          <span>已确认事实</span>
        </div>
        <div className="mem-stat-box">
          <strong>{layers.size}</strong>
          <span>活跃记忆层</span>
        </div>
      </div>

      <div className="memory-layers">
        {layerOrder.map((layer) => {
          const count = layerCounts[layer] ?? 0
          if (count === 0) return null
          return (
            <div className={`memory-layer layer-${layer}`} key={layer}>
              <span className={`ml-dot ${layer}`} />
              <span className="ml-name">{layerName[layer]}</span>
              <small className="ml-count">{count} 条</small>
            </div>
          )
        })}
      </div>

      {confirmed.length > 0 ? (
        <div className="evidence-list mem-evidence-list">
          {confirmed.slice(0, 4).map((item) => (
            <div className="evidence-item mem-item" key={item.id}>
              <MemoryStick size={14} className="ev-icon text-cyan" />
              <div className="ev-body">
                <strong>{item.title}</strong>
                <small>{item.content}</small>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function ChannelPanel({ workspace }: { workspace: WorkspaceState }) {
  const application = workspace.applications.at(-1)
  const hrMessages = [...workspace.hrMessages].reverse().slice(0, 4)
  const atsSubmitted = application?.status === 'submitted'

  return (
    <section className="side-card channel-card">
      <div className="side-card-title">
        <div className="title-icon-badge text-accent">
          <ServerCog size={18} />
        </div>
        <div>
          <h2>受控执行通道</h2>
          <span className="side-card-subtitle">ATS / HR 隔离模拟桩</span>
        </div>
      </div>

      <div className={`channel-row ${atsSubmitted ? 'is-connected' : ''}`}>
        <span className="channel-icon-pill">ATS</span>
        <div className="cr-copy">
          <div className="cr-title">
            <strong>Mock ATS 通道</strong>
            {atsSubmitted && <span className="channel-live-chip"><CheckCircle2 size={11} /> 投递成功</span>}
          </div>
          <small>{atsSubmitted ? `申请已接收 · 编号 ${application?.externalId ?? ''}` : '等待批准投递'}</small>
        </div>
        <span className={`channel-status-dot${atsSubmitted ? ' active' : ' is-idle'}`} title={atsSubmitted ? '通道已连接' : '就绪待命'} />
      </div>

      {application ? (
        <div className="ats-receipt-card">
          <FileText size={14} className="ev-icon text-accent" />
          <div className="ev-body">
            <div className="arc-head">
              <strong>投递回执记录</strong>
              <span className={`receipt-status-tag ${atsSubmitted ? 'submitted' : 'draft'}`}>
                {atsSubmitted ? '已入库' : '待确认'}
              </span>
            </div>
            <small>
              {atsSubmitted
                ? `已于 ${new Date(application.submittedAt ?? application.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 提交`
                : '受控策略草稿，等待用户签字'}
            </small>
          </div>
        </div>
      ) : null}

      <div className={`channel-row ${hrMessages.length > 0 ? 'is-connected' : ''}`}>
        <span className="channel-icon-pill">HR</span>
        <div className="cr-copy">
          <div className="cr-title">
            <strong>Mock HR 通道</strong>
            {hrMessages.length > 0 && <span className="channel-live-chip text-accent"><Wifi size={11} /> 实时会话</span>}
          </div>
          <small>{hrMessages.length > 0 ? `已发生 ${hrMessages.length} 轮双向沟通` : '上下文通道待命'}</small>
        </div>
        <span className={`channel-status-dot${hrMessages.length > 0 ? ' active' : ' is-idle'}`} title={hrMessages.length > 0 ? '通道活跃' : '就绪待命'} />
      </div>

      {hrMessages.length > 0 ? (
        <div className="hr-thread">
          {hrMessages.map((msg) => (
            <div className={`hr-msg ${msg.direction}`} key={msg.id}>
              <span className="hr-dir-avatar">
                {msg.direction === 'inbound' ? <Inbox size={14} /> : <Send size={14} />}
              </span>
              <div className="hr-bubble">
                <div className="hr-meta">
                  <strong>{msg.direction === 'inbound' ? '招聘方 HR' : '我方求职执行 Agent'}</strong>
                  {msg.risk !== 'green' ? (
                    <span className={`risk-badge risk-${msg.risk} mini`}>
                      <ShieldCheck size={10} />
                      {msg.risk === 'red' ? '红' : msg.risk === 'yellow' ? '黄' : msg.risk}
                    </span>
                  ) : null}
                  <time>{new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

