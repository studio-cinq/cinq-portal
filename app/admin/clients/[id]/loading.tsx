export default function ClientWorkspaceLoading() {
  return (
    <div className="portal-loading-shell">
      <div className="portal-loading-nav" />
      <div className="portal-loading-body">
        {/* Client header: name + action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="portal-loading-line portal-skeleton-shimmer" style={{ width: 220, height: 28 }} />
            <div className="portal-loading-line portal-skeleton-shimmer" style={{ width: 140, height: 14 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: 100, height: 36, borderRadius: 8 }} />
            <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: 100, height: 36, borderRadius: 8 }} />
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: 12, marginBottom: 28 }}>
          {[90, 70, 80, 60].map((w, i) => (
            <div key={i} className="portal-loading-line portal-skeleton-shimmer" style={{ width: w, height: 14 }} />
          ))}
        </div>

        {/* Two-column layout: main + sidebar */}
        <div style={{ display: 'flex', gap: 32 }}>
          {/* Main column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: '100%', height: 160, borderRadius: 10 }} />
            <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: '100%', height: 120, borderRadius: 10 }} />
            <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: '100%', height: 100, borderRadius: 10 }} />
          </div>
          {/* Sidebar */}
          <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: '100%', height: 140, borderRadius: 10 }} />
            <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: '100%', height: 100, borderRadius: 10 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
