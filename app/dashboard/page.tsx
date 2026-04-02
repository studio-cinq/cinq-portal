import { createServerComponentClient } from "@/lib/supabase-server"
import { getPortalLibrarySnapshotByEmail } from "@/lib/portal-library"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import ActivityTracker from "@/components/portal/ActivityTracker"

/* ─── Status helpers ─── */

const statusLabels: Record<string, string> = {
  kickoff_upcoming: "Kickoff Upcoming",
  awaiting_approval: "Awaiting Feedback",
  in_progress: "In Progress",
  complete: "Complete",
  not_started: "Not Started",
  proposal_sent: "Proposal Ready",
}

function formatCurrency(amount = 0) {
  return `$${(amount / 100).toLocaleString()}`
}

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

function statusColor(status: string) {
  if (status === "awaiting_approval") return "var(--amber)"
  if (status === "in_progress") return "var(--sage)"
  return "rgba(15,15,14,0.34)"
}

function deliverableDotColor(status: string) {
  if (status === "awaiting_approval") return "var(--amber)"
  if (status === "in_progress") return "var(--sage)"
  if (status === "complete" || status === "approved") return "rgba(15,15,14,0.24)"
  return "rgba(15,15,14,0.08)"
}

/* ─── Contextual hero content ─── */

function heroContent(status: string, firstName: string, hasProject: boolean, isComplete: boolean) {
  if (!hasProject) {
    return {
      eyebrow: null,
      greeting: `Welcome, ${firstName}`,
      subline: "Your portal will come to life once your project begins.",
    }
  }

  if (status === "awaiting_approval") {
    return {
      eyebrow: { label: "Awaiting your review", color: "var(--amber)" },
      greeting: `${firstName}, your feedback is needed`,
      subline: "A deliverable is ready for your review.",
    }
  }

  if (isComplete) {
    return {
      eyebrow: { label: "Complete", color: "rgba(15,15,14,0.34)" },
      greeting: `Hello, ${firstName}`,
      subline: "Your project is complete. Final files and materials are available in your library.",
    }
  }

  return {
    eyebrow: { label: "In progress", color: "var(--sage)" },
    greeting: `Hello, ${firstName}`,
    subline: ["Your place for project updates, shared files, invoices,", "and next steps with Studio Cinq."],
  }
}

/* ─── Next step types ─── */

type NextStep = {
  label: string
  body: string
  href: string
  accent: string
  tag: string
}

/* ─── Page ─── */

export default async function DashboardPage() {
  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()

  const portalLibrary = await getPortalLibrarySnapshotByEmail(user?.email ?? "")
  const client = portalLibrary.client as any
  const clientId = client?.id ?? ""
  const firstName = (client?.contact_name ?? client?.name ?? "").split(" ")[0] || "there"

  const projectsRes = await supabase
    .from("projects")
    .select("*, deliverables(*)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
  const projects = (projectsRes.data ?? []) as any[]

  const invoicesRes = await supabase
    .from("invoices")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
  const allInvoices = (invoicesRes.data ?? []) as any[]

  // Fetch accepted proposals for this client
  const proposalsRes = await supabase
    .from("proposals")
    .select("*, proposal_items(*)")
    .eq("client_id", clientId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1)
  const acceptedProposal = (proposalsRes.data?.[0] ?? null) as any

  const proposalItems = (acceptedProposal?.proposal_items ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const approvedScope = proposalItems.filter((i: any) => i.accepted && i.phase === "now")
  const laterPhase = proposalItems.filter((i: any) => i.accepted && i.phase === "later")

  const currentProject =
    projects.find((p) => {
      const s = projectStatus(p)
      return s === "in_progress" || s === "awaiting_approval" || s === "kickoff_upcoming"
    }) ?? projects[0] ?? null

  const currentStatus = currentProject ? projectStatus(currentProject) : "not_started"
  const deliverables = (currentProject?.deliverables ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const completedCount = deliverables.filter((d: any) => d.status === "complete" || d.status === "approved").length

  const dueInvoices = allInvoices.filter((inv) => inv.status === "sent" || inv.status === "overdue")
  const paidTotal = allInvoices.filter((inv) => inv.status === "paid").reduce((s, inv) => s + (inv.amount ?? 0), 0)
  const dueTotal = dueInvoices.reduce((s, inv) => s + (inv.amount ?? 0), 0)
  const totalContract = paidTotal + dueTotal
  const paidPct = totalContract > 0 ? Math.round((paidTotal / totalContract) * 100) : 100

  /* ─── Next steps (only actionable items) ─── */

  const nextSteps: NextStep[] = []

  if (currentProject) {
    const awaitingFeedback = deliverables.filter((d: any) => d.status === "awaiting_approval")
    if (awaitingFeedback.length > 0) {
      nextSteps.push({
        label: "Review the latest deliverable",
        body: "Your feedback is needed before we move into the next stage.",
        href: `/projects/${currentProject.id}`,
        accent: "var(--amber)",
        tag: "Feedback needed",
      })
    }
  }

  if (dueInvoices.length > 0) {
    nextSteps.push({
      label: "Review your current invoice",
      body: "Payment can be completed in the billing section.",
      href: "/invoices",
      accent: "var(--amber)",
      tag: "Billing",
    })
  }

  const filesCount = portalLibrary.assets.length
  const colors = portalLibrary.colors ?? []
  const typefaces = portalLibrary.typefaces ?? []
  const showLibrary = portalLibrary.isUnlocked && filesCount > 0

  // Only show actionable next steps — skip the low-priority "browse files" if it's the only one
  const hasActionableSteps = nextSteps.length > 0

  /* ─── Hero content ─── */

  const hero = heroContent(currentStatus, firstName, !!currentProject, currentStatus === "complete")

  return (
    <>
      <PortalNav clientName={client?.name} />
      <ActivityTracker />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "clamp(24px, 4vw, 40px)" }}>

        {/* ━━━ Hero ━━━ */}
        <section
          className="portal-reveal"
          style={{
            paddingBottom: 36,
            marginBottom: 36,
            borderBottom: "0.5px solid rgba(15,15,14,0.1)",
          }}
        >
          <div style={{ maxWidth: 580 }}>
            {/* Status eyebrow */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              {hero.eyebrow && (
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: hero.eyebrow.color, flexShrink: 0,
                }} />
              )}
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-eyebrow)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: hero.eyebrow?.color ?? "rgba(15,15,14,0.34)",
              }}>
                {hero.eyebrow?.label ?? "Client Portal"}
              </span>
            </div>

            <h1 style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(36px, 5.5vw, 56px)",
              lineHeight: 1.0,
              letterSpacing: "-0.035em",
              fontWeight: 400,
              color: "var(--ink)",
              opacity: 0.88,
              marginBottom: 14,
            }}>
              {hero.greeting}
            </h1>

            <p style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: "clamp(14px, 1.8vw, 16px)",
              lineHeight: 1.7,
              color: "var(--ink)",
              opacity: 0.42,
              maxWidth: 480,
            }}>
              {Array.isArray(hero.subline)
                ? hero.subline.map((line, i) => <span key={i}>{line}{i < hero.subline.length - 1 && <br />}</span>)
                : hero.subline
              }
            </p>
          </div>
        </section>

        {/* ━━━ Project Card ━━━ */}
        {currentProject ? (
          <section className="portal-reveal portal-delay-1" style={{ marginBottom: 40 }}>
            <div style={sectionLabelStyle}>Current Project</div>

            <Link
              href={`/projects/${currentProject.id}`}
              className="portal-card-hover"
              style={{
                display: "block",
                textDecoration: "none",
                background: "rgba(255,255,255,0.28)",
                border: "0.5px solid rgba(15,15,14,0.08)",
                padding: "clamp(22px, 3vw, 32px)",
                marginTop: 14,
              }}
            >
              {/* Header: title + status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 6 }}>
                <div>
                  <div style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "clamp(18px, 2.8vw, 24px)",
                    lineHeight: 1.08,
                    letterSpacing: "-0.025em",
                    color: "var(--ink)",
                    opacity: 0.88,
                  }}>
                    {currentProject.title}
                  </div>
                  {currentProject.scope && (
                    <div style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-body)",
                      color: "var(--ink)",
                      opacity: 0.46,
                      letterSpacing: "-0.01em",
                      marginTop: 6,
                    }}>
                      {currentProject.scope}
                    </div>
                  )}
                </div>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-eyebrow)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: statusColor(currentStatus),
                  flexShrink: 0,
                  marginTop: 6,
                }}>
                  {statusLabels[currentStatus] ?? currentStatus}
                </span>
              </div>

              {/* Deliverable progress dots */}
              {deliverables.length > 0 && (
                <div style={{ margin: "24px 0 22px", overflowX: "auto" }}>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, minHeight: 20 }}>
                    <div style={{
                      position: "absolute",
                      top: "50%", left: 3, right: 3,
                      height: 1,
                      background: "rgba(15,15,14,0.06)",
                      transform: "translateY(-50%)",
                    }} />
                    {deliverables.length > 1 && (
                      <div style={{
                        position: "absolute",
                        top: "50%", left: 3,
                        height: 1,
                        width: `${(completedCount / (deliverables.length - 1)) * 100}%`,
                        maxWidth: "calc(100% - 6px)",
                        background: "rgba(15,15,14,0.14)",
                        transform: "translateY(-50%)",
                      }} />
                    )}
                    {deliverables.map((d: any) => (
                      <div key={d.id} style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: deliverableDotColor(d.status),
                          flexShrink: 0,
                        }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                    {deliverables.map((d: any) => (
                      <div key={d.id} style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 8,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--ink)",
                        opacity: d.status === "awaiting_approval" ? 0.52 : 0.26,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        minWidth: 0,
                        maxWidth: 100,
                      }}>
                        {d.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer: timeline + arrow */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-eyebrow)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--ink)",
                  opacity: 0.3,
                }}>
                  {currentProject.total_weeks && currentProject.current_week
                    ? `Week ${currentProject.current_week} of ${currentProject.total_weeks}`
                    : deliverables.length > 0
                      ? `${deliverables.length} deliverable${deliverables.length !== 1 ? "s" : ""}`
                      : ""
                  }
                </div>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-eyebrow)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--ink)",
                  opacity: 0.36,
                }}>
                  View Project &rarr;
                </span>
              </div>
            </Link>
          </section>
        ) : (
          /* ━━━ No-project empty state ━━━ */
          <section className="portal-reveal portal-delay-1" style={{ marginBottom: 40, padding: "48px 0", textAlign: "center" }}>
            <div style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: 20,
              color: "var(--ink)",
              opacity: 0.68,
              marginBottom: 12,
              letterSpacing: "-0.01em",
            }}>
              Your portal is ready.
            </div>
            <div style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              lineHeight: 1.8,
              color: "var(--ink)",
              opacity: 0.44,
              maxWidth: 440,
              margin: "0 auto",
            }}>
              Once your first project kicks off, you&apos;ll find everything here — deliverables, files, invoices, and next steps.
            </div>
          </section>
        )}

        {/* ━━━ Approved Scope (from accepted proposal) ━━━ */}
        {approvedScope.length > 0 && (
          <section className="portal-reveal portal-delay-2" style={{ marginBottom: 40 }}>
            <div style={sectionLabelStyle}>Approved Scope</div>
            <div style={sectionBodyWrapStyle}>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {approvedScope.map((item: any) => (
                  <div key={item.id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 16,
                    padding: "12px 0",
                    borderBottom: "0.5px solid rgba(15,15,14,0.06)",
                  }}>
                    <div>
                      <div style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "var(--text-body)",
                        color: "var(--ink)",
                        opacity: 0.76,
                        letterSpacing: "-0.01em",
                      }}>
                        {item.name}
                      </div>
                      {item.description && (
                        <div style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "var(--text-sm)",
                          color: "var(--ink)",
                          opacity: 0.38,
                          marginTop: 2,
                        }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-eyebrow)",
                      letterSpacing: "0.06em",
                      color: "var(--ink)",
                      opacity: 0.32,
                      flexShrink: 0,
                    }}>
                      {formatCurrency(item.price)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Later phase items */}
              {laterPhase.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-eyebrow)",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--ink)",
                    opacity: 0.28,
                    marginBottom: 10,
                  }}>
                    Available to add later
                  </div>
                  {laterPhase.map((item: any) => (
                    <div key={item.id} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 16,
                      padding: "10px 0",
                      borderBottom: "0.5px solid rgba(15,15,14,0.04)",
                    }}>
                      <span style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "var(--text-sm)",
                        color: "var(--ink)",
                        opacity: 0.46,
                      }}>
                        {item.name}
                      </span>
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-eyebrow)",
                        letterSpacing: "0.06em",
                        color: "var(--ink)",
                        opacity: 0.22,
                        flexShrink: 0,
                      }}>
                        {formatCurrency(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ━━━ Next Steps + Billing Grid ━━━ */}
        <div
          className={`portal-reveal ${approvedScope.length > 0 ? "portal-delay-3" : "portal-delay-2"} dashboard-section-grid`}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.12fr) minmax(240px, 300px)",
            gap: 42,
            alignItems: "start",
          }}
        >
          {/* Next Steps */}
          <section>
            <div style={sectionLabelStyle}>Next Steps</div>
            <div style={sectionBodyWrapStyle}>
              {hasActionableSteps ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {nextSteps.slice(0, 3).map((step, i) => (
                    <Link
                      key={i}
                      href={step.href}
                      className="portal-row-hover"
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 16,
                        textDecoration: "none",
                        padding: "14px 16px 14px 14px",
                        borderLeft: `2px solid ${step.accent}`,
                        background: "rgba(255,255,255,0.18)",
                      }}
                    >
                      <div>
                        <div style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 8,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: step.accent,
                          opacity: 0.88,
                          marginBottom: 6,
                        }}>
                          {step.tag}
                        </div>
                        <div style={nextStepTitleStyle}>{step.label}</div>
                        <div style={nextStepBodyStyle}>{step.body}</div>
                      </div>
                      <span style={arrowStyle}>&rarr;</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={{ maxWidth: 440 }}>
                  <p style={{ ...bodyCopyStyle, marginBottom: 10, opacity: 0.66 }}>
                    Nothing is needed from you right now.
                  </p>
                  <p style={bodyCopyStyle}>We&apos;ll update this space when the next step is ready.</p>
                </div>
              )}
            </div>
          </section>

          {/* Billing Overview */}
          <section>
            <div style={sectionLabelStyle}>Billing Overview</div>
            <div style={sectionBodyWrapStyle}>
              {paidTotal > 0 ? (
                <>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "clamp(26px, 3.5vw, 34px)",
                      letterSpacing: "-0.03em",
                      color: "var(--ink)",
                      opacity: 0.84,
                      lineHeight: 1.1,
                    }}>
                      {formatCurrency(paidTotal)}
                    </div>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-eyebrow)",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--ink)",
                      opacity: 0.3,
                      marginTop: 6,
                    }}>
                      Paid to date
                    </div>
                  </div>

                  {totalContract > 0 && (
                    <div style={{
                      width: "100%",
                      height: 2,
                      background: "rgba(15,15,14,0.06)",
                      margin: "16px 0",
                      position: "relative",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        position: "absolute",
                        top: 0, left: 0, bottom: 0,
                        width: `${paidPct}%`,
                        background: "var(--sage)",
                        opacity: 0.7,
                      }} />
                    </div>
                  )}

                  <div style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-body)",
                    color: dueTotal > 0 ? "var(--amber)" : "var(--ink)",
                    opacity: dueTotal > 0 ? 0.88 : 0.4,
                    marginBottom: 20,
                  }}>
                    {dueTotal > 0 ? `${formatCurrency(dueTotal)} outstanding` : "Nothing due"}
                  </div>
                </>
              ) : (
                <p style={{ ...bodyCopyStyle, marginBottom: 20 }}>
                  No payments yet. Invoices will appear here as your project progresses.
                </p>
              )}

              <Link href="/invoices" className="portal-button-soft" style={inlineButtonStyle}>
                View Billing
              </Link>
            </div>
          </section>
        </div>

        {/* ━━━ Brand Library Preview ━━━ */}
        {showLibrary && (
          <section className={`portal-reveal ${approvedScope.length > 0 ? "portal-delay-4" : "portal-delay-3"}`} style={{ marginTop: 40 }}>
            <div style={sectionLabelStyle}>Brand Library</div>
            <div style={sectionBodyWrapStyle}>
              {colors.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                  {(colors as any[]).slice(0, 6).map((c: any) => (
                    <div
                      key={c.id}
                      style={{
                        width: 24, height: 24,
                        background: c.hex,
                        border: "0.5px solid rgba(15,15,14,0.06)",
                      }}
                    />
                  ))}
                </div>
              )}

              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-eyebrow)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink)",
                opacity: 0.34,
                marginBottom: 18,
              }}>
                {filesCount} file{filesCount !== 1 ? "s" : ""}
                {typefaces.length > 0 && ` \u00b7 ${typefaces.length} typeface${typefaces.length !== 1 ? "s" : ""}`}
              </div>

              <Link href="/library" className="portal-button-soft" style={inlineButtonStyle}>
                View Library
              </Link>
            </div>
          </section>
        )}
      </main>
    </>
  )
}

/* ─── Style constants ─── */

const inlineButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  padding: "0 15px",
  border: "0.5px solid rgba(15,15,14,0.16)",
  color: "var(--ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  textDecoration: "none",
  background: "rgba(255,255,255,0.26)",
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)" as any,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--ink)",
  opacity: 0.36,
  marginBottom: 0,
}

const sectionBodyWrapStyle: React.CSSProperties = {
  paddingTop: 18,
  borderTop: "0.5px solid rgba(15,15,14,0.14)",
}

const bodyCopyStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-body)",
  lineHeight: 1.8,
  color: "var(--ink)",
  opacity: 0.56,
  maxWidth: 520,
}

const nextStepTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-lg)",
  letterSpacing: "-0.01em",
  color: "var(--ink)",
  opacity: 0.84,
  marginBottom: 4,
}

const nextStepBodyStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-body)",
  lineHeight: 1.7,
  color: "var(--ink)",
  opacity: 0.48,
  maxWidth: 420,
}

const arrowStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--ink)",
  opacity: 0.2,
  flexShrink: 0,
  marginTop: 4,
}
