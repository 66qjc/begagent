import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import type { PursuitStage } from '@career/core'

const stages: Array<{ id: PursuitStage; label: string; short: string }> = [
  { id: 'discovered', label: '岗位导入', short: '导入' },
  { id: 'qualified', label: '岗位判断', short: '岗位' },
  { id: 'growth_plan', label: '挑战决策', short: '挑战' },
  { id: 'evidence_sprint', label: '证据冲刺', short: '证据' },
  { id: 'materials_ready', label: '简历更新', short: '简历' },
  { id: 'application_awaiting_approval', label: '投递确认', short: '投递' },
  { id: 'application_submitted', label: '投递完成', short: '完成' },
  { id: 'hr_active', label: 'HR 沟通', short: 'HR' },
  { id: 'completed', label: '任务完成', short: '归档' },
]

export function StageRail({ current }: { current: PursuitStage }) {
  const railRef = useRef<HTMLOListElement>(null)
  const activeIndex = stages.findIndex((stage) => stage.id === current)
  const progress = activeIndex > 0 ? Math.round((activeIndex / (stages.length - 1)) * 100) : 0

  useEffect(() => {
    const activeEl = railRef.current?.querySelector('[aria-current="step"]')
    activeEl?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [current])

  return (
    <>
      <div className="stage-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="stage-progress-bar" style={{ width: `${progress}%` }} />
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
            >
              <span className="stage-dot" aria-hidden="true">{complete ? <Check size={12} strokeWidth={2.4} /> : index + 1}</span>
              <span className="stage-label-full">{stage.label}</span>
              <span className="stage-label-short">{stage.short}</span>
            </li>
          )
        })}
      </ol>
    </>
  )
}
