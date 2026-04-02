export default function AdminLoading() {
  return (
    <div className="portal-loading-shell">
      <div className="portal-loading-nav" />
      <div className="portal-loading-body">
        <div className="portal-loading-hero portal-skeleton-shimmer" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520 }}>
          <div className="portal-loading-line portal-skeleton-shimmer" style={{ width: '80%' }} />
          <div className="portal-loading-line portal-skeleton-shimmer" style={{ width: '55%' }} />
          <div className="portal-loading-line portal-skeleton-shimmer" style={{ width: '68%' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
          <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: 200, height: 120, borderRadius: 10 }} />
          <div className="portal-loading-block portal-skeleton-shimmer" style={{ width: 200, height: 120, borderRadius: 10 }} />
        </div>
      </div>
    </div>
  );
}
