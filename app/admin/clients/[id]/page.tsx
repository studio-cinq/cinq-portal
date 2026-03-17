import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import { notFound } from "next/navigation"

export default async function AdminClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerComponentClient()

  const { data: clientRaw } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .single()

  const client = clientRaw as any
  if (!client) notFound()

  const { data: projectsRaw } = await supabase
    .from("projects")
    .select("*, deliverables(*)")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false })

  const projects = projectsRaw as any[] | null

  const { data: invoicesRaw } = await supabase
    .from("invoices")
    .select("*")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false })

  const invoices = invoicesRaw as any[] | null

  const { data: messagesRaw } = await supabase
    .from("messages")
    .select("*, projects(title)")
    .in("project_id", projects?.map(p => p.id) ?? [])
    .order("created_at", { ascending: false })
    .limit(20)

  const messages = messagesRaw as any[] | null

  const totalBilled    = invoices?.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0) ?? 0
  const totalOutstanding = invoices?.filter(i => ["sent","overdue"].includes(i.status)).reduce((s, i) => s + i.amount, 0) ?? 0

  return (
    <>
      <PortalNav isAdmin />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link href="/admin/clients" style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 16 }}>
            ← All clients
          </Link>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", opacity: 0.9, marginBottom: 6 }}>
                {client.name}
              </h1>
              <div style={{ fontSize: 11, opacity: 0.55 }}>{client.contact_name} &nbsp;·&nbsp; {client.contact_email}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href={`/admin/invoices/new?client=${params.id}`} style={actionBtn}>
                + Send invoice
              </Link>
              <Link href={`/admin/proposals/new?client=${params.id}`} style={actionBtn}>
                + New proposal
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 40 }}>
          <MiniStat label="Active projects" value={String(projects?.filter(p => p.status === "active").length ?? 0)} />
          <MiniStat label="Total projects"  value={String(projects?.length ?? 0)} />
          <MiniStat label="Total billed"    value={`$${Math.round(totalBilled / 100).toLocaleString()}`} />
          <MiniStat label="Outstanding"     value={`$${Math.round(totalOutstanding / 100).toLocaleString()}`} highlight={totalOutstanding > 0} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 40 }}>

          {/* Left — Projects */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
              <div style={label}>Projects</div>
              <Link href={`/admin/projects/new?client=${params.id}`} style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none" }}>
                + New
              </Link>
            </div>

            <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
              {projects?.map(project => {
                const deliverables = project.deliverables ?? []
                const done    = deliverables.filter((d: any) => d.status === "complete").length
                const total   = deliverables.length
                const pct     = project.total_weeks && project.current_week
                  ? Math.round((project.current_week / project.total_weeks) * 100)
                  : 0

                return (
                  <div key={project.id} style={{ padding: "18px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 300, opacity: 0.88 }}>{project.title}</div>
                      <StatusBadge status={project.status} />
                    </div>
                    {project.scope && (
                      <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 10 }}>{project.scope}</div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, opacity: 0.5, marginBottom: 5 }}>
                      <span>Week {project.current_week ?? 0} of {project.total_weeks ?? "?"}</span>
                      <span>{done}/{total} deliverables · {pct}%</span>
                    </div>
                    <div style={{ height: 1.5, background: "rgba(15,15,14,0.1)", borderRadius: 1 }}>
                      <div style={{ height: 1.5, width: `${pct}%`, background: "#0F0F0E", opacity: 0.4, borderRadius: 1 }} />
                    </div>
                  </div>
                )
              })}
              {(!projects || projects.length === 0) && (
                <div style={{ padding: "32px 0", fontSize: 11, opacity: 0.35 }}>No projects yet.</div>
              )}
            </div>

            {/* Invoices */}
            <div style={{ marginTop: 40 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <div style={label}>Invoices</div>
                <Link href={`/admin/invoices/new?client=${params.id}`} style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none" }}>
                  + New
                </Link>
              </div>
              <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
                {invoices?.map(inv => (
                  <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 300, opacity: 0.85 }}>{inv.description}</div>
                      <div style={{ fontSize: 9, opacity: 0.45, marginTop: 2 }}>
                        #{inv.invoice_number} · {inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "No due date"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 300, opacity: 0.85 }}>${(inv.amount / 100).toLocaleString()}</div>
                      <InvoiceStatus status={inv.status} />
                    </div>
                  </div>
                ))}
                {(!invoices || invoices.length === 0) && (
                  <div style={{ padding: "32px 0", fontSize: 11, opacity: 0.35 }}>No invoices yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Right — Messages */}
          <div>
            <div style={{ ...label, marginBottom: 16 }}>Messages</div>
            <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
              {messages?.map(msg => (
                <div key={msg.id} style={{ padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {msg.from_client ? msg.sender_name : "Studio Cinq"}
                    </span>
                    <span style={{ fontSize: 8, opacity: 0.35 }}>
                      {new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {msg.projects?.title && (
                    <div style={{ fontSize: 8, opacity: 0.4, marginBottom: 4, letterSpacing: "0.04em" }}>{msg.projects.title}</div>
                  )}
                  <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.5 }}>{msg.body}</div>
                </div>
              ))}
              {(!messages || messages.length === 0) && (
                <div style={{ padding: "32px 0", fontSize: 11, opacity: 0.35 }}>No messages yet.</div>
              )}
            </div>
          </div>

        </div>
      </main>
    </>
  )
}

function MiniStat({ label: l, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? "rgba(176,125,58,0.06)" : "rgba(255,255,255,0.35)",
      border: `0.5px solid rgba(15,15,14,${highlight ? 0.15 : 0.1})`,
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 20, fontWeight: 300, letterSpacing: "-0.02em", opacity: highlight ? 0.9 : 0.85, color: highlight ? "#B07D3A" : "#0F0F0E", marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.45 }}>{l}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { active: "#6B8F71", complete: "rgba(15,15,14,0.4)", on_hold: "#B07D3A", proposal_sent: "#B07D3A" }
  const labels: Record<string, string> = { active: "Active", complete: "Complete", on_hold: "On hold", proposal_sent: "Proposal sent" }
  return (
    <span style={{ fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)" }}>
      {labels[status] ?? status}
    </span>
  )
}

function InvoiceStatus({ status }: { status: string }) {
  const colors: Record<string, string> = { paid: "#6B8F71", sent: "#B07D3A", overdue: "#c0392b", draft: "rgba(15,15,14,0.4)" }
  return (
    <div style={{ fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)", marginTop: 2 }}>
      {status}
    </div>
  )
}

const label: React.CSSProperties = {
  fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5,
}

const actionBtn: React.CSSProperties = {
  fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
  color: "#0F0F0E", opacity: 0.6, textDecoration: "none",
  border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
  display: "inline-block",
}
