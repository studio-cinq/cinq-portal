import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" }
const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" }

const STATUS_LABELS: Record<string, string> = {
  proposal_sent:    "Proposal sent",
  active:           "Active",
  awaiting_client:  "Awaiting client",
  awaiting_payment: "Awaiting payment",
  on_hold:          "On hold",
  complete:         "Complete",
}

const STATUS_COLORS: Record<string, string> = {
  proposal_sent:    "var(--amber)",
  active:           "var(--sage)",
  awaiting_client:  "var(--amber)",
  awaiting_payment: "var(--amber)",
  on_hold:          "var(--amber)",
  complete:         "rgba(15,15,14,0.4)",
}

const FOCUS_LABELS: Record<string, string> = {
  focus_today: "In focus today",
  in_queue:    "In the queue",
}

const FILTER_ORDER = ["all", "active", "awaiting_client", "on_hold", "proposal_sent", "complete"] as const

function daysSince(d: string | null | undefined): number {
  if (!d) return Infinity
  const date = new Date(d)
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

function fmtAge(days: number): string {
  if (!isFinite(days)) return "—"
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default async function AdminProjectsPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = await createServerComponentClient()
  const activeFilter = (FILTER_ORDER as readonly string[]).includes(searchParams?.status ?? "")
    ? (searchParams.status as string)
    : "active"

  let query = supabase
    .from("projects")
    .select("id, title, status, focus_state, created_at, updated_at, clients(id, name)")
    .order("updated_at", { ascending: false })

  if (activeFilter !== "all") {
    query = query.eq("status", activeFilter)
  }

  const { data: projectsRaw } = await query
  const projects = (projectsRaw ?? []) as any[]

  // Compute counts per status for the filter chips
  const { data: allProjects } = await supabase.from("projects").select("status")
  const counts: Record<string, number> = { all: allProjects?.length ?? 0 }
  for (const p of allProjects ?? []) {
    counts[p.status] = (counts[p.status] ?? 0) + 1
  }

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 32 }}>
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5 }}>
            Projects — {projects.length}
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32, paddingBottom: 20, borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
          {FILTER_ORDER.map(key => {
            const isActive = activeFilter === key
            const label = key === "all" ? "All" : (STATUS_LABELS[key] ?? key)
            const count = counts[key] ?? 0
            return (
              <Link
                key={key}
                href={`/admin/projects${key === "all" ? "" : `?status=${key}`}`}
                style={{
                  ...mono,
                  fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
                  padding: "7px 12px",
                  background: isActive ? "var(--ink)" : "transparent",
                  color: isActive ? "var(--cream)" : "var(--ink)",
                  border: `0.5px solid ${isActive ? "var(--ink)" : "rgba(15,15,14,0.18)"}`,
                  opacity: isActive ? 1 : 0.6,
                  textDecoration: "none",
                  transition: "all 0.15s",
                }}
              >
                {label}{count > 0 && <span style={{ opacity: 0.65, marginLeft: 6 }}>{count}</span>}
              </Link>
            )
          })}
        </div>

        {projects.length === 0 ? (
          <div style={{ ...serif, fontStyle: "italic", fontSize: 17, opacity: 0.5, textAlign: "center", padding: "60px 20px" }}>
            No projects in this view.
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 140px 130px 100px", gap: 16, padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.12)" }}>
              {["Project", "Client", "Status", "Focus", "Updated"].map(h => (
                <div key={h} style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45 }}>{h}</div>
              ))}
            </div>

            {projects.map((p: any) => {
              const client = p.clients
              return (
                <Link
                  key={p.id}
                  href={`/admin/projects/${p.id}`}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 200px 140px 130px 100px",
                    gap: 16, alignItems: "center", padding: "16px 0",
                    borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                    textDecoration: "none", color: "inherit",
                  }}
                >
                  <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.88, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title}
                  </div>
                  <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.6 }}>
                    {client?.name ?? "—"}
                  </div>
                  <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", color: STATUS_COLORS[p.status] ?? "var(--ink)", opacity: 0.85 }}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </div>
                  <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: p.focus_state ? 0.85 : 0.35 }}>
                    {p.focus_state ? FOCUS_LABELS[p.focus_state] : "—"}
                  </div>
                  <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", opacity: 0.5 }}>
                    {fmtAge(daysSince(p.updated_at ?? p.created_at))}
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
