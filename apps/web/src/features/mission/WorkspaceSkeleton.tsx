/**
 * Skeleton placeholder blocks shaped like the real workspace layout.
 * Lets users see structure during load instead of a generic spinner.
 * Pure CSS shimmer — no external dependency.
 */
export function WorkspaceSkeleton() {
  return (
    <div className="app-shell" aria-busy="true" aria-label="正在加载职业工作区">
      <SidebarSkeleton />
      <main className="app-main">
        <div className="topbar">
          <div className="mission-heading">
            <div className="skeleton skeleton-mark" />
            <div className="skeleton skeleton-text skeleton-heading" />
          </div>
          <div className="topbar-actions">
            <div className="skeleton skeleton-chip" />
            <div className="skeleton skeleton-square" />
          </div>
        </div>

        <div className="workspace">
          <div className="agent-strip">
            {[0, 1, 2].map((i) => (
              <div className="skeleton skeleton-agent" key={i} />
            ))}
          </div>

          <section className="mission-overview panel">
            <div className="overview-copy">
              <div className="skeleton skeleton-kicker" />
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line short" />
            </div>
            <div className="overview-meta">
              {[0, 1, 2].map((i) => (
                <div className="skeleton skeleton-meta-cell" key={i} />
              ))}
            </div>
            <div className="stage-rail">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div className="skeleton skeleton-stage" key={i} />
              ))}
            </div>
          </section>

          <div className="workspace-grid">
            <div className="primary-column">
              <section className="next-action panel">
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-action-body" />
              </section>
              <div className="artifact-grid">
                {[0, 1, 2].map((i) => (
                  <div className="skeleton skeleton-artifact" key={i} />
                ))}
              </div>
              <div className="skeleton skeleton-trace" />
            </div>
            <aside className="side-column">
              <div className="skeleton skeleton-side-card" />
              <div className="skeleton skeleton-side-card" />
              <div className="skeleton skeleton-side-card" />
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}

function SidebarSkeleton() {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="skeleton skeleton-brand" />
        <div className="skeleton skeleton-text" />
      </div>
      <nav>
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="skeleton skeleton-nav-item" key={i} />
        ))}
      </nav>
    </aside>
  )
}
