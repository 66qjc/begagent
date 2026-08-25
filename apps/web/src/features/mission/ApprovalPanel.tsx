import { AlertTriangle, ArrowUpRight, ShieldCheck } from 'lucide-react'
import type { ActionIntent } from '@career/core'

interface ApprovalPanelProps {
  action: ActionIntent | undefined
  busy: boolean
  onDecision(action: ActionIntent, decision: 'approve' | 'reject'): void
}

export function ApprovalPanel({ action, busy, onDecision }: ApprovalPanelProps) {
  if (!action) {
    return (
      <section className="side-card approval-card is-clear">
        <div className="side-card-title"><ShieldCheck size={18} /><h2>审批队列</h2></div>
        <p className="quiet-copy">当前没有需要你确认的外部动作。</p>
        <div className="clear-state"><span>策略门正常</span><small>所有动作均通过风险检查</small></div>
      </section>
    )
  }
  const label = action.type === 'submit_application' ? '提交岗位申请' : '发送敏感 HR 回复'
  return (
    <section className="side-card approval-card is-pending" aria-live="polite">
      <div className="side-card-title"><AlertTriangle size={18} /><h2>等待你的确认</h2></div>
      <div className="risk-line">
        <span className={`risk-badge risk-${action.risk}`}>{action.risk === 'red' ? '红色动作' : '黄色动作'}</span>
        <span>版本 {action.version}</span>
      </div>
      <h3>{label}</h3>
      <p>{action.reason}</p>
      {action.type === 'send_hr_reply' && typeof action.payload['content'] === 'string' ? (
        <blockquote>{action.payload['content']}</blockquote>
      ) : null}
      <div className="approval-actions">
        <button className="button button-primary" disabled={busy} onClick={() => onDecision(action, 'approve')}>
          批准并执行 <ArrowUpRight size={16} />
        </button>
        <button className="button button-ghost" disabled={busy} onClick={() => onDecision(action, 'reject')}>拒绝动作</button>
      </div>
    </section>
  )
}
