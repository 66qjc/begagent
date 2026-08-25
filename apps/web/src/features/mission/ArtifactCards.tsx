import { BriefcaseBusiness, FileCheck2 } from 'lucide-react'
import type { WorkspaceState } from '@career/core'

export function JobCard({ workspace }: { workspace: WorkspaceState }) {
  const job = workspace.jobs.at(-1)
  return (
    <article className="artifact-card job-card">
      <div className="artifact-icon"><BriefcaseBusiness size={18} /></div>
      <span>目标岗位</span>
      <h3>{job?.title ?? '等待岗位导入'}</h3>
      <p>{job ? `${job.company} · ${job.location}` : '导入 JD 后开始五层岗位判断。'}</p>
      {job ? <div className="artifact-footer"><strong>{job.analysis.recommendation === 'growth_application' ? '成长型投递' : job.analysis.recommendation}</strong><small>{job.analysis.gaps.length} 项待补证据</small></div> : null}
    </article>
  )
}

export function EvidenceCard({ workspace }: { workspace: WorkspaceState }) {
  const evidence = workspace.evidence.at(-1)
  return (
    <article className="artifact-card evidence-card">
      <div className="artifact-icon"><FileCheck2 size={18} /></div>
      <span>职业证据</span>
      <h3>{evidence?.title ?? '证据库尚未更新'}</h3>
      <p>{evidence?.summary ?? '完成成长任务后，真实成果会写入职业记忆。'}</p>
      <div className="artifact-footer"><strong>{workspace.evidence.length} 条已确认</strong><small>全部可追溯来源</small></div>
    </article>
  )
}

export function ResumeCard({ workspace }: { workspace: WorkspaceState }) {
  const resume = workspace.resumes.at(-1)
  return (
    <article className="artifact-card resume-card">
      <div className="artifact-icon"><FileCheck2 size={18} /></div>
      <span>岗位版简历</span>
      <h3>{resume?.headline ?? '等待新证据'}</h3>
      <p>{resume?.summary ?? '只有已确认事实与证据可以进入正式简历。'}</p>
      <div className="artifact-footer"><strong>{resume ? `版本 v${resume.version}` : '未生成'}</strong><small>{resume?.evidenceIds.length ?? 0} 条证据关联</small></div>
    </article>
  )
}
