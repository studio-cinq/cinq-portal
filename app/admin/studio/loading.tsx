export default function StudioLoading() {
  return (
    <div className="portal-loading-shell">
      <div className="portal-loading-nav" />
      <div className="portal-loading-body">
        {/* Utility row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div className="portal-loading-line portal-skeleton-shimmer" style={{ width: 180, height: 24 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: 120, height: 34, borderRadius: 8 }} />
            <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: 34, height: 34, borderRadius: 8 }} />
          </div>
        </div>

        {/* Two-column top band: attention + revenue */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 36 }}>
          <div className="portal-loading-block portal-skeleton-shimmer" style={{ flex: 1, height: 150, borderRadius: 12 }} />
          <div className="portal-loading-block portal-skeleton-shimmer" style={{ flex: 1, height: 150, borderRadius: 12 }} />
        </div>

        {/* Client list header */}
        <div className="portal-loading-line portal-skeleton-shimmer" style={{ width: 100, height: 14, marginBottom: 16 }} />

        {/* Client list lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
              <div className="portal-loading-line portal-skeleton-shimmer" style={{ width: `${50 + (i * 7) % 30}%`, height: 14 }} />
              <div style={{ marginLeft: 'auto' }}>
                <div className="portal-loading-line portal-skeleton-shimmer" style={{ width: 60, height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
