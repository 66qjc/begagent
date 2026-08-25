import { ArrowRight, CircleDot } from 'lucide-react'
import type { DomainEvent } from '@career/core'

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    'mission.created': '任务创建',
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

export function TraceTimeline({ events }: { events: DomainEvent[] }) {
  return (
    <section className="panel trace-panel">
      <div className="panel-heading">
        <div><h2>执行轨迹</h2><p>每次交接、授权与外部动作都可回放</p></div>
        <span className="count-chip">{events.length} 条事件</span>
      </div>
      {events.length === 0 ? <p className="quiet-copy">任务开始后，真实事件会出现在这里。</p> : (
        <ol className="trace-list">
          {[...events].reverse().slice(0, 8).map((event, index) => (
            <li key={event.id}>
              <span className={index === 0 ? 'trace-node is-latest' : 'trace-node'}><CircleDot size={14} /></span>
              <div className="trace-copy">
                <div><span className="event-type">{eventLabel(event.type)}</span><time>{new Date(event.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></div>
                <p>{event.summary}</p>
              </div>
              <ArrowRight className="trace-arrow" size={15} aria-hidden="true" />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
