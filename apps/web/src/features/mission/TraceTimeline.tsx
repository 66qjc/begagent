import { CircleDot, History, User, Bot, Server, ChevronRight } from 'lucide-react'
import type { DomainEvent } from '@career/core'

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    'mission.created': '任务创建',
    'pursuit.created': '追求创建',
    'job.analyzed': '岗位判断',
    'challenge.selected': '挑战决策',
    'agent.handoff': 'Agent 交接',
    'evidence.confirmed': '证据确认',
    'resume.version_created': '简历更新',
    'action.awaiting_approval': '等待审批',
    'action.approved': '用户授权',
    'application.submitted': '投递完成',
    'hr.message_received': 'HR 消息',
    'hr.reply_sent': '回复完成',
  }
  return labels[type] ?? type
}

function eventTypeClass(type: string): string {
  if (type.includes('approval') || type.includes('approved')) return 'evt-approval'
  if (type.includes('handoff')) return 'evt-handoff'
  if (type.includes('evidence')) return 'evt-evidence'
  if (type.includes('application')) return 'evt-app'
  if (type.includes('hr')) return 'evt-hr'
  return 'evt-default'
}

const actorLabel: Record<string, string> = {
  job_execution: '求职执行',
  advantage_resume: '优势简历',
  interview_growth: '面试成长',
  system: '系统内核',
  user: '决策用户',
}

export function TraceTimeline({ events }: { events: DomainEvent[] }) {
  return (
    <section className="panel trace-panel">
      <div className="panel-heading">
        <div className="ph-left">
          <div className="title-icon-badge text-cyan">
            <History size={17} />
          </div>
          <div>
            <h2>执行轨迹</h2>
            <p>每次交接、授权与外部动作都可回放</p>
          </div>
        </div>
        <span className="count-chip pulse-chip">{events.length} 条审计事件</span>
      </div>

      {events.length === 0 ? (
        <p className="quiet-copy">任务开始后，真实事件会出现在这里。</p>
      ) : (
        <ol className="trace-list">
          {[...events].reverse().slice(0, 10).map((event, index) => {
            const isLatest = index === 0
            const typeClass = eventTypeClass(event.type)
            return (
              <li key={event.id} className={`trace-item ${isLatest ? 'is-latest' : ''}`}>
                <span className={`trace-node ${isLatest ? 'is-latest-node' : ''}`}>
                  <CircleDot size={13} />
                  {isLatest && <span className="trace-ping" />}
                </span>
                <div className="trace-card">
                  <div className="trace-copy-head">
                    <span className={`event-type-badge ${typeClass}`}>
                      {eventLabel(event.type)}
                    </span>
                    <div className="trace-head-right">
                      {event.actor !== 'system' && (
                        <span className={`trace-actor-pill actor-${event.actor}`}>
                          {event.actor === 'user' ? <User size={11} /> : <Bot size={11} />}
                          {actorLabel[event.actor] ?? event.actor}
                        </span>
                      )}
                      <time>{new Date(event.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                    </div>
                  </div>
                  <p className="trace-summary-text">{event.summary}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

