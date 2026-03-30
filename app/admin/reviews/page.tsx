import { createServerComponentClient } from "@/lib/supabase-server"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

export default async function AdminReviewsPage() {
  const supabase = await createServerComponentClient()

  const { data: sessions } = await supabase
    .from("review_sessions")
    .select("*, clients(name, contact_name), projects(title)")
    .order("created_at", { ascending: false })

  const statusLabel: Record<string, string> = {
    in_review: "In review",
    revising: "Revising",
    approved: "Approved",
  }
  const statusColor: Record<string, string> = {
    in_review: "var(--amber)",
    revising: "var(--sage)",
    approved: "rgba(15,15,14,0.45)",
  }

  return (
    <>
      <PortalNav isAdmin />
      <main style={{ padding: "clamp(32px, 5vw, 48px)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
          <div>
            <p style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--ink)", opacity: "var(--op-faint)" as any, margin: "0 0 6px",
            }}>Website Reviews</p>
            <h1 style={{
              fontFamily: "var(--font-serif)", fontSize: "var(--text-title)",
              fontWeight: 400, color: "var(--ink)", opacity: "var(--op-full)" as any, margin: 0,
            }}>All Reviews</h1>
          </div>
          <Link href="/admin/reviews/new" style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.16em", textTransform: "uppercase",
            background: "var(--ink)", color: "#EDE8E0",
            padding: "12px 20px", textDecoration: "none",
          }}>
            New review
          </Link>
        </div>

        {/* List */}
        {!sessions || sessions.length === 0 ? (
          <p style={{
            fontFamily: "var(--font-serif)", fontSize: "var(--text-body)",
            color: "var(--ink)", opacity: "var(--op-muted)" as any,
          }}>No reviews yet. Create one to get started.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {sessions.map((s: any) => (
              <Link
                key={s.id}
                href={`/admin/reviews/${s.id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr auto auto",
                  gap: 24,
                  alignItems: "center",
                  padding: "16px 0",
                  borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                  textDecoration: "none",
                  color: "var(--ink)",
                  transition: "opacity 0.2s",
                }}
              >
                {/* Client + Project */}
                <div>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                    opacity: "var(--op-full)" as any, margin: 0,
                  }}>{s.clients?.name ?? "—"}</p>
                  <p style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    opacity: "var(--op-faint)" as any, margin: "4px 0 0",
                  }}>{s.projects?.title ?? "—"}</p>
                </div>

                {/* Site URL */}
                <p style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  opacity: "var(--op-muted)" as any, margin: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{s.site_url}</p>

                {/* Round */}
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  opacity: "var(--op-muted)" as any,
                }}>Round {s.current_round}</span>

                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: statusColor[s.status] ?? "var(--ink)",
                  }} />
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    opacity: "var(--op-muted)" as any,
                  }}>{statusLabel[s.status] ?? s.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
