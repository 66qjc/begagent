import { AlertTriangle, ArrowUpRight, ShieldCheck, CheckCircle2, Lock, MessageSquare } from 'lucide-react'
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
        <div className="side-card-title">
          <div className="title-icon-badge text-ok">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2>审批队列</h2>
            <span className="side-card-subtitle">受控策略门保护中</span>
          </div>
        </div>
        <p className="quiet-copy">当前没有需要你确认的外部动作。</p>
        <div className="clear-state">
          <div className="cs-left">
            <CheckCircle2 size={15} className="text-ok" />
            <span>策略门正常</span>
          </div>
          <small>所有动作均通过风险检查</small>
        </div>
      </section>
    )
  }

  const label = action.type === 'submit_application' ? '提交岗位申请' : '发送敏感 HR 回复'
  const isRed = action.risk === 'red'

  return (
    <section className={`side-card approval-card is-pending ${isRed ? 'risk-level-red' : 'risk-level-yellow'}`} aria-live="polite">
      <div className="approval-glow-overlay" />
      <div className="side-card-title">
        <div className="title-icon-badge text-danger pulse-warning">
          <AlertTriangle size={18} />
        </div>
        <div>
          <h2>等待你的确认</h2>
          <span className="side-card-subtitle">触发零越权安全阻断策略</span>
        </div>
      </div>

      <div className="risk-line">
        <span className={`risk-badge risk-${action.risk}`}>
          <Lock size={12} />
          {action.risk === 'red' ? '红色动作' : '黄色动作'}
        </span>
        <span className="version-chip">动作版本 v{action.version}</span>
      </div>

      <div className="approval-body">
        <h3 className="approval-action-title">{label}</h3>
        <p className="approval-reason-text">{action.reason}</p>

        {action.type === 'send_hr_reply' && typeof action.payload['content'] === 'string' ? (
          <div className="approval-quote-wrapper">
            <div className="quote-header">
              <MessageSquare size={13} />
              <span>待授权发送的内容</span>
            </div>
            <blockquote>{action.payload['content']}</blockquote>
          </div>
        ) : null}
      </div>

      <div className="approval-actions">
        <button
          className="button button-primary button-approve"
          disabled={busy}
          onClick={() => onDecision(action, 'approve')}
        >
          {busy ? '正在提交...' : '批准并执行'} <ArrowUpRight size={16} />
        </button>
        <button
          className="button button-ghost button-reject"
          disabled={busy}
          onClick={() => onDecision(action, 'reject')}
        >
          拒绝动作
        </button>
      </div>
    </section>
  )
}

