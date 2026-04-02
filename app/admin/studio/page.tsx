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
    urgency: number
    text: string
    href: string
  }

  const attention: AttentionItem[] = []

  for (const inv of invoicesOpen.filter(i => i.status === "overdue")) {
    attention.push({
      id: `inv-${inv.id}`, client: (inv.clients as any)?.name ?? "", clientId: inv.client_id,
      tag: "Overdue", tagColor: "var(--amber)", urgency: 1,
      text: `$${(inv.amount / 100).toLocaleString()} — due ${inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "now"}`,
      href: `/admin/clients/${inv.client_id}`,
    })
  }

  for (const session of reviewSessions.filter(s => s.submitted_at && s.status === "revising")) {
    const proj = session.projects as any
    attention.push({
      id: `rev-${session.id}`, client: proj?.clients?.name ?? "", clientId: proj?.client_id ?? "",
      tag: "Feedback received", tagColor: "var(--amber)", urgency: 2,
      text: `${proj?.title ?? "Review"} — client submitted feedback`,
      href: `/admin/reviews/${session.id}`,
    })
  }

  for (const msg of messages) {
    const proj = msg.projects as any
    attention.push({
      id: `msg-${msg.id}`, client: proj?.clients?.name ?? "", clientId: proj?.client_id ?? "",
      tag: "Message", tagColor: "var(--amber)", urgency: 3,
      text: (msg.body ?? "").slice(0, 80) + ((msg.body ?? "").length > 80 ? "…" : ""),
      href: `/admin/clients/${proj?.client_id}`,
    })
  }

  for (const inv of invoicesOpen.filter(i => i.status === "sent")) {
    attention.push({
      id: `inv-${inv.id}`, client: (inv.clients as any)?.name ?? "", clientId: inv.client_id,
      tag: "Invoice sent", tagColor: "var(--sage)", urgency: 4,
      text: `$${(inv.amount / 100).toLocaleString()} — due ${inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "upon receipt"}`,
      href: `/admin/clients/${inv.client_id}`,
    })
  }

  for (const prop of proposalsPending) {
    const daysSent = prop.created_at ? Math.floor((Date.now() - new Date(prop.created_at).getTime()) / 86400000) : 0
    attention.push({
      id: `prop-${prop.id}`, client: (prop.clients as any)?.name ?? "", clientId: prop.client_id,
      tag: daysSent > 5 ? "Proposal aging" : "Proposal sent",
      tagColor: daysSent > 5 ? "var(--amber)" : "var(--sage)", urgency: daysSent > 5 ? 2 : 5,
      text: `Sent ${daysSent}d ago${prop.viewed_at ? " · viewed" : " · not opened"}`,
      href: `/admin/proposals/${prop.id}`,
    })
  }

  for (const project of projects) {
    const awaiting = (project.deliverables ?? []).filter((d: any) => d.status === "awaiting_approval")
    if (awaiting.length > 0) {
      attention.push({
        id: `del-${project.id}`, client: (project.clients as any)?.name ?? "", clientId: project.client_id,
        tag: "Awaiting approval", tagColor: "rgba(15,15,14,0.45)", urgency: 6,
        text: `${awaiting.length} deliverable${awaiting.length > 1 ? "s" : ""} out for review`,
        href: `/admin/clients/${project.client_id}`,
      })
    }
  }

  attention.sort((a, b) => a.urgency - b.urgency)

  /* ─── "Recent activity" feed ─── */

  const activity: ActivityEvent[] = []

  const { data: recentPaidRaw } = await supabase
    .from("invoices").select("id, amount, paid_at, client_id, clients(name)")
    .eq("status", "paid").not("paid_at", "is", null)
    .order("paid_at", { ascending: false }).limit(10)
  for (const inv of (recentPaidRaw ?? []) as any[]) {
    if (inv.paid_at) activity.push({ id: `paid-${inv.id}`, client: inv.clients?.name ?? "", clientId: inv.client_id, label: `Paid $${(inv.amount / 100).toLocaleString()}`, timestamp: new Date(inv.paid_at), icon: "paid" })
  }

  const { data: proposalViewsRaw } = await supabase
    .from("proposals").select("id, client_id, viewed_at, clients(name)")
    .not("viewed_at", "is", null).order("viewed_at", { ascending: false }).limit(10)
  for (const prop of (proposalViewsRaw ?? []) as any[]) {
    if (prop.viewed_at) activity.push({ id: `propview-${prop.id}`, client: prop.clients?.name ?? "", clientId: prop.client_id, label: "Viewed proposal", timestamp: new Date(prop.viewed_at), icon: "viewed" })
  }

  const { data: acceptedPropsRaw } = await supabase
    .from("proposals").select("id, client_id, updated_at, clients(name)")
    .eq("status", "accepted").order("updated_at", { ascending: false }).limit(10)
  for (const prop of (acceptedPropsRaw ?? []) as any[]) {
    if (prop.updated_at) activity.push({ id: `accepted-${prop.id}`, client: prop.clients?.name ?? "", clientId: prop.client_id, label: "Accepted proposal", timestamp: new Date(prop.updated_at), icon: "accepted" })
  }

  const { data: invoiceViewsRaw } = await supabase
    .from("invoices").select("id, client_id, viewed_at, clients(name)")
    .not("viewed_at", "is", null).order("viewed_at", { ascending: false }).limit(10)
  for (const inv of (invoiceViewsRaw ?? []) as any[]) {
    if (inv.viewed_at) activity.push({ id: `invview-${inv.id}`, client: inv.clients?.name ?? "", clientId: inv.client_id, label: "Viewed invoice", timestamp: new Date(inv.viewed_at), icon: "viewed" })
  }

  const { data: approvedReviewsRaw } = await supabase
    .from("review_sessions").select("id, approved_at, projects(title, client_id, clients(name))")
    .not("approved_at", "is", null).order("approved_at", { ascending: false }).limit(10)
  for (const session of (approvedReviewsRaw ?? []) as any[]) {
    if (session.approved_at) { const proj = session.projects as any; activity.push({ id: `revapprove-${session.id}`, client: proj?.clients?.name ?? "", clientId: proj?.client_id ?? "", label: `Approved ${proj?.title ?? "review"}`, timestamp: new Date(session.approved_at), icon: "approved" }) }
  }

  const { data: submittedReviewsRaw } = await supabase
    .from("review_sessions").select("id, submitted_at, projects(title, client_id, clients(name))")
    .not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(10)
  for (const session of (submittedReviewsRaw ?? []) as any[]) {
    if (session.submitted_at) { const proj = session.projects as any; activity.push({ id: `revfeedback-${session.id}`, client: proj?.clients?.name ?? "", clientId: proj?.client_id ?? "", label: `Submitted feedback on ${proj?.title ?? "review"}`, timestamp: new Date(session.submitted_at), icon: "feedback" }) }
  }

  const { data: recentLoginsRaw } = await supabase
    .from("clients").select("id, name, last_seen_at")
    .not("last_seen_at", "is", null).order("last_seen_at", { ascending: false }).limit(10)
  for (const c of (recentLoginsRaw ?? []) as any[]) {
    if (c.last_seen_at) activity.push({ id: `login-${c.id}`, client: c.name ?? "", clientId: c.id, label: "Logged into portal", timestamp: new Date(c.last_seen_at), icon: "login" })
  }

  activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  const recentActivity = activity.slice(0, 10)

  /* ─── Derived data for layout ─── */

  // Split clients: active (has active projects) vs others
  const activeClients: any[] = []
  const otherClients: any[] = []

  for (const client of clients) {
    const clientProjects = projects.filter(p => p.client_id === client.id)
    const hasActive = clientProjects.some(p => p.status === "active")
    if (hasActive) {
      activeClients.push({ ...client, _projects: clientProjects })
    } else {
      otherClients.push({ ...client, _projects: clientProjects })
    }
  }

  return (
    <>
      <PortalNav isAdmin />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px clamp(24px, 4vw, 48px) 64px" }}>

        {/* ━━━ Quick add — utility row ━━━ */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 28 }}>
          {[
            { label: "+ Client", href: "/admin/clients/new" },
            { label: "+ Proposal", href: "/admin/proposals/new" },
            { label: "+ Invoice", href: "/admin/invoices/new" },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
              padding: "7px 12px",
              border: "0.5px solid rgba(15,15,14,0.14)",
              color: "var(--ink)", opacity: 0.4, textDecoration: "none",
              background: "transparent",
            }}>
              {a.label}
            </Link>
          ))}
        </div>

        {/* ━━━ Top band: Attention + Revenue ━━━ */}
        <div className="admin-top-band" style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 48,
          marginBottom: 48,
          paddingBottom: 36,
          borderBottom: "0.5px solid rgba(15,15,14,0.1)",
        }}>

          {/* Left: Needs your attention */}
          <div>
            <div style={sectionLabel}>
              {attention.length > 0
                ? `Needs your attention (${attention.length})`
                : "All clear"
              }
            </div>

            {attention.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 16 }}>
                {attention.slice(0, 4).map(item => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="portal-row-hover"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      padding: "13px 16px 13px 14px",
                      borderLeft: `2px solid ${item.tagColor}`,
                      background: "rgba(255,255,255,0.22)",
                      textDecoration: "none",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--ink)", opacity: 0.84, letterSpacing: "-0.01em" }}>
                          {item.client}
                        </span>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em",
                          textTransform: "uppercase", color: item.tagColor, opacity: 0.88, flexShrink: 0,
                        }}>
                          {item.tag}
                        </span>
                      </div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", opacity: 0.42, lineHeight: 1.4 }}>
                        {item.text}
                      </div>
                    </div>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink)", opacity: 0.18 }}>&rarr;</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 16, fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "var(--text-body)", color: "var(--ink)", opacity: 0.42 }}>
                Nothing needs your attention right now.
              </div>
            )}
          </div>

          {/* Right: Revenue + Quick actions */}
          <div>
            <div style={sectionLabel}>Revenue — {new Date().getFullYear()}</div>

            <div style={{ marginTop: 16 }}>
              {/* Collected */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(28px, 3.5vw, 38px)",
                  letterSpacing: "-0.03em",
                  color: "var(--ink)",
                  opacity: 0.88,
                  lineHeight: 1.05,
                }}>
                  ${Math.round(ytdBilled / 100).toLocaleString()}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.3, marginTop: 4 }}>
                  Collected
                </div>
              </div>

              {/* Secondary numbers */}
              <div style={{ display: "flex", gap: 28 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, letterSpacing: "-0.01em", color: outstanding > 0 ? "var(--amber)" : "var(--ink)", opacity: outstanding > 0 ? 0.88 : 0.35 }}>
                    ${Math.round(outstanding / 100).toLocaleString()}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.3, marginTop: 2 }}>
                    Outstanding
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, letterSpacing: "-0.01em", color: "var(--ink)", opacity: draftTotal > 0 ? 0.6 : 0.3 }}>
                    ${Math.round(draftTotal / 100).toLocaleString()}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.3, marginTop: 2 }}>
                    In drafts
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ━━━ Active clients ━━━ */}
        {activeClients.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <div style={sectionLabel}>Active ({activeClients.length})</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
              {activeClients.map(client => (
                <ClientRow key={client.id} client={client} projects={client._projects} invoicesOpen={invoicesOpen} />
              ))}
            </div>
          </section>
        )}

        {/* ━━━ Other clients ━━━ */}
        {otherClients.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <div style={{ ...sectionLabel, opacity: 0.35 }}>
              {activeClients.length > 0 ? `Other clients (${otherClients.length})` : `All clients (${otherClients.length})`}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 14 }}>
              {otherClients.map(client => (
                <ClientRow key={client.id} client={client} projects={client._projects} invoicesOpen={invoicesOpen} compact />
              ))}
            </div>
          </section>
        )}

        {/* ━━━ Recent activity — bottom section ━━━ */}
        {recentActivity.length > 0 && (
          <section style={{
            marginTop: 16,
            paddingTop: 32,
            borderTop: "0.5px solid rgba(15,15,14,0.08)",
          }}>
            <div style={{ ...sectionLabel, opacity: 0.3 }}>Recent activity</div>

            <div className="admin-activity-grid" style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 32px",
              marginTop: 14,
            }}>
              {recentActivity.map(event => (
                <Link
                  key={event.id}
                  href={`/admin/clients/${event.clientId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                    textDecoration: "none",
                    borderBottom: "0.5px solid rgba(15,15,14,0.04)",
                  }}
                >
                  <div style={{
                    width: 4, height: 4, borderRadius: "50%",
                    background: iconColors[event.icon],
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: 11,
                    color: "var(--ink)", opacity: 0.55, letterSpacing: "-0.01em",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    flex: 1, minWidth: 0,
                  }}>
                    {event.client} · {event.label}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 8,
                    letterSpacing: "0.06em", color: "var(--ink)", opacity: 0.22,
                    flexShrink: 0,
                  }}>
                    {timeAgo(event.timestamp)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}

/* ─── Client Row ─── */

function ClientRow({ client, projects, invoicesOpen, compact }: {
  client: any
  projects: any[]
  invoicesOpen: any[]
  compact?: boolean
}) {
  const activeProjects = projects.filter(p => p.status === "active")
  const clientInvoices = invoicesOpen.filter(i => i.client_id === client.id)
  const clientDue = clientInvoices.reduce((s, i) => s + i.amount, 0)
  const hasReview = projects.some(p => p.deliverables?.some((d: any) => d.status === "awaiting_approval"))
  const rowStatus = hasReview ? "awaiting_approval" : activeProjects.length > 0 ? "in_progress" : projects.length > 0 ? "complete" : "none"

  return (
    <Link
      href={`/admin/clients/${client.id}`}
      className="portal-row-hover"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: compact ? "11px 16px" : "14px 18px",
        textDecoration: "none",
        background: compact ? "transparent" : "rgba(255,255,255,0.22)",
        border: compact ? "none" : "0.5px solid rgba(15,15,14,0.06)",
        borderBottom: compact ? "0.5px solid rgba(15,15,14,0.06)" : undefined,
      }}
    >
      {/* Name + contact */}
      <div className="admin-client-name" style={{ flex: "0 0 200px", minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: compact ? "var(--text-sm)" : "var(--text-body)",
          color: "var(--ink)",
          opacity: compact ? 0.6 : 0.88,
          letterSpacing: "-0.01em",
        }}>
          {client.name}
        </div>
        {!compact && (
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: "var(--text-eyebrow)",
            color: "var(--ink)", opacity: 0.36, marginTop: 1,
          }}>
            {client.contact_name}
            {client.last_seen_at && (
              <span style={{ opacity: 0.6, marginLeft: 6 }}>
                · {new Date(client.last_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Project info */}
      <div className="admin-client-project" style={{ flex: 1, minWidth: 0 }}>
        {activeProjects.length > 0 ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", opacity: 0.5 }}>
            {activeProjects.map(p => p.title).join(", ")}
          </span>
        ) : projects.length > 0 ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", opacity: 0.28 }}>
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </span>
        ) : (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", opacity: 0.2 }}>
            —
          </span>
        )}
      </div>

      {/* Status */}
      <div style={{ flex: "0 0 auto" }}>
        {rowStatus !== "none" && <StatusDot status={rowStatus} />}
      </div>

      {/* Outstanding */}
      <div className="admin-client-outstanding" style={{ flex: "0 0 80px", textAlign: "right" }}>
        {clientDue > 0 ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--amber)", opacity: 0.88 }}>
            ${(clientDue / 100).toLocaleString()}
          </span>
        ) : (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", opacity: 0.15 }}>
            —
          </span>
        )}
      </div>

      {/* Arrow */}
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink)", opacity: 0.14 }}>&rarr;</span>
    </Link>
  )
}

/* ─── Status Dot ─── */

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    awaiting_approval: "var(--amber)",
    in_progress: "var(--sage)",
    complete: "rgba(15,15,14,0.2)",
  }
  const labels: Record<string, string> = {
    awaiting_approval: "Review",
    in_progress: "Active",
    complete: "Done",
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: colors[status] }} />
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 8,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color: colors[status],
      }}>
        {labels[status]}
      </span>
    </div>
  )
}

/* ─── Style constants ─── */

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)" as any,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink)",
  opacity: 0.42,
}
