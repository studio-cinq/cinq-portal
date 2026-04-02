import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"

export default async function AdminStudioPage() {
  const supabase = await createServerComponentClient()

  const { data: clientsRaw }  = await supabase.from("clients").select("*").order("created_at", { ascending: false })
  const clients = clientsRaw as any[] | null

  const { data: projectsRaw } = await supabase.from("projects").select("*, clients(name), deliverables(*), client_id")
  const projects = projectsRaw as any[] | null

  const { data: invoicesRaw } = await supabase.from("invoices").select("*, clients(name)").in("status", ["sent", "overdue"]).order("due_date")
  const invoices = invoicesRaw as any[] | null

  const { data: messagesRaw } = await supabase.from("messages").select("*, projects(title, client_id, clients(name))").eq("from_client", true).eq("read", false)
  const messages = messagesRaw as any[] | null

  const activeCount    = projects?.filter(p => p.status === "active").length ?? 0
  const attentionCount = (invoices?.length ?? 0) + (messages?.length ?? 0)

  const { data: paidInvoicesRaw } = await supabase
    .from("invoices").select("amount, paid_at").eq("status", "paid")
    .gte("paid_at", new Date(new Date().getFullYear(), 0, 1).toISOString())

  const paidInvoices = paidInvoicesRaw as { amount: number; paid_at: string }[] | null
  const ytdBilled    = paidInvoices?.reduce((s, i) => s + i.amount, 0) ?? 0
  const outstanding  = invoices?.reduce((s, i) => s + i.amount, 0) ?? 0

  return (
    <>
      <PortalNav isAdmin />

      <main className="admin-studio-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 280px",
        maxWidth: 1200, margin: "0 auto",
        minHeight: "calc(100vh - 60px)",
      }}>

        {/* Left */}
        <div className="admin-studio-left" style={{ padding: "36px 36px 48px 40px", borderRight: "0.5px solid rgba(15,15,14,0.12)" }}>

          {/* Stats */}
          <div className="admin-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 36 }}>
            <StatCard value={String(clients?.length ?? 0)} label="Total clients" />
            <StatCard value={String(activeCount)}          label="Active projects" />
            <StatCard value={String(attentionCount)}       label="Need attention" highlight={attentionCount > 0} />
            <StatCard value={`$${Math.round(ytdBilled / 100).toLocaleString()}`} label="Collected YTD" />
          </div>

          {/* Clients table */}
          <div style={sectionLabel}>All clients</div>

          <div className="admin-studio-table-header" style={{ display: "grid", gridTemplateColumns: "200px 1fr 140px 120px 60px", gap: 16, paddingBottom: 10, marginBottom: 2 }}>
            {["Client", "Projects", "Status", "Outstanding", ""].map(h => (
              <div key={h} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.45 }}>{h}</div>
            ))}
          </div>

          <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
            {clients?.map(client => {
              const clientProjects = projects?.filter(p => p.client_id === client.id) ?? []
              const clientInvoices = invoices?.filter(i => i.client_id === client.id) ?? []
              const clientDue      = clientInvoices.reduce((s, i) => s + i.amount, 0)
              const activeProjects = clientProjects.filter(p => p.status === "active")
              const hasReview      = clientProjects.some(p => p.deliverables?.some((d: any) => d.status === "awaiting_approval"))
              const rowStatus      = hasReview ? "awaiting_approval" : activeProjects.length > 0 ? "in_progress" : "complete"

              return (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className="admin-studio-client-row"
                  style={{
                    display: "grid", gridTemplateColumns: "200px 1fr 140px 120px 60px",
                    gap: 16, alignItems: "center",
                    padding: "16px 0", borderBottom: "0.5px solid rgba(15,15,14,0.1)",
                    textDecoration: "none",
                  }}
                >
                  <div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-full)" as any, letterSpacing: "-0.01em" }}>
                      {client.name}
                    </div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any, marginTop: 2 }}>
                      {client.contact_name}
                      {client.last_seen_at && (
                        <span style={{ opacity: 0.5, marginLeft: 8 }}>
                          · seen {new Date(client.last_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-muted)" as any }}>
                    {activeProjects.length > 0
                      ? <span style={{ color: "var(--sage)" }}>{activeProjects.length} active</span>
                      : <span style={{ opacity: 0.4 }}>—</span>
                    }
                    {clientProjects.length > 0 && (
                      <span style={{ opacity: 0.35, marginLeft: 6 }}>/ {clientProjects.length} total</span>
                    )}
                  </div>

                  {clientProjects.length > 0
                    ? <StatusCell status={rowStatus} />
                    : <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4, letterSpacing: "0.08em", textTransform: "uppercase" }}>No projects</div>
                  }

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: clientDue > 0 ? 0.9 : 0.35, color: clientDue > 0 ? "var(--amber)" : "var(--ink)" }}>
                      {clientDue > 0 ? `$${(clientDue / 100).toLocaleString()}` : "—"}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-ghost)" as any }}>&rarr;</div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="admin-studio-right" style={{ padding: "36px 28px" }}>

          <div style={sidebarLabel}>Needs your attention</div>
          <div style={{ marginBottom: 32 }}>
            {invoices?.map(inv => (
              <ActionItem
                key={inv.id}
                client={(inv.clients as any)?.name ?? ""}
                tag="Invoice"
                tagColor="var(--sage)"
                text={`Invoice due ${inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "soon"} — $${(inv.amount / 100).toLocaleString()}`}
                href={`/admin/clients/${inv.client_id}`}
              />
            ))}
            {messages?.map(msg => (
              <ActionItem
                key={msg.id}
                client={((msg.projects as any)?.clients as any)?.name ?? ""}
                tag="Message"
                tagColor="var(--amber)"
                text={(msg.body ?? "").slice(0, 80) + ((msg.body ?? "").length > 80 ? "…" : "")}
                href={`/admin/clients/${(msg.projects as any)?.client_id}`}
              />
            ))}
            {attentionCount === 0 && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-muted)" as any, padding: "12px 0" }}>All clear.</div>
            )}
          </div>

          <div style={sidebarLabel}>Quick add</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
            {[
              { label: "+ New client",   href: "/admin/clients/new"   },
              { label: "+ New proposal", href: "/admin/proposals/new" },
              { label: "+ Send invoice", href: "/admin/invoices/new"  },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{
                fontFamily: "var(--font-mono)",
                background: "transparent", border: "0.5px solid rgba(15,15,14,0.2)",
                padding: "11px 14px",
                fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
                color: "var(--ink)", opacity: 0.65, textDecoration: "none",
                display: "block",
              }}>
                {a.label}
              </Link>
            ))}
          </div>

          <div style={sidebarLabel}>Revenue — {new Date().getFullYear()}</div>
          <div>
            <RevRow label="Collected"   value={`$${Math.round(ytdBilled / 100).toLocaleString()}`}   green />
            <RevRow label="Outstanding" value={`$${Math.round(outstanding / 100).toLocaleString()}`} />
          </div>
        </div>
      </main>
    </>
  )
}

function StatCard({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? "rgba(15,15,14,0.05)" : "rgba(255,255,255,0.4)",
      border: `0.5px solid rgba(15,15,14,${highlight ? 0.18 : 0.12})`,
      padding: 16,
    }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 24, letterSpacing: "-0.02em", marginBottom: 4, color: highlight ? "var(--amber)" : "var(--ink)", opacity: highlight ? 0.95 : "var(--op-full)" as any }}>
        {value}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5 }}>{label}</div>
    </div>
  )
}

function StatusCell({ status }: { status: string }) {
  const colors: Record<string, string> = { awaiting_approval: "var(--amber)", in_progress: "var(--sage)", complete: "rgba(15,15,14,0.35)" }
  const labels: Record<string, string> = { awaiting_approval: "Awaiting approval", in_progress: "In progress", complete: "Complete" }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: colors[status], flexShrink: 0 }} />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", color: colors[status] }}>{labels[status]}</span>
    </div>
  )
}

function ActionItem({ client, tag, tagColor, text, href }: { client: string; tag: string; tagColor: string; text: string; href: string }) {
  return (
    <Link href={href} style={{ display: "block", padding: "13px 0", borderBottom: "0.5px solid rgba(15,15,14,0.1)", textDecoration: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-full)" as any }}>{client}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 7px", border: `0.5px solid ${tagColor}60`, color: tagColor }}>{tag}</span>
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-muted)" as any, lineHeight: 1.4 }}>{text}</div>
    </Link>
  )
}

function RevRow({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-muted)" as any }}>{label}</span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: green ? "var(--sage)" : "var(--ink)", opacity: green ? 0.9 : "var(--op-body)" as any, letterSpacing: "-0.01em" }}>{value}</span>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)" as any,
  letterSpacing: "0.16em", textTransform: "uppercase",
  color: "var(--ink)", opacity: 0.5, marginBottom: 14,
}

const sidebarLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)" as any,
  letterSpacing: "0.16em", textTransform: "uppercase",
  color: "var(--ink)", opacity: 0.5, marginBottom: 16,
}
