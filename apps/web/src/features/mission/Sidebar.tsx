import { Check, ShieldCheck, Sparkles } from 'lucide-react'
import type { PursuitStage, WorkspaceState } from '@career/core'

interface JourneyStep {
  label: string
  description: string
  stages: PursuitStage[]
}

const journeySteps: JourneyStep[] = [
  { label: '发现目标岗位', description: '导入岗位并判断是否值得推进', stages: ['discovered', 'qualified'] },
  { label: '选择推进方式', description: '直接投递，或先补齐岗位差距', stages: ['growth_plan'] },
  { label: '补齐关键证据', description: '完成一项可验证成果', stages: ['evidence_sprint'] },
  { label: '生成岗位简历', description: '只用已确认的经历更新材料', stages: ['materials_ready'] },
  { label: '确认并完成投递', description: '审阅申请，再授权外部提交', stages: ['application_awaiting_approval', 'application_submitted'] },
  { label: '跟进 HR 沟通', description: '敏感承诺始终由你确认', stages: ['hr_active', 'completed'] },
]

export function Sidebar({ workspace }: { workspace?: WorkspaceState }) {
  const currentStage = workspace?.pursuits[0]?.stage ?? 'discovered'
  const activeIndex = Math.max(0, journeySteps.findIndex((step) => step.stages.includes(currentStage)))
  const isJourneyComplete = currentStage === 'completed'
  const completedCount = isJourneyComplete ? journeySteps.length : activeIndex

  return (
    <aside className="sidebar" aria-label="当前求职计划">
      <div className="brand-lockup">
        <span className="brand-symbol">beg</span>
        <div className="brand-meta">
          <div className="brand-title-line">
            <strong>beg agent</strong>
            <span className="brand-badge"><Sparkles size={11} /> AI OS</span>
          </div>
          <small>begagent</small>
        </div>
      </div>

      <section className="sidebar-journey" aria-labelledby="journey-heading">
        <div className="journey-heading">
          <div className="jh-top">
            <span id="journey-heading">关键步骤</span>
            <span className="jh-count">{completedCount}/{journeySteps.length} 已达成</span>
          </div>
          <strong>{workspace?.mission?.targetRole ?? '求职计划'}</strong>
        </div>

        <ol className="journey-list" aria-label="求职关键步骤" role="list">
          {journeySteps.map((step, index) => {
            const isActive = index === activeIndex
            const isComplete = index < activeIndex || (isActive && isJourneyComplete)
            const stateClass = `${isActive ? ' is-active' : ''}${isComplete ? ' is-complete' : ''}`
            const status = isComplete ? '已完成' : isActive ? '当前' : index === activeIndex + 1 ? '下一步' : '待开始'

            return (
              <li aria-current={isActive ? 'step' : undefined} className={`journey-step${stateClass}`} key={step.label}>
                <span className="journey-marker" aria-hidden="true">
                  {isComplete ? <Check size={14} strokeWidth={3} /> : index + 1}
                  {isActive ? <span className="marker-ping" /> : null}
                </span>
                <span className="journey-copy">
                  <strong>{step.label}</strong>
                  <small>{step.description}</small>
                </span>
                <span className="journey-status">{status}</span>
              </li>
            )
          })}
        </ol>
      </section>

      <div className="journey-safety">
        <div className="safety-icon-wrapper">
          <ShieldCheck size={18} />
          <span className="safety-pulse-dot" />
        </div>
        <div>
          <strong>受控执行</strong>
          <small>关键外部动作需要你的确认</small>
        </div>
      </div>
    </aside>
  )
}

