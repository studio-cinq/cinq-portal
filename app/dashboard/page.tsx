import { cookies } from "next/headers"
import { createServerComponentClient } from "@/lib/supabase"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import type { Database, Project, Client } from "@/types/database"

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    awaiting_approval: "#B07D3A",
    in_progress:       "#6B8F71",
    complete:          "rgba(15,15,14,0.22)",
    not_started:       "transparent",
    proposal_sent:     "transparent",
  }
  const labels: Record<string, string> = {
    awaiting_approval: "Awaiting your review",
    in_progress:       "In progress",
    complete:          "Complete",
    not_started:       "Not started",
    proposal_sent:     "Proposal open",
  }

  const color = colors[status] ?? "rgba(15,15,14,0.2)"
  const label = labels[status] ?? status

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 5, height: 5, borderRadius: "50%",
        background: color,
        border: status === "not_started" || status === "proposal_sent"
          ? "0.5px solid rgba(15,15,14,0.2)"
          : "none",
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 8,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: color === "transparent" ? "rgba(15,15,14,0.3)" : color,
      }}>
        {label}
      </span>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createServerComponentClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get client record
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("contact_email", user?.email ?? "")
    .single()

  // Get projects with their deliverables
  const { data: projects } = await supabase
    .from("projects")
    .select("*, deliverables(*)")
    .eq("client_id", client?.id ?? "")
    .order("created_at", { ascending: false })

  // Get outstanding invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("client_id", client?.id ?? "")
    .in("status", ["sent", "overdue"])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <>
      <PortalNav clientName={client?.name} />

      <main style={{
        padding: "clamp(40px, 8vh, 64px) clamp(32px, 5vw, 48px)",
        maxWidth: 1100,
        margin: "0 auto",
      }}>

        {/* Greeting */}
        <div style={{ marginBottom: 52 }}>
          <div style={{
            fontSize: 8, letterSpacing: "0.16em",
            textTransform: "uppercase", opacity: 0.32, marginBottom: 10,
          }}>
            &bull; {greeting}
          </div>
          <div style={{
            fontWeight: 300, fontSize: "clamp(24px, 3vw, 32px)",
            letterSpacing: "-0.01em", opacity: 0.88,
          }}>
            {client?.name ?? "Welcome back"}
          </div>
        </div>

        {/* Attention strip — outstanding invoices */}
        {invoices && invoices.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={sectionLabel}>Needs attention</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {invoices.map(inv => (
                <Link key={inv.id} href="/invoices" style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(255,255,255,0.3)",
                  border: "0.5px solid rgba(15,15,14,0.1)",
                  padding: "16px 20px",
                  textDecoration: "none",
                }}>
                  <div>
                    <div style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B07D3A", marginBottom: 5 }}>
                      Invoice due
                    </div>
                    <div style={{ fontSize: 13, color: "#0F0F0E", opacity: 0.75, fontWeight: 300 }}>
                      {inv.description}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, color: "#0F0F0E", opacity: 0.82, fontWeight: 300, letterSpacing: "-0.01em" }}>
                      ${(inv.amount / 100).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 9, color: "#0F0F0E", opacity: 0.3, marginTop: 3 }}>
                      {inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Due now"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        <div style={sectionLabel}>Active projects</div>
        <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
          {projects?.map((project, i) => {
            // Overall project status = worst-case deliverable status
            const deliverables = (project as any).deliverables ?? []
            const hasReview  = deliverables.some((d: any) => d.status === "awaiting_approval")
            const hasActive  = deliverables.some((d: any) => d.status === "in_progress")
            const allDone    = deliverables.every((d: any) => d.status === "complete")
            const rowStatus  = hasReview ? "awaiting_approval" : hasActive ? "in_progress" : allDone ? "complete" : project.status

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                style={{
                  display: "flex", alignItems: "baseline",
                  justifyContent: "space-between",
                  padding: "clamp(18px, 2.5vh, 28px) 0",
                  borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                  textDecoration: "none",
                  gap: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 20, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 9, color: "#0F0F0E", opacity: 0.2, flexShrink: 0, letterSpacing: "0.08em" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{
                    fontWeight: 300, fontSize: "clamp(18px, 2vw, 26px)",
                    color: "#0F0F0E", opacity: 0.85, letterSpacing: "-0.01em",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {project.title}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 32, flexShrink: 0 }}>
                  <span style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0F0F0E", opacity: 0.28 }}>
                    {project.scope}
                  </span>
                  <StatusDot status={rowStatus} />
                  <span style={{ fontSize: 11, color: "#0F0F0E", opacity: 0.18 }}>&rarr;</span>
                </div>
              </Link>
            )
          })}

          {(!projects || projects.length === 0) && (
            <div style={{ padding: "40px 0", fontSize: 12, color: "#0F0F0E", opacity: 0.3 }}>
              No active projects yet.
            </div>
          )}
        </div>

      </main>
    </>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 8,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#0F0F0E",
  opacity: 0.28,
  marginBottom: 14,
  display: "flex",
  alignItems: "center",
  gap: 12,
}
