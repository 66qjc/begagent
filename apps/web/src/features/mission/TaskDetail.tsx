import { ArrowRight, ListChecks } from 'lucide-react'
import type { AgentKind } from '@career/contracts'
import type { CareerTask, WorkspaceState } from '@career/core'

const agentLabel: Record<AgentKind, string> = {
  advantage_resume: '优势简历',
  job_execution: '求职执行',
  interview_growth: '面试成长',
}

export function TaskDetail({ workspace }: { workspace: WorkspaceState }) {
  const tasks = [...workspace.tasks].reverse()
  if (tasks.length === 0) return null

  return (
    <section className="panel" style={{ padding: 'var(--s-6)' }}>
      <div className="panel-heading">
        <div><h2>任务交接链</h2><p>单任务、单负责人，完成后再交接</p></div>
        <span className="count-chip">{workspace.tasks.length} 个任务</span>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </section>
  )
}

function TaskRow({ task }: { task: CareerTask }) {
  const active = task.status === 'active'
  const completed = task.status === 'completed'
  return (
    <div className={`task-row${active ? ' is-active' : completed ? ' is-completed' : ''}`}>
      <span className="tk-status" aria-label={task.status} />
      <div className="tk-body">
        <strong>{task.title}</strong>
        {task.handoff ? (
          <div className="handoff-detail">
            <span className="handoff-flow">
              {agentLabel[task.handoff.fromAgent]}
              <ArrowRight size={13} className="hf-arrow" />
              {agentLabel[task.handoff.toAgent]}
            </span>
            <p>{task.handoff.objective}</p>
            <div className="handoff-meta">
              <span className="handoff-tag">目标产物：{task.handoff.expectedArtifact}</span>
              <span className="handoff-tag">{task.handoff.memoryRefs.length} 条记忆引用</span>
              <span className="handoff-tag">{task.handoff.permissions.length} 项权限</span>
            </div>
          </div>
        ) : (
          <small>{active ? '当前进行中' : completed ? '已完成' : task.status}</small>
        )}
      </div>
      <span className="tk-owner">{agentLabel[task.ownerAgent]}</span>
    </div>
  )
}
