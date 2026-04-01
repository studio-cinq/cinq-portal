import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import ActivityTracker from "@/components/portal/ActivityTracker"

// ── Status labels ──────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  kickoff_upcoming: "Kickoff Upcoming",
  awaiting_approval: "Awaiting Feedback",
  in_progress:       "In Progress",
  complete:          "Complete",
  not_started:       "Not Started",
  proposal_sent:     "Proposal Ready",
}

const statusColors: Record<string, string> = {
  kickoff_upcoming:  "var(--sage)",
  awaiting_approval: "var(--amber)",
  in_progress:       "var(--sage)",
  complete:          "rgba(15,15,14,0.22)",
  not_started:       "rgba(15,15,14,0.15)",
  proposal_sent:     "rgba(15,15,14,0.15)",
}

function StatusBadge({ status }: { status: string }) {
  const label = statusLabels[status] ?? status
  const color = statusColors[status] ?? "rgba(15,15,14,0.2)"

  return (
    <span style={{
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-eyebrow)",
      letterSpacing: "0.1em", textTransform: "uppercase",
      color,
    }}>
      {label}
    </span>
  )
}

// ── Activity feed builder ──────────────────────────────────────────────────────

interface FeedItem {
  date: Date
  label: string
  link?: string
  type: "invoice" | "message" | "deliverable" | "review" | "file" | "event" | "proposal"
}

function buildActivityFeed(opts: {
  invoices: any[]
  messages: any[]
  deliverables: any[]
  reviewSessions: any[]
  brandAssets: any[]
  presentations: any[]
  proposals: any[]
}): FeedItem[] {
  const feed: FeedItem[] = []

  // Invoice events
  for (const inv of opts.invoices) {
    if (inv.paid_at) {
      feed.push({
        date: new Date(inv.paid_at),
        label: `Invoice #${inv.invoice_number} paid — $${(inv.amount / 100).toLocaleString()}`,
        link: "/invoices",
        type: "invoice",
      })
    } else if (inv.status === "sent" || inv.status === "overdue") {
      feed.push({
        date: new Date(inv.created_at),
        label: `Invoice #${inv.invoice_number} sent — $${(inv.amount / 100).toLocaleString()}`,
        link: "/invoices",
        type: "invoice",
      })
    }
  }

  // Messages from admin (not private, not from client)
  for (const msg of opts.messages) {
    if (!msg.from_client && !msg.private) {
      const preview = msg.body?.slice(0, 60) ?? ""
      feed.push({
        date: new Date(msg.created_at),
        label: `Message from Kacie${preview ? `: "${preview}${msg.body?.length > 60 ? "…" : ""}"` : ""}`,
        type: "message",
      })
    }
  }

  // Proposal acceptance
  for (const prop of opts.proposals) {
    if (prop.status === "accepted") {
      feed.push({
        date: new Date(prop.viewed_at ?? prop.created_at),
        label: `Proposal accepted — ${prop.title}`,
        type: "proposal",
      })
    }
  }

  // Review sessions
  for (const rs of opts.reviewSessions) {
    if (rs.submitted_at) {
      feed.push({
        date: new Date(rs.submitted_at),
        label: `Feedback submitted — Round ${rs.current_round}`,
        type: "review",
      })
    }
    if (rs.approved_at) {
      feed.push({
        date: new Date(rs.approved_at),
        label: "Design approved",
        type: "review",
      })
    }
  }

  // Brand assets uploaded
  for (const asset of opts.brandAssets) {
    feed.push({
      date: new Date(asset.created_at),
      label: `File shared — ${asset.name}`,
      link: "/library",
      type: "file",
    })
  }

  // Presentation slides uploaded (group by deliverable)
  const slidesByDeliverable = new Map<string, { count: number, date: Date, name: string }>()
  for (const slide of opts.presentations) {
    const key = slide.deliverable_id ?? slide.project_id ?? "unknown"
    const existing = slidesByDeliverable.get(key)
    const slideDate = new Date(slide.created_at)
    if (!existing || slideDate > existing.date) {
      slidesByDeliverable.set(key, {
        count: (existing?.count ?? 0) + 1,
        date: slideDate,
        name: slide.caption ?? "Presentation",
      })
    }
  }
  for (const [, group] of Array.from(slidesByDeliverable)) {
    feed.push({
      date: group.date,
      label: `Presentation uploaded — ${group.count} slide${group.count > 1 ? "s" : ""}`,
      type: "deliverable",
    })
  }

  // Sort by date descending, take recent 8
  feed.sort((a, b) => b.date.getTime() - a.date.getTime())
  return feed.slice(0, 8)
}

// ── Relative time formatting ───────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: clientRaw } = await supabase
    .from("clients").select("*")
    .eq("contact_email", user?.email ?? "").single()
  const client = clientRaw as any

  const clientId = client?.id ?? ""
  const isFirstLogin = !client?.first_login_at
  const firstName = (client?.contact_name ?? client?.name ?? "").split(" ")[0] || "there"

  // Fetch projects first (needed for project-scoped queries)
  const projectsRes = await supabase
    .from("projects").select("*, deliverables(*)")
    .eq("client_id", clientId).order("created_at", { ascending: false })
  const projects = (projectsRes.data ?? []) as any[]
  const projectIds = projects.map((p: any) => p.id)

  // Fetch remaining data in parallel
  const [invoicesRes, messagesRes, reviewsRes, assetsRes, slidesRes, proposalsRes] = await Promise.all([
    supabase.from("invoices").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("messages").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
    supabase.from("review_sessions").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    projectIds.length > 0
      ? supabase.from("brand_assets").select("*").in("project_id", projectIds).order("created_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length > 0
      ? supabase.from("presentation_slides").select("*").in("project_id", projectIds).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("proposals").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
  ])

  const allInvoices = (invoicesRes.data ?? []) as any[]
  const messages = (messagesRes.data ?? []) as any[]
  const reviewSessions = (reviewsRes.data ?? []) as any[]
  const clientAssets = (assetsRes.data ?? []) as any[]
  const clientSlides = (slidesRes.data ?? []) as any[]
  const proposals = (proposalsRes.data ?? []) as any[]

  // Outstanding invoices
  const dueInvoices = allInvoices.filter(i => i.status === "sent" || i.status === "overdue")

  // Paid total
  const paidTotal = allInvoices
    .filter(i => i.status === "paid")
    .reduce((s, i) => s + (i.amount ?? 0), 0)

  const dueTotal = dueInvoices.reduce((s, i) => s + (i.amount ?? 0), 0)

  // Activity feed
  const feed = buildActivityFeed({
    invoices: allInvoices,
    messages,
    deliverables: [],
    reviewSessions,
    brandAssets: clientAssets,
    presentations: clientSlides,
    proposals,
  })

  // Needs attention: due invoices + deliverables awaiting review
  const attentionItems: { label: string; sublabel: string; link: string; color: string }[] = []

  for (const inv of dueInvoices) {
    attentionItems.push({
      label: `Invoice #${inv.invoice_number} due`,
      sublabel: `$${(inv.amount / 100).toLocaleString()}${inv.due_date ? ` · Due ${new Date(inv.due_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`,
      link: "/invoices",
      color: "var(--amber)",
    })
  }

  for (const project of projects) {
    for (const d of (project.deliverables ?? [])) {
      if (d.status === "awaiting_approval") {
        attentionItems.push({
          label: `Feedback requested`,
          sublabel: `${d.name} — ${project.title}`,
          link: `/projects/${project.id}`,
          color: "var(--sage)",
        })
      }
    }
  }

  // Compute project status
  function projectStatus(project: any): string {
    const deliverables = project.deliverables ?? []
    if (deliverables.length === 0) return project.status ?? "kickoff_upcoming"
    const hasReview = deliverables.some((d: any) => d.status === "awaiting_approval")
    const hasActive = deliverables.some((d: any) => d.status === "in_progress")
    const allDone = deliverables.length > 0 && deliverables.every((d: any) => d.status === "complete")
    if (hasReview) return "awaiting_approval"
    if (hasActive) return "in_progress"
    if (allDone) return "complete"
    return project.status ?? "not_started"
  }

  return (
    <>
      <PortalNav clientName={client?.name} />
      <ActivityTracker />

      <main style={{
        padding: "clamp(40px, 8vh, 64px) clamp(24px, 5vw, 48px)",
        maxWidth: 960,
        margin: "0 auto",
      }}>

        {/* ── Greeting ── */}
        <div style={{ marginBottom: isFirstLogin ? 16 : 44 }}>
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(24px, 3vw, 32px)",
            letterSpacing: "-0.01em",
            opacity: 0.9,
          }}>
            {isFirstLogin ? `Welcome, ${firstName}` : `Hello, ${firstName}`}
          </div>
        </div>

        {/* ── First login orientation ── */}
        {isFirstLogin && (
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body)",
            lineHeight: 1.8,
            opacity: 0.55,
            maxWidth: 540,
            marginBottom: 48,
          }}>
            This is your client portal — your home base for project details, invoices, files, and next steps with Studio Cinq.
          </div>
        )}

        {/* ── Returning login subtitle ── */}
        {!isFirstLogin && (
          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body)",
            opacity: 0.4,
            marginBottom: 44,
            marginTop: -36,
          }}>
            Here&apos;s a snapshot of what&apos;s active in your portal.
          </div>
        )}

        {/* ── Needs attention ── */}
        {attentionItems.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={sectionLabel}>Needs your attention</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {attentionItems.map((item, i) => (
                <Link key={i} href={item.link} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(255,255,255,0.3)",
                  border: "0.5px solid rgba(15,15,14,0.1)",
                  padding: "16px 20px",
                  textDecoration: "none", gap: 16,
                }}>
                  <div>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-eyebrow)",
                      letterSpacing: "0.12em", textTransform: "uppercase",
                      color: item.color, marginBottom: 4,
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-body)",
                      color: "var(--ink)", opacity: 0.6,
                    }}>
                      {item.sublabel}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--ink)", opacity: 0.18 }}>&rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Projects ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Projects</div>

          {projects.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
              {projects.map(project => {
                const status = projectStatus(project)
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="project-row"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "20px 0",
                      borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                      textDecoration: "none", gap: 16,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "clamp(16px, 2vw, 20px)",
                        color: "var(--ink)", opacity: 0.85,
                        letterSpacing: "-0.01em",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {project.title}
                      </div>
                      {project.scope && (
                        <div style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-eyebrow)",
                          letterSpacing: "0.08em", textTransform: "uppercase",
                          color: "var(--ink)", opacity: 0.3, marginTop: 4,
                        }}>
                          {project.scope}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <StatusBadge status={status} />
                      <span style={{ fontSize: 11, color: "var(--ink)", opacity: 0.18 }}>&rarr;</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div style={{
              padding: "32px 0",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              color: "var(--ink)", opacity: 0.4,
              lineHeight: 1.7,
            }}>
              {isFirstLogin
                ? "Your project is being set up. Once everything is ready, you'll see deliverables, timelines, and next steps right here."
                : "No active projects at the moment."
              }
            </div>
          )}
        </div>

        {/* ── Recent Activity (returning users, or first login with activity) ── */}
        {feed.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={sectionLabel}>Recent activity</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
              {feed.map((item, i) => {
                const inner = (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "baseline", justifyContent: "space-between",
                      padding: "14px 0",
                      borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                      gap: 16,
                    }}
                  >
                    <span style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-body)",
                      color: "var(--ink)", opacity: 0.65,
                      lineHeight: 1.5,
                    }}>
                      {item.label}
                    </span>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-eyebrow)",
                      color: "var(--ink)", opacity: 0.3,
                      flexShrink: 0, whiteSpace: "nowrap",
                    }}>
                      {relativeTime(item.date)}
                    </span>
                  </div>
                )

                if (item.link) {
                  return <Link key={i} href={item.link} style={{ textDecoration: "none" }}>{inner}</Link>
                }
                return inner
              })}
            </div>
          </div>
        )}

        {/* ── First login: What Happens Next ── */}
        {isFirstLogin && projects.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={sectionLabel}>What happens next</div>
            <div style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              color: "var(--ink)", opacity: 0.5,
              lineHeight: 1.8,
            }}>
              Your project is underway. You&apos;ll be notified here and by email when deliverables are ready for your review, invoices are due, or when anything needs your input.
            </div>
          </div>
        )}

        {/* ── Billing snapshot ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Billing</div>
          {allInvoices.length > 0 ? (
            <div style={{
              display: "flex", gap: 32, padding: "16px 0",
              borderTop: "0.5px solid rgba(15,15,14,0.08)",
              borderBottom: "0.5px solid rgba(15,15,14,0.08)",
            }}>
              {paidTotal > 0 && (
                <div>
                  <div style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-eyebrow)",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    opacity: 0.35, marginBottom: 6,
                  }}>
                    Paid
                  </div>
                  <div style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 18, opacity: 0.8, letterSpacing: "-0.01em",
                  }}>
                    ${(paidTotal / 100).toLocaleString()}
                  </div>
                </div>
              )}
              {dueTotal > 0 && (
                <div>
                  <div style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-eyebrow)",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "var(--amber)", opacity: 0.85, marginBottom: 6,
                  }}>
                    Outstanding
                  </div>
                  <div style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 18, opacity: 0.8, letterSpacing: "-0.01em",
                  }}>
                    ${(dueTotal / 100).toLocaleString()}
                  </div>
                </div>
              )}
              {paidTotal > 0 && dueTotal === 0 && (
                <div style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-body)",
                  opacity: 0.4, alignSelf: "center",
                }}>
                  No outstanding invoices
                </div>
              )}
              <div style={{ marginLeft: "auto", alignSelf: "center" }}>
                <Link href="/invoices" style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-eyebrow)",
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "var(--ink)", opacity: 0.4,
                  textDecoration: "none",
                }}>
                  View all &rarr;
                </Link>
              </div>
            </div>
          ) : (
            <div style={{
              padding: "16px 0",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              color: "var(--ink)", opacity: 0.4,
            }}>
              No invoices at this time.
            </div>
          )}
        </div>

        {/* ── Resources ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Resources</div>
          <div style={{
            padding: "16px 0",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body)",
            color: "var(--ink)", opacity: 0.4,
            lineHeight: 1.7,
          }}>
            {clientAssets.length > 0 ? (
              <Link href="/library" style={{ color: "var(--ink)", opacity: 0.6, textDecoration: "none" }}>
                {clientAssets.length} file{clientAssets.length !== 1 ? "s" : ""} available in your brand library &rarr;
              </Link>
            ) : (
              "Files, presentations, and project materials will appear here as the project progresses."
            )}
          </div>
        </div>

      </main>
    </>
  )
}

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)" as any,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink)",
  opacity: 0.38,
  marginBottom: 14,
}
