import { createServerComponentClient } from "@/lib/supabase-server"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"
import { notFound } from "next/navigation"
import ProjectFiles from "./ProjectFiles"
import ClientContext from "./ClientContext"

/* ─── Shared styles ─── */
const mono = { fontFamily: "var(--font-mono)" } as const
const sans = { fontFamily: "var(--font-sans)" } as const
const serif = { fontFamily: "var(--font-serif)" } as const

const sectionLabel: React.CSSProperties = {
  ...mono,
  fontSize: "var(--text-eyebrow)",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  opacity: 0.5,
  marginBottom: 16,
}

const linkRow: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 14,
  padding: "12px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)",
  textDecoration: "none", color: "inherit",
}

/* ─── Helpers ─── */
function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
}

function fmtDate(d: string | null | undefined, opts?: { withYear?: boolean }) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: opts?.withYear ? "numeric" : undefined,
  })
}

function relTime(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 14) return `${days}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/* ─── Status badges ─── */
function ProjectStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "var(--sage)",
    complete: "rgba(15,15,14,0.4)",
    on_hold: "var(--amber)",
    proposal_sent: "var(--amber)",
    awaiting_client: "var(--amber)",
  }
  const labels: Record<string, string> = {
    active: "Active",
    complete: "Complete",
    on_hold: "On hold",
    proposal_sent: "Proposal sent",
    awaiting_client: "Awaiting client",
  }
  return <span style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)" }}>{labels[status] ?? status}</span>
}

function FocusStateBadge({ state }: { state: string | null }) {
  if (!state) return null
  const labels: Record<string, string> = { focus_today: "In focus today", in_queue: "In the queue" }
  const colors: Record<string, string> = { focus_today: "var(--sage)", in_queue: "rgba(15,15,14,0.45)" }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", color: colors[state] ?? "rgba(15,15,14,0.4)" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: colors[state] ?? "rgba(15,15,14,0.4)", display: "inline-block" }} />
      {labels[state] ?? state}
    </span>
  )
}

function InvStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { paid: "var(--sage)", sent: "var(--amber)", overdue: "var(--danger)", draft: "rgba(15,15,14,0.35)" }
  return <span style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)" }}>{status}</span>
}

/* ─── Activity event ─── */
type ActivityEvent = {
  id: string
  kind:
    | "invoice_sent" | "invoice_paid" | "invoice_overdue"
    | "foundation_published" | "foundation_approved"
    | "message_in" | "message_out"
    | "review_submitted" | "review_approved"
    | "project_created" | "status_change"
    | "file_uploaded" | "note_added"
  timestamp: Date
  label: string
  detail?: string
  href?: string
  icon: "sage" | "amber" | "muted"
}

const STATUS_LABELS: Record<string, string> = {
  proposal_sent: "Proposal sent",
  active: "Active",
  awaiting_client: "Awaiting client",
  on_hold: "On hold",
  complete: "Complete",
}

function statusChangeLabel(from: string | null, to: string): { label: string; icon: "sage" | "amber" | "muted" } {
  const fromLbl = from ? (STATUS_LABELS[from] ?? from) : "—"
  const toLbl = STATUS_LABELS[to] ?? to
  if (to === "complete") return { label: `Marked complete`, icon: "sage" }
  if (to === "awaiting_client") return { label: `Sent to client — awaiting response`, icon: "amber" }
  if (to === "on_hold") return { label: `Paused — on hold`, icon: "amber" }
  if (to === "active" && from === "on_hold") return { label: `Resumed`, icon: "sage" }
  if (to === "active" && from === "awaiting_client") return { label: `Client responded — back to active`, icon: "sage" }
  if (to === "active") return { label: `Moved to active`, icon: "sage" }
  if (to === "proposal_sent") return { label: `Proposal sent`, icon: "amber" }
  return { label: `Status: ${fromLbl} → ${toLbl}`, icon: "muted" }
}

export default async function ProjectOverviewPage({ params }: { params: { id: string } }) {
  const supabase = await createServerComponentClient()

  /* ─── Fetch project + related data in parallel ─── */
  const [
    projectRes,
    invoicesRes,
    foundationsRes,
    messagesRes,
    reviewsRes,
    assetsRes,
    deliverablesRes,
    projectFilesRes,
    projectNotesRes,
    statusChangesRes,
  ] = await Promise.all([
    supabase.from("projects").select("*, clients(id, name)").eq("id", params.id).single(),
    supabase.from("invoices").select("*").eq("project_id", params.id).order("created_at", { ascending: false }),
    supabase.from("brand_foundations").select("*").eq("project_id", params.id).order("updated_at", { ascending: false }),
    supabase.from("messages").select("*").eq("project_id", params.id).order("created_at", { ascending: false }),
    supabase.from("review_sessions").select("*").eq("project_id", params.id).order("created_at", { ascending: false }),
    supabase.from("brand_assets").select("id, name, category").eq("project_id", params.id),
    supabase.from("deliverables").select("*").eq("project_id", params.id).order("sort_order", { ascending: true }),
    supabase.from("project_files").select("*").eq("project_id", params.id).order("uploaded_at", { ascending: false }),
    supabase.from("project_notes").select("*").eq("project_id", params.id).order("created_at", { ascending: false }),
    supabase.from("project_status_changes").select("*").eq("project_id", params.id).order("changed_at", { ascending: false }),
  ])

  if (projectRes.error || !projectRes.data) return notFound()

  const project = projectRes.data as any
  const client = project.clients as any
  const invoices = (invoicesRes.data ?? []) as any[]
  const foundations = (foundationsRes.data ?? []) as any[]
  const messages = (messagesRes.data ?? []) as any[]
  const reviews = (reviewsRes.data ?? []) as any[]
  const assets = (assetsRes.data ?? []) as any[]
  const deliverables = (deliverablesRes.data ?? []) as any[]
  const projectFiles = (projectFilesRes.data ?? []) as any[]
  const projectNotes = (projectNotesRes.data ?? []) as any[]
  const statusChanges = (statusChangesRes.data ?? []) as any[]

  /* ─── Build activity timeline (most recent first) ─── */
  const activity: ActivityEvent[] = []

  activity.push({
    id: `proj-created-${project.id}`,
    kind: "project_created",
    timestamp: new Date(project.created_at),
    label: "Project created",
    icon: "muted",
  })

  for (const inv of invoices) {
    if (inv.created_at) activity.push({
      id: `inv-sent-${inv.id}`,
      kind: "invoice_sent",
      timestamp: new Date(inv.created_at),
      label: `Invoice #${inv.invoice_number} sent · ${fmtMoney(inv.amount)}`,
      icon: "muted",
      href: `/admin/invoices/${inv.id}/edit`,
    })
    if (inv.paid_at) activity.push({
      id: `inv-paid-${inv.id}`,
      kind: "invoice_paid",
      timestamp: new Date(inv.paid_at),
      label: `Invoice #${inv.invoice_number} paid · ${fmtMoney(inv.amount)}`,
      icon: "sage",
      href: `/admin/invoices/${inv.id}/edit`,
    })
  }

  for (const f of foundations) {
    if (f.created_at) activity.push({
      id: `found-created-${f.id}`,
      kind: "foundation_published",
      timestamp: new Date(f.updated_at ?? f.created_at),
      label: f.status === "published" ? "Brand foundations sent to client" : `Foundation status: ${f.status}`,
      detail: f.title || "Brand Foundations",
      icon: f.status === "published" ? "amber" : "muted",
      href: `/admin/foundations/${f.id}/edit`,
    })
    if (f.approved_at) activity.push({
      id: `found-approved-${f.id}`,
      kind: "foundation_approved",
      timestamp: new Date(f.approved_at),
      label: "Brand direction approved",
      detail: f.approval_note || undefined,
      icon: "sage",
      href: `/admin/foundations/${f.id}/edit`,
    })
  }

  for (const m of messages) {
    activity.push({
      id: `msg-${m.id}`,
      kind: m.from_client ? "message_in" : "message_out",
      timestamp: new Date(m.created_at),
      label: m.from_client ? `Message from ${m.sender_name ?? "client"}` : `Message sent to client`,
      detail: (m.body ?? "").slice(0, 120),
      icon: m.from_client ? "amber" : "muted",
    })
  }

  for (const r of reviews) {
    if (r.submitted_at) activity.push({
      id: `rev-submitted-${r.id}`,
      kind: "review_submitted",
      timestamp: new Date(r.submitted_at),
      label: `Review round ${r.current_round ?? ""} feedback submitted`,
      icon: "amber",
      href: `/admin/reviews`,
    })
    if (r.approved_at) activity.push({
      id: `rev-approved-${r.id}`,
      kind: "review_approved",
      timestamp: new Date(r.approved_at),
      label: "Site approved",
      icon: "sage",
      href: `/admin/reviews`,
    })
  }

  for (const sc of statusChanges as any[]) {
    const info = statusChangeLabel(sc.from_status, sc.to_status)
    activity.push({
      id: `sc-${sc.id}`,
      kind: "status_change",
      timestamp: new Date(sc.changed_at),
      label: info.label,
      icon: info.icon,
    })
  }

  for (const f of projectFiles as any[]) {
    activity.push({
      id: `file-${f.id}`,
      kind: "file_uploaded",
      timestamp: new Date(f.uploaded_at),
      label: "File added",
      detail: f.name,
      icon: "muted",
    })
  }

  for (const n of projectNotes as any[]) {
    activity.push({
      id: `note-${n.id}`,
      kind: "note_added",
      timestamp: new Date(n.created_at),
      label: n.source ? `Note from ${n.source}` : "Context note added",
      detail: (n.body ?? "").slice(0, 120),
      icon: "muted",
    })
  }

  activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  const recentActivity = activity.slice(0, 25)

  /* ─── Money summary ─── */
  const invoiceTotalBilled = invoices.reduce((sum, i) => sum + (i.amount ?? 0), 0)
  const invoicePaidTotal = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.amount ?? 0), 0)
  const invoiceOutstanding = invoiceTotalBilled - invoicePaidTotal

  return (
    <>
      <PortalNav isAdmin />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px clamp(24px, 4vw, 56px) 96px" }}>

        {/* ─── Breadcrumb ─── */}
        <div style={{ marginBottom: 20 }}>
          <Link href={client?.id ? `/admin/clients/${client.id}` : "/admin/studio"} style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none" }}>
            ← {client?.name ?? "Studio"}
          </Link>
        </div>

        {/* ─── Header strip ─── */}
        <header style={{ marginBottom: 56, paddingBottom: 28, borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
          <h1 style={{ ...sans, fontWeight: 400, fontSize: 34, letterSpacing: "-0.02em", margin: "0 0 18px", opacity: 0.95, lineHeight: 1.1 }}>
            {project.title}
          </h1>
          {project.scope && (
            <div style={{ ...serif, fontStyle: "italic", fontSize: 16, opacity: 0.6, marginBottom: 22, lineHeight: 1.55, maxWidth: 720 }}>
              {project.scope}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
            <ProjectStatusBadge status={project.status} />
            <FocusStateBadge state={project.focus_state} />
            {project.end_date && (
              <span style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", opacity: 0.5 }}>
                <span style={{ opacity: 0.6 }}>Due ·</span> {fmtDate(project.end_date)}
              </span>
            )}
            {!project.end_date && project.start_date && (
              <span style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", opacity: 0.4 }}>
                <span style={{ opacity: 0.7 }}>Started ·</span> {fmtDate(project.start_date)}
              </span>
            )}
            <span style={{ flex: 1 }} />
            <Link href={`/brand-kit/${project.id}`} target="_blank" style={{
              ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--ink)", opacity: 0.6, textDecoration: "none",
              border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
            }}>
              Brand kit ↗
            </Link>
            <Link href={`/admin/projects/${project.id}/edit`} style={{
              ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--ink)", opacity: 0.6, textDecoration: "none",
              border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
            }}>
              Edit project
            </Link>
          </div>
        </header>

        {/* ─── Body: 2-column ─── */}
        <div className="project-overview-grid" style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 64,
          alignItems: "start",
        }}>

          {/* ━━━ Left: Activity timeline ━━━ */}
          <div>
            <div style={sectionLabel}>Activity</div>
            {recentActivity.length === 0 ? (
              <div style={{ ...serif, fontStyle: "italic", fontSize: 15, opacity: 0.5, padding: "16px 0" }}>
                No activity yet.
              </div>
            ) : (
              <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
                {recentActivity.map(ev => {
                  const dotColor = ev.icon === "sage" ? "var(--sage)" : ev.icon === "amber" ? "var(--amber)" : "rgba(15,15,14,0.25)"
                  const inner = (
                    <>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 8,
                        background: dotColor,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.88, lineHeight: 1.4 }}>{ev.label}</div>
                        {ev.detail && <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.5, marginTop: 2, lineHeight: 1.5 }}>{ev.detail}</div>}
                      </div>
                      <div style={{ ...mono, fontSize: 10, letterSpacing: "0.08em", opacity: 0.4, flexShrink: 0, marginTop: 5 }}>
                        {relTime(ev.timestamp)}
                      </div>
                    </>
                  )
                  return ev.href ? (
                    <a key={ev.id} href={ev.href} style={linkRow}>{inner}</a>
                  ) : (
                    <div key={ev.id} style={linkRow}>{inner}</div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ━━━ Right: Stacked panels ━━━ */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 48 }}>

            {/* Client context */}
            <ClientContext projectId={params.id} initialNotes={projectNotes} />

            {/* Money */}
            <section>
              {invoices.length === 0 ? (
                <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.4, display: "flex", alignItems: "center", gap: 10 }}>
                  <span>Money</span>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span style={{ ...serif, fontStyle: "italic", fontSize: 13, letterSpacing: "0", textTransform: "none", opacity: 0.7 }}>
                    No invoices yet
                  </span>
                </div>
              ) : (
                <>
                  <div style={sectionLabel}>Money</div>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
                    padding: "14px 16px", marginBottom: 14,
                    background: "rgba(255,255,255,0.42)",
                    border: "0.5px solid rgba(15,15,14,0.08)",
                  }}>
                    <div>
                      <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.4, marginBottom: 4 }}>Paid</div>
                      <div style={{ ...sans, fontSize: 18, opacity: 0.92, letterSpacing: "-0.01em" }}>{fmtMoney(invoicePaidTotal)}</div>
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.4, marginBottom: 4 }}>Outstanding</div>
                      <div style={{ ...sans, fontSize: 18, opacity: invoiceOutstanding > 0 ? 0.92 : 0.5, letterSpacing: "-0.01em", color: invoiceOutstanding > 0 ? "var(--amber)" : "inherit" }}>
                        {fmtMoney(invoiceOutstanding)}
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
                    {invoices.map(inv => (
                      <a key={inv.id} href={`/admin/invoices/${inv.id}/edit`} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                        textDecoration: "none", color: "inherit",
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.85 }}>#{inv.invoice_number}</div>
                          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.08em", opacity: 0.4, marginTop: 2 }}>
                            {fmtMoney(inv.amount)}
                          </div>
                        </div>
                        <InvStatusBadge status={inv.status} />
                      </a>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* Foundations */}
            {foundations.length > 0 && (
              <section>
                <div style={sectionLabel}>Brand Foundations</div>
                <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
                  {foundations.map(f => (
                    <a key={f.id} href={`/admin/foundations/${f.id}/edit`} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                      textDecoration: "none", color: "inherit", gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.85 }}>{f.title || "Brand Foundations"}</div>
                      </div>
                      <span style={{ ...mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.45 }}>
                        {f.status}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Review sessions */}
            {reviews.length > 0 && (
              <section>
                <div style={sectionLabel}>Reviews</div>
                <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)", gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.85 }}>Round {r.current_round ?? 1}</div>
                      </div>
                      <span style={{ ...mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.45 }}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Deliverables */}
            {deliverables.length > 0 && (
              <section>
                <div style={sectionLabel}>Deliverables</div>
                <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
                  {deliverables.map(d => (
                    <div key={d.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                      padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                    }}>
                      <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.85, flex: 1, minWidth: 0 }}>{d.name}</div>
                      <span style={{ ...mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.45 }}>
                        {d.status ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Files */}
            {assets.length > 0 && (
              <section>
                <div style={sectionLabel}>Files {assets.length > 0 && <span style={{ opacity: 0.6 }}>· {assets.length}</span>}</div>
                <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.65, lineHeight: 1.6 }}>
                  {assets.length} file{assets.length === 1 ? "" : "s"} in the brand library for this project.
                </div>
              </section>
            )}

          </aside>
        </div>

        {/* ─── Project files (admin-only working files) ─── */}
        <div style={{ marginTop: 72, paddingTop: 48, borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
          <ProjectFiles projectId={params.id} initialFiles={projectFiles} />
        </div>

        {/* Mobile collapse */}
        <style>{`
          @media (max-width: 880px) {
            .project-overview-grid {
              grid-template-columns: 1fr !important;
              gap: 48px !important;
            }
          }
        `}</style>
      </main>
    </>
  )
}
