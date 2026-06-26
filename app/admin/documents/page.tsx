import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import CopyLinkButton from "@/components/portal/CopyLinkButton"
import RowOverflowMenu from "@/components/portal/RowOverflowMenu"
import { statusColor } from "@/lib/status-tokens"

/**
 * Unified Documents list across proposals, quotes, and plans. The three
 * source tables stay put — each row links to the existing type-specific
 * detail page. This is purely a UI wrapper so the nav collapses to one
 * "Documents" link and the lifecycle (sent → viewed → accepted) reads
 * the same regardless of type.
 */

type DocType = "proposal" | "quote" | "plan"
const TYPES: DocType[] = ["proposal", "quote", "plan"]
const TYPE_LABEL: Record<DocType, string> = {
  proposal: "Proposal",
  quote:    "Quote",
  plan:     "Plan",
}

type DocRow = {
  id: string
  type: DocType
  title: string
  clientName: string
  value: number | null     // total in cents, or null when type has no monetary value (plans)
  status: string
  lastSentAt: string | null
  viewedAt: string | null
  expiresAt: string | null
  detailHref: string
  shareBasePath: string    // for CopyLinkButton
  deleteEndpoint: string
  confirmCopy: string
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams?: { type?: string }
}) {
  const supabase = await createServerComponentClient()
  const requested = searchParams?.type
  const activeType: DocType | "all" = TYPES.includes(requested as DocType) ? (requested as DocType) : "all"

  const [
    { data: proposalsRaw },
    { data: quotesRaw },
    { data: plansRaw },
  ] = await Promise.all([
    supabase.from("proposals")
      .select("id, title, status, expires_at, viewed_at, last_sent_at, created_at, client_id, clients(name), proposal_items(price)")
      .order("last_sent_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("quotes")
      .select("id, title, status, expires_at, viewed_at, last_sent_at, created_at, client_id, invoice_id, clients(name), quote_items(price)")
      .order("last_sent_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("plans")
      .select("id, title, status, viewed_at, last_sent_at, created_at, client_id, clients(name)")
      .order("last_sent_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ])

  const rows: DocRow[] = []

  for (const p of (proposalsRaw ?? []) as any[]) {
    const total = (p.proposal_items ?? []).reduce((s: number, i: any) => s + (i.price ?? 0), 0)
    rows.push({
      id: p.id,
      type: "proposal",
      title: p.title ?? "Untitled proposal",
      clientName: p.clients?.name ?? "—",
      value: total,
      status: p.status,
      lastSentAt: p.last_sent_at ?? null,
      viewedAt: p.viewed_at ?? null,
      expiresAt: p.expires_at ?? null,
      detailHref: `/admin/proposals/${p.id}`,
      shareBasePath: "/proposals",
      deleteEndpoint: "/api/admin/delete/proposal",
      confirmCopy: `Delete "${p.title}"? This cannot be undone.`,
    })
  }

  for (const q of (quotesRaw ?? []) as any[]) {
    const total = (q.quote_items ?? []).reduce((s: number, i: any) => s + (i.price ?? 0), 0)
    const confirmCopy = q.invoice_id
      ? `Delete "${q.title}"? This will also delete the linked invoice. Cannot be undone.`
      : `Delete "${q.title}"? This cannot be undone.`
    rows.push({
      id: q.id,
      type: "quote",
      title: q.title ?? "Untitled quote",
      clientName: q.clients?.name ?? "—",
      value: total,
      status: q.status,
      lastSentAt: q.last_sent_at ?? null,
      viewedAt: q.viewed_at ?? null,
      expiresAt: q.expires_at ?? null,
      detailHref: `/admin/quotes/${q.id}`,
      shareBasePath: "/quotes",
      deleteEndpoint: "/api/admin/delete/quote",
      confirmCopy,
    })
  }

  for (const pl of (plansRaw ?? []) as any[]) {
    rows.push({
      id: pl.id,
      type: "plan",
      title: pl.title ?? "Untitled plan",
      clientName: pl.clients?.name ?? "—",
      value: null,
      status: pl.status,
      lastSentAt: pl.last_sent_at ?? null,
      viewedAt: pl.viewed_at ?? null,
      expiresAt: null,
      detailHref: `/admin/plans/${pl.id}/edit`,
      shareBasePath: "/plan",
      deleteEndpoint: "/api/admin/delete/plan",
      confirmCopy: `Delete "${pl.title}"? This cannot be undone.`,
    })
  }

  // Sort the unified list by last_sent_at desc, falling back to created.
  rows.sort((a, b) => {
    const ka = a.lastSentAt ? new Date(a.lastSentAt).getTime() : 0
    const kb = b.lastSentAt ? new Date(b.lastSentAt).getTime() : 0
    return kb - ka
  })

  // Counts per type — independent of the active filter so the tabs read
  // the studio's full state, not just what's visible.
  const counts: Record<DocType | "all", number> = {
    all:      rows.length,
    proposal: rows.filter(r => r.type === "proposal").length,
    quote:    rows.filter(r => r.type === "quote").length,
    plan:     rows.filter(r => r.type === "plan").length,
  }

  const visible = activeType === "all" ? rows : rows.filter(r => r.type === activeType)

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5 }}>
            Documents
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TYPES.map(t => (
              <Link key={t} href={`/admin/${t === "plan" ? "plans" : t + "s"}/new`} style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                letterSpacing: "0.12em", textTransform: "uppercase",
                color: "var(--ink)", opacity: 0.6, textDecoration: "none",
                border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 12px",
              }}>
                + {TYPE_LABEL[t]}
              </Link>
            ))}
          </div>
        </div>

        {/* Filter tabs — type filter */}
        <div role="tablist" style={{ display: "flex", alignItems: "center", gap: 26, borderBottom: "0.5px solid rgba(15,15,14,0.1)", paddingBottom: 0, marginBottom: 4 }}>
          {(["all", ...TYPES] as const).map(tab => {
            const active = tab === activeType
            const href = tab === "all" ? "/admin/documents" : `/admin/documents?type=${tab}`
            const label = tab === "all" ? "All" : `${TYPE_LABEL[tab]}s`
            return (
              <Link
                key={tab}
                role="tab"
                aria-selected={active}
                href={href}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: active ? "var(--ink)" : "rgba(15,15,14,0.45)",
                  textDecoration: "none",
                  padding: "10px 0",
                  borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {label} <span style={{ opacity: 0.5 }}>· {counts[tab]}</span>
              </Link>
            )
          })}
        </div>

        {/* Header */}
        <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "1fr 100px 130px 100px 110px 100px 60px", gap: 16, paddingTop: 16, paddingBottom: 10, borderBottom: "0.5px solid rgba(15,15,14,0.12)" }}>
          {["Document", "Type", "Value", "Status", "Sent", "", ""].map((h, i) => (
            <div key={`${h}-${i}`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45 }}>{h}</div>
          ))}
        </div>

        {visible.length === 0 && (
          <div style={{ padding: "72px 0", textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 14, color: "rgba(15,15,14,0.5)" }}>
            {activeType === "all" && "No documents yet."}
            {activeType === "proposal" && "No proposals yet."}
            {activeType === "quote"    && "No quotes yet."}
            {activeType === "plan"     && "No plans yet."}
          </div>
        )}

        {visible.map(row => (
          <div
            key={`${row.type}-${row.id}`}
            className="admin-proposal-row"
            style={{
              display: "grid", gridTemplateColumns: "1fr 100px 130px 100px 110px 100px 60px",
              gap: 16, alignItems: "center", padding: "16px 0",
              borderBottom: "0.5px solid rgba(15,15,14,0.08)",
            }}
          >
            <Link href={row.detailHref} style={{
              textDecoration: "none", color: "inherit", minWidth: 0, overflow: "hidden",
            }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.title}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-eyebrow)", opacity: 0.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.clientName}
              </div>
            </Link>

            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.55 }}>
              {TYPE_LABEL[row.type]}
            </div>

            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.85 }}>
              {row.value == null ? "—" : `$${Math.round(row.value / 100).toLocaleString()}`}
            </div>

            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", textTransform: "uppercase", color: statusColor(row.status) }}>
              {row.status}
            </div>

            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.55 }}>
              {row.lastSentAt ? new Date(row.lastSentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
              {row.viewedAt && (
                <div style={{ color: "var(--complete)", opacity: 0.85, marginTop: 2 }}>
                  Viewed {new Date(row.viewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              )}
            </div>

            <CopyLinkButton id={row.id} basePath={row.shareBasePath} />

            <RowOverflowMenu
              ariaLabel={`More actions for ${row.title}`}
              items={[
                { kind: "link", label: "Edit", href: row.detailHref },
                { kind: "divider" },
                { kind: "delete", endpoint: row.deleteEndpoint, id: row.id, confirm: row.confirmCopy },
              ]}
            />
          </div>
        ))}
      </main>
    </>
  )
}
