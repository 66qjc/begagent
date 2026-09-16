import { useEffect, useRef } from 'react'
import { Check, Compass } from 'lucide-react'
import type { PursuitStage } from '@career/core'

const stages: Array<{ id: PursuitStage; label: string; short: string; desc: string }> = [
  { id: 'discovered', label: '岗位导入', short: '导入', desc: '装载目标事实与边界' },
  { id: 'qualified', label: '岗位判断', short: '判断', desc: '五层匹配度与差距解析' },
  { id: 'growth_plan', label: '挑战决策', short: '决策', desc: '确定成长型投递路径' },
  { id: 'evidence_sprint', label: '证据冲刺', short: '证据', desc: '完成可验证成果项目' },
  { id: 'materials_ready', label: '简历更新', short: '简历', desc: '生成已核实经历版本' },
  { id: 'application_awaiting_approval', label: '投递确认', short: '审批', desc: '用户确认外部投递动作' },
  { id: 'application_submitted', label: '投递完成', short: '已投', desc: 'ATS 接收并生成回执' },
  { id: 'hr_active', label: 'HR 沟通', short: '沟通', desc: '双向智能体与受控应答' },
  { id: 'completed', label: '任务完成', short: '达成', desc: '全闭环归档可回放' },
]

export function StageRail({ current }: { current: PursuitStage }) {
  const railRef = useRef<HTMLOListElement>(null)
  const activeIndex = stages.findIndex((stage) => stage.id === current)
  const progress = activeIndex > 0 ? Math.round((activeIndex / (stages.length - 1)) * 100) : 0
  const activeStage = stages[activeIndex] ?? stages[0] ?? { id: current, label: '进行中', short: '当前', desc: '' }

  useEffect(() => {
    const activeEl = railRef.current?.querySelector('[aria-current="step"]')
    activeEl?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [current])

  return (
    <div className="stage-rail-wrapper">
      <div className="stage-rail-header">
        <div className="srh-left">
          <Compass size={15} className="text-accent-bright" />
          <span className="srh-title">闭环推进轨道</span>
          <span className="srh-badge">第 {activeIndex + 1}/{stages.length} 阶段：{activeStage.label}</span>
        </div>
        <div className="srh-right">
          <span className="srh-percent">{progress}% 达成</span>
        </div>
      </div>

      <div className="stage-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="stage-progress-bar" style={{ width: `${progress}%` }}>
          <span className="progress-glow-head" />
        </div>
      </div>

      <ol ref={railRef} className="stage-rail" aria-label="求职任务进度" role="list">
        {stages.map((stage, index) => {
          const complete = index < activeIndex
          const active = index === activeIndex
          return (
            <li
              className={active ? 'stage is-active' : complete ? 'stage is-complete' : 'stage'}
              key={stage.id}
              aria-current={active ? 'step' : undefined}
              title={stage.desc}
            >
              <span className="stage-dot" aria-hidden="true">
                {complete ? <Check size={12} strokeWidth={2.8} /> : index + 1}
                {active ? <span className="stage-ping" /> : null}
              </span>
              <span className="stage-label-full">{stage.label}</span>
              <span className="stage-label-short">{stage.short}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

