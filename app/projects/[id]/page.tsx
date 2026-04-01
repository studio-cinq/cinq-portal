import { createServerComponentClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import MessageForm from "@/components/portal/MessageForm"
import SlideViewer from "@/components/portal/SlideViewer"

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = await createServerComponentClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: client } = await supabase
    .from("clients").select("*")
    .eq("contact_email", user?.email ?? "").single()

  const { data: project } = await supabase
    .from("projects").select("*")
    .eq("id", params.id).eq("client_id", client?.id ?? "").single()

  if (!project) notFound()

  const { data: deliverables } = await supabase
    .from("deliverables").select("*")
    .eq("project_id", project.id).order("sort_order")

  const { data: decisionLog } = await supabase
    .from("decision_log").select("*")
    .eq("project_id", project.id).order("logged_at", { ascending: false })

  const { data: invoices } = await supabase
    .from("invoices").select("*")
    .eq("project_id", project.id).in("status", ["sent", "overdue"])

  const { data: slides } = await supabase
    .from("presentation_slides").select("*")
    .eq("project_id", project.id).order("sort_order")

  const needsReview = deliverables?.find(d => d.status === "awaiting_approval")

  const progressPct = project.total_weeks && project.current_week
    ? Math.round((project.current_week / project.total_weeks) * 100) : 0

  const statusColors: Record<string, string> = {
    awaiting_approval: "var(--amber)",
    in_progress:       "var(--sage)",
    complete:          "rgba(15,15,14,0.22)",
    not_started:       "transparent",
  }
  const statusLabels: Record<string, string> = {
    awaiting_approval: "Awaiting approval",
    in_progress:       "In progress",
    complete:          "Complete",
    not_started:       "Not started",
  }

  return (
    <>
      <PortalNav clientName={client?.name} />

      <main className="layout-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 260px",
        maxWidth: 1100, margin: "0 auto",
        minHeight: "calc(100vh - 64px)",
      }}>

        {/* Left */}
        <div className="layout-left" style={{ padding: "40px 40px 64px 48px", borderRight: "0.5px solid rgba(15,15,14,0.08)" }}>

          <Link href="/dashboard" style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--ink)", opacity: 0.42, textDecoration: "none",
            display: "flex", alignItems: "center", gap: 8, marginBottom: 28,
          }}>
            &larr; &nbsp;All projects
          </Link>

          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.42, marginBottom: 8 }}>
            &bull; {project.scope}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", letterSpacing: "-0.01em", opacity: "var(--op-full)" as any, marginBottom: 32 }}>
            {project.title}
          </div>

          {/* Timeline */}
          {project.total_weeks && (
            <div style={{ marginBottom: 40 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.42, marginBottom: 12 }}>
                <span>Project timeline</span>
                <span>Week {project.current_week} of {project.total_weeks}</span>
              </div>
              <div style={{ height: 2, background: "rgba(15,15,14,0.08)", borderRadius: 2, position: "relative", marginBottom: 8 }}>
                <div style={{ height: 2, width: `${progressPct}%`, background: "var(--ink)", opacity: 0.7, borderRadius: 2 }} />
                <div style={{ position: "absolute", top: -4, left: `${progressPct}%`, width: 10, height: 10, borderRadius: "50%", background: "var(--ink)", opacity: 0.88, transform: "translateX(-50%)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.38, letterSpacing: "0.04em" }}>
                <span>{project.start_date ? new Date(project.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span>
                <span>Today</span>
                <span>{project.end_date ? new Date(project.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span>
              </div>
            </div>
          )}

          {/* Deliverables */}
          <div style={sectionStyle}>Deliverables</div>
          <div style={{ marginBottom: 36 }}>
            <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.07)" }} />
            {deliverables?.map(del => (
              <div key={del.id} style={{ padding: "18px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
                <div className="del-row-mobile" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-full)" as any, letterSpacing: "-0.01em" }}>
                    {del.name}
                  </div>
                  <div className="del-actions-mobile" style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                    {del.revision_max > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {Array.from({ length: del.revision_max }).map((_, i) => (
                          <div key={i} style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: i < del.revision_used ? "rgba(15,15,14,0.35)" : "transparent",
                            border: i < del.revision_used ? "none" : "0.5px solid rgba(15,15,14,0.2)",
                          }} />
                        ))}
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", color: "var(--ink)", opacity: 0.38, marginLeft: 6, letterSpacing: "0.04em" }}>
                          {del.revision_used >= del.revision_max
                            ? "All rounds used"
                            : `${del.revision_max - del.revision_used} round${del.revision_max - del.revision_used !== 1 ? "s" : ""} remaining`
                          }
                        </span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: statusColors[del.status] ?? "rgba(15,15,14,0.2)",
                        border: del.status === "not_started" ? "0.5px solid rgba(15,15,14,0.2)" : "none",
                        flexShrink: 0,
                      }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", color: statusColors[del.status] ?? "var(--ink)", opacity: del.status === "not_started" ? 0.25 : 1 }}>
                        {statusLabels[del.status] ?? del.status}
                      </span>
                    </div>
                    {del.status === "awaiting_approval" && (
                      <Link href={`/projects/${project.id}/review/${del.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--amber)", textDecoration: "none", opacity: 0.9 }}>
                        Review &rarr;
                      </Link>
                    )}
                  </div>
                </div>
                <div style={{ height: 1, background: "rgba(15,15,14,0.07)", borderRadius: 1 }}>
                  <div style={{
                    height: 1, borderRadius: 1, background: "var(--ink)", opacity: 0.3,
                    width: del.status === "complete" ? "100%" : del.status === "awaiting_approval" ? "80%" : del.status === "in_progress" ? "45%" : "0%",
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Presentation */}
          {slides && slides.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <div style={sectionStyle}>Presentation</div>
              <div style={{
                background: "var(--ink)", padding: "32px 24px",
                display: "flex", flexDirection: "column", alignItems: "center",
              }}>
                <SlideViewer slides={slides as any} />
              </div>
            </div>
          )}

          {/* Decision log */}
          <div style={sectionStyle}>Decision log</div>
          <div>
            {decisionLog?.map(entry => (
              <div key={entry.id} style={{ display: "flex", gap: 16, padding: "11px 0", borderBottom: "0.5px solid rgba(15,15,14,0.06)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", color: "var(--ink)", opacity: 0.38, minWidth: 52, paddingTop: 1, letterSpacing: "0.04em" }}>
                  {new Date(entry.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", opacity: "var(--op-muted)" as any, lineHeight: 1.5 }}>
                  {entry.entry}
                </div>
              </div>
            ))}
            {(!decisionLog || decisionLog.length === 0) && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.38, padding: "16px 0", lineHeight: 1.7 }}>Decisions and direction notes will appear here as the project progresses.</div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="layout-sidebar" style={{ padding: "40px 28px" }}>

          {needsReview && (
            <>
              <div style={sidebarLabel}>Next step</div>
              <div style={{ border: "0.5px solid rgba(15,15,14,0.1)", padding: 18, marginBottom: 28, background: "rgba(15,15,14,0.04)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--amber)", opacity: 0.9, marginBottom: 8 }}>
                  Your input needed
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", opacity: "var(--op-body)" as any, lineHeight: 1.5, marginBottom: 14 }}>
                  {needsReview.name} is ready for your review.
                </div>
                <Link href={`/projects/${project.id}/review/${needsReview.id}`} style={{
                  display: "block", width: "100%", boxSizing: "border-box",
                  background: "var(--ink)", padding: "11px", textAlign: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "var(--cream)", textDecoration: "none",
                }}>
                  Review &amp; approve
                </Link>
              </div>
            </>
          )}

          <div style={sidebarLabel}>Key dates</div>
          <div style={{ marginBottom: 28 }}>
            {project.start_date && <DateRow label="Kickoff" value={new Date(project.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />}
            {project.end_date && <DateRow label="Final delivery" value={new Date(project.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />}
          </div>

          <div style={sidebarLabel}>Message Kacie</div>
          <MessageForm projectId={project.id} />
        </div>
      </main>
    </>
  )
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "0.5px solid rgba(15,15,14,0.06)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", opacity: 0.4 }}>{label}</span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", opacity: "var(--op-muted)" as any }}>{value}</span>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)" as any,
  letterSpacing: "0.16em", textTransform: "uppercase",
  color: "var(--ink)", opacity: 0.42, marginBottom: 14,
}

const sidebarLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)" as any,
  letterSpacing: "0.16em", textTransform: "uppercase",
  color: "var(--ink)", opacity: 0.42, marginBottom: 16,
}