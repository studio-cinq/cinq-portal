export default function Loading() {
  return (
    <main className="portal-loading-shell">
      <div className="portal-loading-nav" />

      <div className="portal-loading-body">
        <div className="portal-loading-hero portal-skeleton-shimmer" />

        <div className="portal-loading-grid">
          <div className="portal-loading-column">
            <div className="portal-loading-line portal-skeleton-shimmer" style={{ width: "18%" }} />
            <div className="portal-loading-block portal-skeleton-shimmer" />
            <div className="portal-loading-block portal-skeleton-shimmer" />
          </div>

          <div className="portal-loading-column">
            <div className="portal-loading-line portal-skeleton-shimmer" style={{ width: "32%" }} />
            <div className="portal-loading-block portal-skeleton-shimmer" />
          </div>
        </div>
      </div>
    </main>
  )
}
