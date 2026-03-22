import { cookies } from "next/headers"
import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import type { Database } from "@/types/database"

export default async function AdminStudioPage() {
  const supabase = await createServerComponentClient()

  const { data: clientsRaw }  = await supabase.from("clients").select("*").order("created_at", { ascending: false })
  const clients = clientsRaw as any[] | null

  const { data: projectsRaw } = await supabase.from("projects").select("*, clients(name), deliverables(*), client_id")
  const projects = projectsRaw as any[] | null

  const { data: invoicesRaw } = await supabase.from("invoices").select("*, clients(name)").in("status", ["sent", "overdue"]).order("due_date")
  const invoices = invoicesRaw as any[] | null

  const { data: messagesRaw } = await supabase.from("messages").select("*, projects(title, clients(name))").eq("from_client", true).eq("read", false)
  const messages = messagesRaw as any[] | null

  const activeCount = projects?.filter(p => p.status === "active").length ?? 0
  const attentionCount = (invoices?.length ?? 0) + (messages?.length ?? 0)

  const { data: paidInvoicesRaw } = await supabase
    .from("invoices")
    .select("amount, paid_at")
    .eq("status", "paid")
    .gte("paid_at", new Date(new Date().getFullYear(), 0, 1).toISOString())

  const paidInvoices = paidInvoicesRaw as { amount: number; paid_at: string }[] | null
  const ytdBilled    = paidInvoices?.reduce((s, i) => s + i.amount, 0) ?? 0
  const outstanding  = invoices?.reduce((s, i) => s + i.amount, 0) ?? 0

  return (
    <>
      <PortalNav isAdmin />

      <main style={{
        display: "grid",
        gridTemplateColumns: "1fr 280px",
        maxWidth: 1200,
        margin: "0 auto",
        minHeight: "calc(100vh - 60px)",
      }}>

        {/* Left */}
        <div style={{ padding: "36px 36px 48px 40px", borderRight: "0.5px solid rgba(15,15,14,0.12)" }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 36 }}>
            <StatCard value={String(clients?.length ?? 0)} label="Total clients" />
            <StatCard value={String(activeCount)} label="Active projects" />
            <StatCard value={String(attentionCount)} label="Need attention" highlight={attentionCount > 0} />
            <StatCard value={`$${Math.round(ytdBilled / 100).toLocaleString()}`} label="Collected YTD" />
          </div>

          {/* Clients table */}
<div style={sectionLabel}>All clients</div>

{/* Header row */}
<div style={{ display: "grid", gridTemplateColumns: "200px 1fr 140px 120px 60px", gap: 16, paddingBottom: 10, marginBottom: 2 }}>
  {["Client", "Projects", "Status", "Outstanding", ""].map(h => (
    <div key={h} style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0F0F0E", opacity: 0.45 }}>{h}</div>
  ))}
</div>

<div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
  {clients?.map(client => {
    const clientProjects = projects?.filter(p => p.client_id === client.id) ?? []
    const clientInvoices = invoices?.filter(i => i.client_id === client.id) ?? []
    const clientDue = clientInvoices.reduce((s, i) => s + i.amount, 0)
    const activeProjects = clientProjects.filter(p => p.status === "active")
    
    const hasReview = clientProjects.some(p => 
      p.deliverables?.some((d: any) => d.status === "awaiting_approval")
    )
    const rowStatus = hasReview ? "awaiting_approval" 
      : activeProjects.length > 0 ? "in_progress" 
      : "complete"

    return (
      <Link
        key={client.id}
        href={`/admin/clients/${client.id}`}
        style={{
          display: "grid",
          gridTemplateColumns: "200px 1fr 140px 120px 60px",
          gap: 16, alignItems: "center",
          padding: "16px 0", borderBottom: "0.5px solid rgba(15,15,14,0.1)",
          textDecoration: "none",
        }}
      >
        <div>
          <div style={{ fontSize: 13, opacity: 0.9, letterSpacing: "-0.01em" }}>
            {client.name}
          </div>
          <div style={{ fontSize: 9, opacity: 0.45, marginTop: 2 }}>
            {client.contact_name}
          </div>
        </div>

        <div style={{ fontSize: 11, opacity: 0.55 }}>
          {activeProjects.length > 0
            ? <span style={{ color: "#6B8F71" }}>{activeProjects.length} active</span>
            : <span style={{ opacity: 0.4 }}>—</span>
          }
          {clientProjects.length > 0 && (
            <span style={{ opacity: 0.35, marginLeft: 6 }}>/ {clientProjects.length} total</span>
          )}
        </div>

        {clientProjects.length > 0
          ? <StatusCell status={rowStatus} />
          : <div style={{ fontSize: 8, opacity: 0.3, letterSpacing: "0.08em", textTransform: "uppercase" }}>No projects</div>
        }

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: clientDue > 0 ? 0.9 : 0.35, color: clientDue > 0 ? "#B07D3A" : "#0F0F0E" }}>
            {clientDue > 0 ? `$${(clientDue / 100).toLocaleString()}` : "—"}
          </div>
        </div>

        <div style={{ textAlign: "right", fontSize: 11, opacity: 0.35 }}>&rarr;</div>
      </Link>
    )
  })}
</div>
</div>

        {/* Right sidebar */}
        <div style={{ padding: "36px 28px" }}>

          {/* Needs attention */}
          <div style={sidebarLabel}>Needs your attention</div>
          <div style={{ marginBottom: 32 }}>
            {invoices?.map(inv => (
              <ActionItem
                key={inv.id}
                client={(inv.clients as any)?.name ?? ""}
                tag="Invoice"
                tagColor="#6B8F71"
                text={`Invoice due ${inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "soon"} — $${(inv.amount / 100).toLocaleString()}`}
                href={`/admin/clients/${inv.client_id}`}
              />
            ))}
            {messages?.map(msg => (
              <ActionItem
                key={msg.id}
                client={((msg.projects as any)?.clients as any)?.name ?? ""}
                tag="Message"
                tagColor="#B07D3A"
                text={msg.body.slice(0, 80) + (msg.body.length > 80 ? "…" : "")}
                href={`/admin/clients/${(msg.projects as any)?.client_id}`}
              />
            ))}
            {attentionCount === 0 && (
              <div style={{ fontSize: 11, opacity: 0.45, padding: "12px 0" }}>All clear.</div>
            )}
          </div>

          {/* Quick add */}
          <div style={sidebarLabel}>Quick add</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
            {[
              { label: "+ New client",    href: "/admin/clients/new"   },
              { label: "+ New proposal",  href: "/admin/proposals/new" },
              { label: "+ Send invoice",  href: "/admin/invoices/new"  },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{
                background: "transparent", border: "0.5px solid rgba(15,15,14,0.2)",
                padding: "11px 14px",
                fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "#0F0F0E", opacity: 0.65, textDecoration: "none",
                display: "block", transition: "all 0.2s",
              }}>
                {a.label}
              </Link>
            ))}
          </div>

          {/* Revenue */}
          <div style={sidebarLabel}>Revenue — {new Date().getFullYear()}</div>
          <div>
            <RevRow label="Collected"    value={`$${Math.round(ytdBilled / 100).toLocaleString()}`}   green />
            <RevRow label="Outstanding"  value={`$${Math.round(outstanding / 100).toLocaleString()}`} />
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
      <div style={{ fontWeight: 300, fontSize: 24, letterSpacing: "-0.02em", marginBottom: 4, color: highlight ? "#B07D3A" : "#0F0F0E", opacity: highlight ? 0.95 : 0.88 }}>
        {value}
      </div>
      <div style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5 }}>{label}</div>
    </div>
  )
}

function StatusCell({ status }: { status: string }) {
  const colors: Record<string, string> = { awaiting_approval: "#B07D3A", in_progress: "#6B8F71", complete: "rgba(15,15,14,0.35)" }
  const labels: Record<string, string> = { awaiting_approval: "Awaiting approval", in_progress: "In progress", complete: "Complete" }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: colors[status], flexShrink: 0 }} />
      <span style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: colors[status] }}>{labels[status]}</span>
    </div>
  )
}

function ActionItem({ client, tag, tagColor, text, href }: { client: string; tag: string; tagColor: string; text: string; href: string }) {
  return (
    <Link href={href} style={{ display: "block", padding: "13px 0", borderBottom: "0.5px solid rgba(15,15,14,0.1)", textDecoration: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, opacity: 0.85, fontWeight: 300 }}>{client}</span>
        <span style={{ fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 7px", border: `0.5px solid ${tagColor}60`, color: tagColor }}>{tag}</span>
      </div>
      <div style={{ fontSize: 10, opacity: 0.55, lineHeight: 1.4 }}>{text}</div>
    </Link>
  )
}

function RevRow({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)" }}>
      <span style={{ fontSize: 10, opacity: 0.55 }}>{label}</span>
      <span style={{ fontSize: 11, color: green ? "#6B8F71" : "#0F0F0E", opacity: green ? 0.9 : 0.75, letterSpacing: "-0.01em" }}>{value}</span>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase",
  color: "#0F0F0E", opacity: 0.5, marginBottom: 14,
}
const sidebarLabel: React.CSSProperties = {
  fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase",
  color: "#0F0F0E", opacity: 0.5, marginBottom: 16,
}
