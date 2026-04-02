import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"

/* ─── Activity event type ─── */

type ActivityEvent = {
  id: string
  client: string
  clientId: string
  label: string
  timestamp: Date
  icon: "paid" | "viewed" | "approved" | "feedback" | "login" | "message" | "accepted"
}

/* ─── Helpers ─── */

function timeAgo(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const iconColors: Record<ActivityEvent["icon"], string> = {
  paid: "var(--sage)",
  viewed: "rgba(15,15,14,0.35)",
  approved: "var(--sage)",
  feedback: "var(--amber)",
  login: "rgba(15,15,14,0.25)",
  message: "var(--amber)",
  accepted: "var(--sage)",
}

export default async function AdminStudioPage() {
  const supabase = await createServerComponentClient()

  /* ─── Core queries ─── */

  const [
    { data: clientsRaw },
    { data: projectsRaw },
    { data: invoicesOpenRaw },
    { data: messagesRaw },
    { data: proposalsPendingRaw },
    { data: reviewSessionsRaw },
  ] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("projects").select("*, clients(name), deliverables(*), client_id"),
    supabase.from("invoices").select("*, clients(name)").in("status", ["sent", "overdue"]).order("due_date"),
    supabase.from("messages").select("*, projects(title, client_id, clients(name))").eq("from_client", true).eq("read", false),
    supabase.from("proposals").select("*, clients(name)").eq("status", "sent").order("created_at", { ascending: false }),
    supabase.from("review_sessions").select("*, projects(title, client_id, clients(name))").in("status", ["in_review", "revising"]),
  ])

  const clients = clientsRaw as any[] ?? []
  const projects = projectsRaw as any[] ?? []
  const invoicesOpen = invoicesOpenRaw as any[] ?? []
  const messages = messagesRaw as any[] ?? []
  const proposalsPending = proposalsPendingRaw as any[] ?? []
  const reviewSessions = reviewSessionsRaw as any[] ?? []

  /* ─── Stats ─── */

  const activeCount = projects.filter(p => p.status === "active").length

  const { data: paidInvoicesRaw } = await supabase
    .from("invoices").select("amount, paid_at").eq("status", "paid")
    .gte("paid_at", new Date(new Date().getFullYear(), 0, 1).toISOString())
  const paidInvoices = paidInvoicesRaw as { amount: number; paid_at: string }[] ?? []
  const ytdBilled = paidInvoices.reduce((s, i) => s + i.amount, 0)
  const outstanding = invoicesOpen.reduce((s, i) => s + i.amount, 0)

  const { data: draftInvoicesRaw } = await supabase
    .from("invoices").select("amount").eq("status", "draft")
  const draftTotal = (draftInvoicesRaw as { amount: number }[] ?? []).reduce((s, i) => s + i.amount, 0)

  /* ─── "Needs your attention" items ─── */

  type AttentionItem = {
    id: string
    client: string
    clientId: string
    tag: string
    tagColor: string
    urgency: number // lower = more urgent
    text: string
    href: string
  }

  const attention: AttentionItem[] = []

  // Overdue invoices — high urgency
  for (const inv of invoicesOpen.filter(i => i.status === "overdue")) {
    attention.push({
      id: `inv-${inv.id}`,
      client: (inv.clients as any)?.name ?? "",
      clientId: inv.client_id,
      tag: "Overdue",
      tagColor: "var(--amber)",
      urgency: 1,
      text: `$${(inv.amount / 100).toLocaleString()} — due ${inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "now"}`,
      href: `/admin/clients/${inv.client_id}`,
    })
  }

  // Client feedback submitted on reviews — needs your action
  for (const session of reviewSessions.filter(s => s.submitted_at && s.status === "revising")) {
    const proj = session.projects as any
    attention.push({
      id: `rev-${session.id}`,
      client: proj?.clients?.name ?? "",
      clientId: proj?.client_id ?? "",
      tag: "Feedback received",
      tagColor: "var(--amber)",
      urgency: 2,
      text: `${proj?.title ?? "Review"} — client submitted feedback`,
      href: `/admin/reviews/${session.id}`,
    })
  }

  // Unread client messages
  for (const msg of messages) {
    const proj = msg.projects as any
    attention.push({
      id: `msg-${msg.id}`,
      client: proj?.clients?.name ?? "",
      clientId: proj?.client_id ?? "",
      tag: "Message",
      tagColor: "var(--amber)",
      urgency: 3,
      text: (msg.body ?? "").slice(0, 80) + ((msg.body ?? "").length > 80 ? "…" : ""),
      href: `/admin/clients/${proj?.client_id}`,
    })
  }

  // Invoices sent but not overdue — standard urgency
  for (const inv of invoicesOpen.filter(i => i.status === "sent")) {
    attention.push({
      id: `inv-${inv.id}`,
      client: (inv.clients as any)?.name ?? "",
      clientId: inv.client_id,
      tag: "Invoice sent",
      tagColor: "var(--sage)",
      urgency: 4,
      text: `$${(inv.amount / 100).toLocaleString()} — due ${inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "upon receipt"}`,
      href: `/admin/clients/${inv.client_id}`,
    })
  }

  // Proposals waiting on client
  for (const prop of proposalsPending) {
    const daysSent = prop.created_at ? Math.floor((Date.now() - new Date(prop.created_at).getTime()) / 86400000) : 0
    attention.push({
      id: `prop-${prop.id}`,
      client: (prop.clients as any)?.name ?? "",
      clientId: prop.client_id,
      tag: daysSent > 5 ? "Proposal aging" : "Proposal sent",
      tagColor: daysSent > 5 ? "var(--amber)" : "var(--sage)",
      urgency: daysSent > 5 ? 2 : 5,
      text: `Sent ${daysSent}d ago${prop.viewed_at ? " · viewed" : " · not opened"}`,
      href: `/admin/proposals/${prop.id}`,
    })
  }

  // Deliverables awaiting client approval — you're waiting on them
  for (const project of projects) {
    const awaiting = (project.deliverables ?? []).filter((d: any) => d.status === "awaiting_approval")
    if (awaiting.length > 0) {
      attention.push({
        id: `del-${project.id}`,
        client: (project.clients as any)?.name ?? "",
        clientId: project.client_id,
        tag: "Awaiting approval",
        tagColor: "rgba(15,15,14,0.45)",
        urgency: 6,
        text: `${awaiting.length} deliverable${awaiting.length > 1 ? "s" : ""} out for review`,
        href: `/admin/clients/${project.client_id}`,
      })
    }
  }

  attention.sort((a, b) => a.urgency - b.urgency)
  const attentionCount = attention.length

  /* ─── "Recent activity" feed ─── */

  const activity: ActivityEvent[] = []

  // Recent paid invoices
  const { data: recentPaidRaw } = await supabase
    .from("invoices")
    .select("id, amount, paid_at, client_id, clients(name)")
    .eq("status", "paid")
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: false })
    .limit(10)
  for (const inv of (recentPaidRaw ?? []) as any[]) {
    if (inv.paid_at) {
      activity.push({
        id: `paid-${inv.id}`,
        client: inv.clients?.name ?? "",
        clientId: inv.client_id,
        label: `Paid $${(inv.amount / 100).toLocaleString()}`,
        timestamp: new Date(inv.paid_at),
        icon: "paid",
      })
    }
  }

  // Proposal views
  const { data: proposalViewsRaw } = await supabase
    .from("proposals")
    .select("id, client_id, viewed_at, clients(name)")
    .not("viewed_at", "is", null)
    .order("viewed_at", { ascending: false })
    .limit(10)
  for (const prop of (proposalViewsRaw ?? []) as any[]) {
    if (prop.viewed_at) {
      activity.push({
        id: `propview-${prop.id}`,
        client: prop.clients?.name ?? "",
        clientId: prop.client_id,
        label: "Viewed proposal",
        timestamp: new Date(prop.viewed_at),
        icon: "viewed",
      })
    }
  }

  // Accepted proposals
  const { data: acceptedPropsRaw } = await supabase
    .from("proposals")
    .select("id, client_id, updated_at, clients(name)")
    .eq("status", "accepted")
    .order("updated_at", { ascending: false })
    .limit(10)
  for (const prop of (acceptedPropsRaw ?? []) as any[]) {
    if (prop.updated_at) {
      activity.push({
        id: `accepted-${prop.id}`,
        client: prop.clients?.name ?? "",
        clientId: prop.client_id,
        label: "Accepted proposal",
        timestamp: new Date(prop.updated_at),
        icon: "accepted",
      })
    }
  }

  // Invoice views
  const { data: invoiceViewsRaw } = await supabase
    .from("invoices")
    .select("id, client_id, viewed_at, clients(name)")
    .not("viewed_at", "is", null)
    .order("viewed_at", { ascending: false })
    .limit(10)
  for (const inv of (invoiceViewsRaw ?? []) as any[]) {
    if (inv.viewed_at) {
      activity.push({
        id: `invview-${inv.id}`,
        client: inv.clients?.name ?? "",
        clientId: inv.client_id,
        label: "Viewed invoice",
        timestamp: new Date(inv.viewed_at),
        icon: "viewed",
      })
    }
  }

  // Review approvals
  const { data: approvedReviewsRaw } = await supabase
    .from("review_sessions")
    .select("id, approved_at, projects(title, client_id, clients(name))")
    .not("approved_at", "is", null)
    .order("approved_at", { ascending: false })
    .limit(10)
  for (const session of (approvedReviewsRaw ?? []) as any[]) {
    if (session.approved_at) {
      const proj = session.projects as any
      activity.push({
        id: `revapprove-${session.id}`,
        client: proj?.clients?.name ?? "",
        clientId: proj?.client_id ?? "",
        label: `Approved ${proj?.title ?? "review"}`,
        timestamp: new Date(session.approved_at),
        icon: "approved",
      })
    }
  }

  // Review feedback submissions
  const { data: submittedReviewsRaw } = await supabase
    .from("review_sessions")
    .select("id, submitted_at, projects(title, client_id, clients(name))")
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(10)
  for (const session of (submittedReviewsRaw ?? []) as any[]) {
    if (session.submitted_at) {
      const proj = session.projects as any
      activity.push({
        id: `revfeedback-${session.id}`,
        client: proj?.clients?.name ?? "",
        clientId: proj?.client_id ?? "",
        label: `Submitted feedback on ${proj?.title ?? "review"}`,
        timestamp: new Date(session.submitted_at),
        icon: "feedback",
      })
    }
  }

  // Client logins
  const { data: recentLoginsRaw } = await supabase
    .from("clients")
    .select("id, name, last_seen_at")
    .not("last_seen_at", "is", null)
    .order("last_seen_at", { ascending: false })
    .limit(10)
  for (const c of (recentLoginsRaw ?? []) as any[]) {
    if (c.last_seen_at) {
      activity.push({
        id: `login-${c.id}`,
        client: c.name ?? "",
        clientId: c.id,
        label: "Logged into portal",
        timestamp: new Date(c.last_seen_at),
        icon: "login",
      })
    }
  }

  // Sort all activity by timestamp, most recent first
  activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  const recentActivity = activity.slice(0, 12)

  return (
    <>
      <PortalNav isAdmin />

      <main className="admin-studio-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 300px",
        maxWidth: 1200, margin: "0 auto",
        minHeight: "calc(100vh - 60px)",
      }}>

        {/* ━━━ Left: Main content ━━━ */}
        <div className="admin-studio-left" style={{ padding: "36px 36px 48px 40px", borderRight: "0.5px solid rgba(15,15,14,0.12)" }}>

          {/* Stats */}
          <div className="admin-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 36 }}>
            <StatCard value={String(clients.length)} label="Total clients" />
            <StatCard value={String(activeCount)} label="Active projects" />
            <StatCard value={String(attentionCount)} label="Need attention" highlight={attentionCount > 0} />
            <StatCard value={`$${Math.round(ytdBilled / 100).toLocaleString()}`} label="Collected YTD" />
            <StatCard value={`$${Math.round(draftTotal / 100).toLocaleString()}`} label="In drafts" muted={draftTotal === 0} />
          </div>

          {/* Clients table */}
          <div style={sectionLabel}>All clients</div>

          <div className="admin-studio-table-header" style={{ display: "grid", gridTemplateColumns: "200px 1fr 140px 120px 60px", gap: 16, paddingBottom: 10, marginBottom: 2 }}>
            {["Client", "Projects", "Status", "Outstanding", ""].map(h => (
              <div key={h} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.45 }}>{h}</div>
            ))}
          </div>

          <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
            {clients.map(client => {
              const clientProjects = projects.filter(p => p.client_id === client.id)
              const clientInvoices = invoicesOpen.filter(i => i.client_id === client.id)
              const clientDue = clientInvoices.reduce((s, i) => s + i.amount, 0)
              const activeProjects = clientProjects.filter(p => p.status === "active")
              const hasReview = clientProjects.some(p => p.deliverables?.some((d: any) => d.status === "awaiting_approval"))
              const rowStatus = hasReview ? "awaiting_approval" : activeProjects.length > 0 ? "in_progress" : "complete"

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

        {/* ━━━ Right sidebar ━━━ */}
        <div className="admin-studio-right" style={{ padding: "36px 28px" }}>

          {/* Needs your attention */}
          <div style={sidebarLabel}>Needs your attention</div>
          <div style={{ marginBottom: 32 }}>
            {attention.length > 0 ? (
              attention.slice(0, 6).map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    display: "block",
                    padding: "12px 0 12px 12px",
                    borderLeft: `2px solid ${item.tagColor}`,
                    borderBottom: "0.5px solid rgba(15,15,14,0.06)",
                    textDecoration: "none",
                    marginBottom: 2,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", opacity: 0.82, letterSpacing: "-0.01em" }}>
                      {item.client}
                    </span>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em",
                      textTransform: "uppercase", padding: "2px 6px",
                      color: item.tagColor, opacity: 0.88,
                    }}>
                      {item.tag}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink)", opacity: 0.46, lineHeight: 1.4 }}>
                    {item.text}
                  </div>
                </Link>
              ))
            ) : (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.46, padding: "12px 0", color: "var(--ink)" }}>
                All clear — nothing needs your attention.
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div style={sidebarLabel}>Recent activity</div>
          <div style={{ marginBottom: 32 }}>
            {recentActivity.length > 0 ? (
              recentActivity.map(event => (
                <Link
                  key={event.id}
                  href={`/admin/clients/${event.clientId}`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: "0.5px solid rgba(15,15,14,0.05)",
                    textDecoration: "none",
                  }}
                >
                  <div style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: iconColors[event.icon],
                    flexShrink: 0,
                    marginTop: 5,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--font-sans)", fontSize: 11,
                      color: "var(--ink)", opacity: 0.7, letterSpacing: "-0.01em",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      <span style={{ opacity: 1 }}>{event.client}</span>
                      <span style={{ opacity: 0.6 }}> · {event.label}</span>
                    </div>
                    <div style={{
                      fontFamily: "var(--font-mono)", fontSize: 9,
                      letterSpacing: "0.06em", color: "var(--ink)", opacity: 0.3,
                      marginTop: 1,
                    }}>
                      {timeAgo(event.timestamp)}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.46, padding: "12px 0", color: "var(--ink)" }}>
                No recent activity yet.
              </div>
            )}
          </div>

          {/* Quick add */}
          <div style={sidebarLabel}>Quick add</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
            {[
              { label: "+ New client", href: "/admin/clients/new" },
              { label: "+ New proposal", href: "/admin/proposals/new" },
              { label: "+ Send invoice", href: "/admin/invoices/new" },
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

          {/* Revenue */}
          <div style={sidebarLabel}>Revenue — {new Date().getFullYear()}</div>
          <div>
            <RevRow label="Collected" value={`$${Math.round(ytdBilled / 100).toLocaleString()}`} green />
            <RevRow label="Outstanding" value={`$${Math.round(outstanding / 100).toLocaleString()}`} />
          </div>
        </div>
      </main>
    </>
  )
}

/* ─── Components ─── */

function StatCard({ value, label, highlight, muted }: { value: string; label: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div style={{
      background: highlight ? "rgba(15,15,14,0.05)" : "rgba(255,255,255,0.4)",
      border: `0.5px solid rgba(15,15,14,${highlight ? 0.18 : 0.12})`,
      padding: 16,
    }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 24, letterSpacing: "-0.02em", marginBottom: 4, color: highlight ? "var(--amber)" : "var(--ink)", opacity: highlight ? 0.95 : muted ? 0.3 : "var(--op-full)" as any }}>
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

function RevRow({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-muted)" as any }}>{label}</span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: green ? "var(--sage)" : "var(--ink)", opacity: green ? 0.9 : "var(--op-body)" as any, letterSpacing: "-0.01em" }}>{value}</span>
    </div>
  )
}

/* ─── Style constants ─── */

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
