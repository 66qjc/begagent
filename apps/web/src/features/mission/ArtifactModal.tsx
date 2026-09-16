import { X, BriefcaseBusiness, FileCheck2, Sparkles, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react'
import type { WorkspaceState } from '@career/core'

export interface ArtifactModalProps {
  type: 'job' | 'evidence' | 'resume' | null
  workspace: WorkspaceState
  onClose(): void
}

export function ArtifactModal({ type, workspace, onClose }: ArtifactModalProps) {
  if (!type) return null

  const job = workspace.jobs.at(-1)
  const evidence = workspace.evidence
  const resume = workspace.resumes.at(-1)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={onClose}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-lockup">
            {type === 'job' && <BriefcaseBusiness className="modal-icon text-accent" size={22} />}
            {type === 'evidence' && <FileCheck2 className="modal-icon text-ok" size={22} />}
            {type === 'resume' && <Sparkles className="modal-icon text-amber" size={22} />}
            <div>
              <span className="modal-subtitle">
                {type === 'job' && '目标岗位全景'}
                {type === 'evidence' && '真实职业素材与证据'}
                {type === 'resume' && '岗位定制化正式简历'}
              </span>
              <h2 id="modal-title">
                {type === 'job' && (job ? `${job.title} · ${job.company}` : '岗位详情')}
                {type === 'evidence' && `职业素材与能力证据 (${evidence.length} 条已确认)`}
                {type === 'resume' && (resume ? `简历版本 v${resume.version} · ${resume.headline}` : '定制简历')}
              </h2>
            </div>
          </div>
          <button className="modal-close-button" onClick={onClose} aria-label="关闭详情">
            <X size={18} />
          </button>
        </div>

        <div className="modal-content">
          {type === 'job' && (
            <div className="modal-job-body">
              {job ? (
                <>
                  <div className="detail-badge-row">
                    <span className="detail-chip highlight">{job.company}</span>
                    <span className="detail-chip">{job.location}</span>
                    <span className={`detail-chip status-${job.analysis.recommendation === 'growth_application' ? 'growth' : 'direct'}`}>
                      {job.analysis.recommendation === 'growth_application' ? '推荐成长型投递 (先补强证据)' : '推荐直接投递'}
                    </span>
                    <span className="detail-chip">证据强度：{job.analysis.evidenceStrength || '待评估'}</span>
                  </div>

                  <div className="modal-section">
                    <h3>岗位分析结论</h3>
                    <p className="modal-lead">{job.analysis.summary || '已通过分析引擎对硬性门槛、成长价值与竞争力进行全景判断。'}</p>
                  </div>

                  <div className="modal-section">
                    <h3>待突破差距与能力短板 ({job.analysis.gaps.length} 项)</h3>
                    <div className="gap-cards-grid">
                      {job.analysis.gaps.map((gap, i) => (
                        <div key={i} className="gap-card">
                          <span className="gap-index">0{i + 1}</span>
                          <p>{gap}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="modal-section">
                    <h3>原始 JD 需求说明</h3>
                    <div className="jd-box">
                      <p>{job.description}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="quiet-copy">暂无岗位数据</p>
              )}
            </div>
          )}

          {type === 'evidence' && (
            <div className="modal-evidence-body">
              <div className="evidence-summary-banner">
                <ShieldCheck size={20} className="text-ok" />
                <div>
                  <strong>可信赖证据体系</strong>
                  <p>所有进入简历和申请的成果均通过事实与来源检验，杜绝虚构经历。</p>
                </div>
              </div>

              <div className="evidence-cards-container">
                {evidence.map((item, idx) => (
                  <div key={item.id} className="evidence-detail-card">
                    <div className="ed-header">
                      <div className="ed-title">
                        <span className="ed-badge">证据 #{idx + 1}</span>
                        <h4>{item.title}</h4>
                      </div>
                      <span className="confirmed-pill"><CheckCircle2 size={13} /> 已确认事实</span>
                    </div>
                    <p className="ed-summary">{item.summary}</p>
                    <div className="ed-meta">
                      <span>来源通道：<code>{item.source}</code></span>
                      {item.proofUrl ? (
                        <a href={item.proofUrl} target="_blank" rel="noreferrer" className="proof-link">
                          查看成果源文件与代码库 <ExternalLink size={12} />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {type === 'resume' && (
            <div className="modal-resume-body">
              {resume ? (
                <div className="resume-sheet">
                  <div className="resume-sheet-header">
                    <div className="rsh-meta">
                      <span className="resume-version-pill">v{resume.version} 申请就绪版</span>
                      <span>关联 {resume.evidenceIds.length} 条已核实证据</span>
                    </div>
                    <h2>{resume.headline}</h2>
                    <p className="rsh-summary">{resume.summary}</p>
                  </div>

                  {resume.sections.map((sec, secIdx) => (
                    <div key={secIdx} className="resume-sheet-section">
                      <div className="rss-heading">
                        <h3>{sec.title}</h3>
                        {sec.role ? <span className="rss-role">{sec.role}</span> : null}
                        {(sec.startDate || sec.endDate) && (
                          <span className="rss-dates">{sec.startDate} ~ {sec.endDate || '至今'}</span>
                        )}
                      </div>
                      <div className="rss-bullets">
                        {sec.bullets.map((b, bIdx) => (
                          <div key={bIdx} className="rss-bullet-item">
                            <div className="rss-bullet-content">
                              <span className={`verb-tag verb-${b.verbTier}`}>{b.verbTier}</span>
                              <p dangerouslySetInnerHTML={{ __html: b.text.replace(/\*\*(.+?)：\*\*/g, '<strong>$1：</strong>') }} />
                            </div>
                            {b.metrics && b.metrics.length > 0 && (
                              <div className="rss-metrics-row">
                                {b.metrics.map((m, mIdx) => (
                                  <span key={mIdx} className="metric-pill">
                                    {m.qualifier ? `${m.qualifier} ` : ''}<strong>{m.value}</strong> ({m.dimension})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {resume.skills.length > 0 && (
                    <div className="resume-sheet-section">
                      <div className="rss-heading">
                        <h3>专业技能矩阵</h3>
                      </div>
                      <div className="rss-skills-grid">
                        {resume.skills.map((grp, grpIdx) => (
                          <div key={grpIdx} className="rss-skill-row">
                            <span className="rss-skill-name">{grp.name}</span>
                            <div className="rss-skill-tags">
                              {grp.keywords.map((k, kIdx) => (
                                <span key={kIdx} className="rss-kw-tag">{k}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="quiet-copy">暂无定制简历数据</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
