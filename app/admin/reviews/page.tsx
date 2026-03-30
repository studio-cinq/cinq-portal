import { createServerComponentClient } from "@/lib/supabase-server"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

const STATUS_LABELS: Record<string, string> = {
  in_review: "In review",
  revising: "Revising",
  approved: "Approved",
}
const STATUS_COLORS: Record<string, string> = {
  in_review: "var(--amber)",
  revising: "var(--ink)",
  approved: "var(--sage)",
}

export default async function AdminReviewsPage() {
  const supabase = await createServerComponentClient()
  const { data: sessions } = await supabase
    .from("review_sessions")
    .select("*, clients(name, contact_name), projects(title)")
    .order("created_at", { ascending: false })

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 960, margin: "0 auto", padding: "40px 48px 80px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 14 }}>
              Reviews
            </div>
            <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 26, opacity: 0.88, letterSpacing: "-0.015em", margin: 0 }}>
              Website reviews
            </h1>
          </div>
          <Link href="/admin/reviews/new" style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
            background: "var(--ink)", color: "var(--cream)", padding: "12px 22px", textDecoration: "none",
          }}>
            + New review
          </Link>
        </div>

        {(!sessions || sessions.length === 0) ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, opacity: 0.5, marginBottom: 8 }}>No reviews yet.</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.35, lineHeight: 1.7 }}>
              Create a review to get client feedback on a website with pin annotations.
            </div>
          </div>
        ) : (
          <div>
            {sessions.map((s: any) => {
              const client = s.clients as any
              const project = s.projects as any
              return (
                <Link key={s.id} href={`/admin/reviews/${s.id}`} style={{
                  display: "grid", gridTemplateColumns: "1fr 140px 100px 90px",
                  gap: 16, alignItems: "center", padding: "18px 0",
                  borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                  textDecoration: "none", color: "inherit",
                }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-full)" as any }}>
                      {project?.title ?? s.site_url}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any, marginTop: 2 }}>
                      {client?.name ?? "—"}
                      {s.viewed_at && <span style={{ color: "var(--sage)", marginLeft: 8, opacity: 0.7 }}>· viewed</span>}
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4 }}>
                    Round {s.current_round}
                  </div>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", textTransform: "uppercase",
                    color: STATUS_COLORS[s.status] ?? "var(--ink)", opacity: s.status === "approved" ? 0.7 : 0.85,
                  }}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.35 }}>
                    {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
