import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import CopyLinkButton from "@/components/portal/CopyLinkButton"
import RowOverflowMenu from "@/components/portal/RowOverflowMenu"
import { statusColor } from "@/lib/status-tokens"

export default async function AdminQuotesPage() {
  const supabase = await createServerComponentClient()

  const { data: quotesRaw } = await supabase
    .from("quotes").select("id, title, status, expires_at, viewed_at, invoice_id, created_at, clients(name), quote_items(price)")
    .order("created_at", { ascending: false })
  const quotes = quotesRaw as any[] | null

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5 }}>
            Quotes — {quotes?.length ?? 0}
          </div>
          <Link href="/admin/quotes/new" style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--ink)", opacity: 0.6, textDecoration: "none",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
          }}>
            + New quote
          </Link>
        </div>

        <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px 100px 110px 90px 100px 60px", gap: 16, paddingBottom: 10, borderBottom: "0.5px solid rgba(15,15,14,0.12)" }}>
          {["Quote", "Client", "Total", "Expires", "Viewed", "Status", "", ""].map((h, i) => (
            <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45 }}>{h}</div>
          ))}
        </div>

        {quotes?.map(q => {
          const total = q.quote_items?.reduce((s: number, i: any) => s + (i.price ?? 0), 0) ?? 0
          const isExpired = q.expires_at && new Date(q.expires_at) < new Date()
          const confirmMsg = q.invoice_id
            ? `Delete "${q.title}"? This will also delete the linked invoice. Cannot be undone.`
            : `Delete "${q.title}"? This cannot be undone.`
          return (
            <div
              key={q.id}
              className="admin-proposal-row"
              style={{
                display: "grid", gridTemplateColumns: "1fr 160px 120px 100px 110px 90px 100px 60px",
                gap: 16, alignItems: "center", padding: "16px 0",
                borderBottom: "0.5px solid rgba(15,15,14,0.08)",
              }}
            >
              <Link href={`/admin/quotes/${q.id}`} style={{
                textDecoration: "none", color: "inherit",
                fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.88,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
              }}>
                {q.title}
              </Link>
              <div className="admin-client-col-hide" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.clients?.name}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.78 }}>${Math.round(total / 100).toLocaleString()}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: isExpired ? 0.4 : 0.6, color: isExpired ? "var(--danger)" : "var(--ink)" }}>
                {q.expires_at ? new Date(q.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)" }}>
                {q.viewed_at
                  ? <span style={{ color: "var(--sage)", opacity: 0.8 }}>{new Date(q.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  : <span style={{ opacity: 0.35 }}>Not yet</span>
                }
              </div>
              <QuoteStatus status={q.status} />
              <CopyLinkButton id={q.id} basePath="/quotes" />
              <RowOverflowMenu
                ariaLabel={`More actions for ${q.title}`}
                items={[
                  { kind: "link", label: "Edit", href: `/admin/quotes/${q.id}` },
                  { kind: "divider" },
                  { kind: "delete", endpoint: "/api/admin/delete/quote", id: q.id, confirm: confirmMsg },
                ]}
              />
            </div>
          )
        })}

        {(!quotes || quotes.length === 0) && (
          <div style={{ padding: "48px 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.5, textAlign: "center" }}>
            No quotes yet — <a href="/admin/quotes/new" style={{ opacity: 0.7, textDecoration: "none", borderBottom: "0.5px solid rgba(15,15,14,0.2)" }}>create your first quote</a>.
          </div>
        )}
      </main>
    </>
  )
}

function QuoteStatus({ status }: { status: string }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", textTransform: "uppercase", color: statusColor(status) }}>
      {status}
    </span>
  )
}
