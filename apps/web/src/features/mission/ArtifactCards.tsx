import { BriefcaseBusiness, FileCheck2, TrendingUp, ExternalLink, Maximize2, ShieldCheck, Sparkles } from 'lucide-react'
import type { ResumeVersion, WorkspaceState } from '@career/core'

export function JobCard({ workspace, onInspect }: { workspace: WorkspaceState; onInspect?: (type: 'job') => void }) {
  const job = workspace.jobs.at(-1)
  const hasAnalysis = job ? job.analysis.recommendation !== '' : false
  return (
    <article className="artifact-card job-card">
      <div className="artifact-card-header">
        <div className="ach-left">
          <span className="artifact-icon"><BriefcaseBusiness size={16} /></span>
          <span className="artifact-label">目标岗位</span>
        </div>
        {job ? (
          <button className="card-inspect-btn" onClick={() => onInspect?.('job')} title="查看岗位画像全貌">
            <Maximize2 size={13} />
            <span>全景</span>
          </button>
        ) : null}
      </div>

      <div className="card-primary-title">
        <h3>{job?.title ?? '等待岗位导入'}</h3>
        <p className="card-subhead">{job ? `${job.company} · ${job.location}` : '导入 JD 后开始五层岗位判断。'}</p>
      </div>

      {job && hasAnalysis ? (
        <div className="job-detail">
          <div className="recommendation-banner">
            <span className={`analysis-tag ${job.analysis.recommendation === 'growth_application' ? 'growth' : 'direct'}`}>
              <TrendingUp size={13} />
              {job.analysis.recommendation === 'growth_application' ? '成长型投递' : '直接投递'}
            </span>
            <span className="rec-hint">
              {job.analysis.recommendation === 'growth_application' ? '建议先补强证据短板' : '已具备较高匹配度'}
            </span>
          </div>

          {job.analysis.summary ? <p className="analysis-summary">{job.analysis.summary}</p> : null}

          {job.analysis.gaps.length > 0 ? (
            <div className="gaps-preview">
              <span className="gaps-label">关键待补差距 ({job.analysis.gaps.length})</span>
              <ul className="gap-list">
                {job.analysis.gaps.map((gap, i) => (
                  <li key={i} className="gap-item">
                    <span className="gap-dot" />
                    <span className="gap-text">{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {job.analysis.evidenceStrength ? (
            <div className="artifact-footer">
              <div className="af-left">
                <span className="strength-label">证据强度：</span>
                <strong>{job.analysis.evidenceStrength}</strong>
              </div>
              <small className="af-right-chip">{job.analysis.gaps.length} 项待补</small>
            </div>
          ) : null}
        </div>
      ) : job ? (
        <div className="artifact-footer">
          <strong>待判断</strong>
          <small>{job.analysis.gaps.length} 项待补证据</small>
        </div>
      ) : null}
    </article>
  )
}

export function EvidenceCard({ workspace, onInspect }: { workspace: WorkspaceState; onInspect?: (type: 'evidence') => void }) {
  const evidence = workspace.evidence
  const latest = evidence.at(-1)
  return (
    <article className="artifact-card evidence-card">
      <div className="artifact-card-header">
        <div className="ach-left">
          <span className="artifact-icon"><FileCheck2 size={16} /></span>
          <span className="artifact-label">职业证据</span>
        </div>
        {evidence.length > 0 ? (
          <button className="card-inspect-btn" onClick={() => onInspect?.('evidence')} title="查看全部证据链">
            <Maximize2 size={13} />
            <span>证据库</span>
          </button>
        ) : null}
      </div>

      <div className="card-primary-title">
        <h3>{latest?.title ?? '证据库尚未更新'}</h3>
        <p className="card-subhead">{latest?.summary ?? '完成成长任务后，真实成果会写入职业记忆。'}</p>
      </div>

      {latest?.proofUrl ? (
        <a href={latest.proofUrl} className="artifact-footer proof-banner-link" style={{ textDecoration: 'none' }}>
          <div className="af-left">
            <ShieldCheck size={14} className="text-ok" />
            <strong>查看成果证明</strong>
          </div>
          <ExternalLink size={12} />
        </a>
      ) : null}

      {evidence.length > 1 ? (
        <div className="evidence-list">
          {evidence.slice(0, -1).map((item) => (
            <div className="evidence-item" key={item.id}>
              <FileCheck2 size={14} className="ev-icon" />
              <div className="ev-body">
                <strong>{item.title}</strong>
                <small>{item.summary}</small>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="artifact-footer">
        <div className="af-left">
          <ShieldCheck size={13} className="text-ok" />
          <strong>{evidence.length} 条已确认</strong>
        </div>
        <small className="af-right-chip">全部可追溯来源</small>
      </div>
    </article>
  )
}

const verbTierColor: Record<string, string> = {
  '主导': 'verb-tier-lead',
  '推动': 'verb-tier-drive',
  '负责': 'verb-tier-own',
  '参与': 'verb-tier-participate',
  '协助': 'verb-tier-assist',
  '支持': 'verb-tier-support',
}

function formatMetrics(metrics: ResumeVersion['sections'][number]['bullets'][number]['metrics']): string {
  if (!metrics || metrics.length === 0) return ''
  return metrics.map((m) => {
    const qualifier = m.qualifier ? `${m.qualifier} ` : ''
    return `${qualifier}${m.value}（${m.dimension}）`
  }).join(' · ')
}

function ResumeSectionView({ section }: { section: ResumeVersion['sections'][number] }) {
  return (
    <div className="resume-section">
      <div className="resume-section-header">
        <h4>{section.title}</h4>
        {section.role ? <span className="resume-role">{section.role}</span> : null}
        {section.startDate || section.endDate ? (
          <span className="resume-period">{section.startDate ?? ''} — {section.endDate ?? '至今'}</span>
        ) : null}
      </div>
      <ul className="resume-bullets">
        {section.bullets.map((bullet, i) => (
          <li key={i} className="resume-bullet-item">
            <span className="resume-bullet-text" dangerouslySetInnerHTML={{ __html: bullet.text.replace(/\*\*(.+?)：\*\*/g, '<strong>$1：</strong>') }} />
            <div className="resume-bullet-meta">
              <span className={`verb-tier-badge ${verbTierColor[bullet.verbTier] ?? ''}`}>{bullet.verbTier}</span>
              {bullet.metrics && bullet.metrics.length > 0 ? (
                <span className="resume-metrics">{formatMetrics(bullet.metrics)}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ResumeCard({ workspace, onInspect }: { workspace: WorkspaceState; onInspect?: (type: 'resume') => void }) {
  const resume = workspace.resumes.at(-1)
  if (!resume) {
    return (
      <article className="artifact-card resume-card">
        <div className="artifact-card-header">
          <div className="ach-left">
            <span className="artifact-icon"><FileCheck2 size={16} /></span>
            <span className="artifact-label">岗位版简历</span>
          </div>
        </div>
        <div className="card-primary-title">
          <h3>等待新证据</h3>
          <p className="card-subhead">只有已确认事实与证据可以进入正式简历。</p>
        </div>
        <div className="artifact-footer">
          <strong>未生成</strong>
          <small className="af-right-chip">0 条证据关联</small>
        </div>
      </article>
    )
  }

  return (
    <article className="artifact-card resume-card resume-preview">
      <div className="artifact-card-header">
        <div className="ach-left">
          <span className="artifact-icon"><FileCheck2 size={16} /></span>
          <span className="artifact-label">岗位版简历</span>
        </div>
        <button className="card-inspect-btn highlight" onClick={() => onInspect?.('resume')} title="全屏预览与打印视图">
          <Sparkles size={13} />
          <span>预览全貌</span>
        </button>
      </div>

      <div className="card-primary-title">
        <div className="resume-headline-row">
          <h3>{resume.headline}</h3>
          <span className="version-pill">v{resume.version} 申请就绪</span>
        </div>
        <p className="resume-summary">{resume.summary}</p>
      </div>

      {resume.sections.length > 0 ? (
        <div className="resume-sections">
          {resume.sections.map((section, i) => (
            <ResumeSectionView key={i} section={section} />
          ))}
        </div>
      ) : null}

      {resume.skills.length > 0 ? (
        <div className="resume-skills">
          {resume.skills.map((group, i) => (
            <div key={i} className="resume-skill-group">
              <strong>{group.name}</strong>
              <span>{group.keywords.join(' · ')}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="artifact-footer">
        <div className="af-left">
          <Sparkles size={13} className="text-amber" />
          <strong>版本 v{resume.version}</strong>
        </div>
        <small className="af-right-chip">{resume.evidenceIds.length} 条证据关联</small>
      </div>
    </article>
  )
}

