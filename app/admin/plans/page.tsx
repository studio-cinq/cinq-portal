import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import CopyLinkButton from "@/components/portal/CopyLinkButton"
import DeleteButton from "@/components/portal/DeleteButton"
import { statusColor } from "@/lib/status-tokens"

const mono = { fontFamily: "var(--font-mono)" } as const
const sans = { fontFamily: "var(--font-sans)" } as const

export default async function AdminPlansPage() {
  const supabase = await createServerComponentClient()

  const { data: plansRaw } = await supabase
    .from("plans")
    .select("id, title, status, created_at, last_sent_at, viewed_at, clients(name)")
    .order("created_at", { ascending: false })

  const plans = (plansRaw ?? []) as any[]

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 32 }}>
          <div>
            <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5 }}>
              Direction Plans — {plans.length}
            </div>
            <div style={{ ...mono, fontSize: 10, letterSpacing: "0.08em", opacity: 0.4, marginTop: 6, maxWidth: 480 }}>
              Working guides for existing clients. Less &ldquo;hire me,&rdquo; more &ldquo;here&rsquo;s the road map.&rdquo;
            </div>
          </div>
          <Link href="/admin/plans/new" style={{
            ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--ink)", opacity: 0.6, textDecoration: "none",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
          }}>
            + New plan
          </Link>
        </div>

        {plans.length === 0 ? (
          <div style={{ ...sans, fontSize: 16, opacity: 0.4, fontStyle: "italic", padding: "60px 0", textAlign: "center" }}>
            No direction plans yet — <Link href="/admin/plans/new" style={{ opacity: 0.7, textDecoration: "none", borderBottom: "0.5px solid rgba(15,15,14,0.2)" }}>create your first one</Link>.
          </div>
        ) : (
          <>
            <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "1fr 180px 120px 110px 100px 60px", gap: 16, paddingBottom: 10, borderBottom: "0.5px solid rgba(15,15,14,0.12)" }}>
              {["Plan", "Client", "Status", "Sent", "", ""].map((h, i) => (
                <div key={i} style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45 }}>{h}</div>
              ))}
            </div>
            {plans.map(p => (
              <div key={p.id} className="admin-proposal-row" style={{
                display: "grid", gridTemplateColumns: "1fr 180px 120px 110px 100px 60px", gap: 16,
                alignItems: "center", padding: "16px 0",
                borderBottom: "0.5px solid rgba(15,15,14,0.08)",
              }}>
                <Link href={`/admin/plans/${p.id}/edit`} style={{
                  ...sans, fontSize: "var(--text-body)", opacity: 0.88, textDecoration: "none", color: "inherit",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
                }}>
                  {p.title}
                </Link>
                <div className="admin-client-col-hide" style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.clients?.name ?? "—"}</div>
                <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", color: statusColor(p.status) }}>
                  {p.status}
                </div>
                <div style={{ ...mono, fontSize: 10, letterSpacing: "0.08em", opacity: 0.5 }}>
                  {p.last_sent_at ? new Date(p.last_sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                </div>
                <CopyLinkButton id={p.id} basePath="/plan" />
                <DeleteButton endpoint="/api/admin/delete/plan" id={p.id} confirm={`Delete "${p.title}"? This cannot be undone.`} />
              </div>
            ))}
          </>
        )}
      </main>
    </>
  )
}
