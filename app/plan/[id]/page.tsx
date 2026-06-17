import { createServerComponentClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import CinqLogo from "@/components/CinqLogo"
import TrackPlanView from "./TrackPlanView"

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" }
const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" }

// Match the brand-kit palette so portal docs feel like one system
const CREAM = "#F5F1EA"
const PAPER = "#FBF7EE"
const INK = "#1C1916"
const LINE = "rgba(28,25,22,0.1)"
const MUTED = "rgba(28,25,22,0.55)"
const SOFT = "rgba(28,25,22,0.35)"

function fmt$(cents?: number | null) {
  if (cents == null) return null
  return `$${(cents / 100).toLocaleString("en-US")}`
}

export default async function PlanPage({ params }: { params: { id: string } }) {
  const supabase = await createServerComponentClient()

  const { data: plan } = await supabase
    .from("plans")
    .select("*, clients(name, contact_name)")
    .eq("id", params.id).single()

  if (!plan) return notFound()

  const { data: sectionsRaw } = await supabase
    .from("plan_sections")
    .select("*")
    .eq("plan_id", params.id)
    .order("sort_order")

  const sections = (sectionsRaw ?? []) as any[]
  const sectionIds = sections.map(s => s.id)

  const { data: itemsRaw } = sectionIds.length
    ? await supabase.from("plan_items").select("*").in("section_id", sectionIds).order("sort_order")
    : { data: [] as any[] }

  const items = (itemsRaw ?? []) as any[]
  const itemsBySection = new Map<string, any[]>()
  for (const it of items) {
    const arr = itemsBySection.get(it.section_id) ?? []
    arr.push(it)
    itemsBySection.set(it.section_id, arr)
  }

  const client = (plan as any).clients
  const pills: string[] = Array.isArray((plan as any).footer_pills) ? (plan as any).footer_pills : []

  return (
    <div style={{ background: CREAM, color: INK, minHeight: "100vh" }}>

      <TrackPlanView planId={params.id} alreadyViewed={!!(plan as any).viewed_at} />

      {/* ─── Cover ────────────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh",
        padding: "clamp(40px, 6vw, 80px) clamp(28px, 6vw, 80px)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <CinqLogo width={26} color={INK} />
          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED, textAlign: "right" }}>
            {plan.eyebrow && <><span>{plan.eyebrow}</span><br /></>}
            {plan.prepared_for ? <span>Prepared for {plan.prepared_for}</span> : null}
            {plan.prepared_for && plan.prepared_date ? <span style={{ margin: "0 8px", opacity: 0.5 }}>·</span> : null}
            {plan.prepared_date}
          </div>
        </div>

        {/* Title block */}
        <div style={{ marginTop: "auto", maxWidth: 820 }}>
          {client?.name && (
            <div style={{ ...mono, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: MUTED, marginBottom: 20 }}>
              {client.name}
            </div>
          )}
          <h1 style={{
            ...sans, margin: 0, fontWeight: 400,
            fontSize: "clamp(40px, 7vw, 80px)",
            letterSpacing: "-0.025em", lineHeight: 1.05, opacity: 0.97,
          }}>
            {plan.title}
          </h1>
          {plan.subtitle && (
            <div style={{ ...serif, fontStyle: "italic", fontSize: "clamp(18px, 2vw, 22px)", opacity: 0.65, marginTop: 22, maxWidth: 640, lineHeight: 1.5 }}>
              {plan.subtitle}
            </div>
          )}
          {plan.tagline && (
            <div style={{ ...mono, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED, marginTop: 36, maxWidth: 640, lineHeight: 1.6 }}>
              {plan.tagline}
            </div>
          )}
        </div>

        {/* Optional cover image */}
        {plan.cover_image_url && (
          <div style={{ marginTop: 56, marginBottom: 32, textAlign: "center" }}>
            <img src={plan.cover_image_url} alt="" style={{ maxWidth: "min(640px, 100%)", height: "auto", display: "inline-block" }} />
          </div>
        )}

        {/* Footer pills */}
        <div style={{ marginTop: "auto", paddingTop: 48, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          {pills.length > 0 ? (
            <div style={{ ...mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED }}>
              {pills.map((p, i) => (
                <span key={i}>
                  {p}
                  {i < pills.length - 1 ? <span style={{ margin: "0 14px", opacity: 0.5 }}>·</span> : null}
                </span>
              ))}
            </div>
          ) : <span />}
        </div>
      </section>

      {/* ─── The Idea + Contents ──────────────────────────────── */}
      {(plan.idea_body || sections.length > 0) && (
        <section style={{
          padding: "clamp(80px, 10vw, 140px) clamp(28px, 6vw, 80px)",
          maxWidth: 980, margin: "0 auto",
          borderTop: `0.5px solid ${LINE}`,
        }}>
          {plan.idea_body && (
            <div style={{ display: "grid", gridTemplateColumns: "70px minmax(0, 1fr)", gap: 28, alignItems: "baseline", marginBottom: sections.length > 0 ? 80 : 0 }} className="plan-grid-2col">
              <div style={{ ...mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED }}>
                {plan.idea_eyebrow || "The Idea"}
              </div>
              <div style={{ ...sans, fontSize: "clamp(18px, 1.9vw, 21px)", lineHeight: 1.6, opacity: 0.88, whiteSpace: "pre-wrap", maxWidth: 640 }}>
                {plan.idea_body}
              </div>
            </div>
          )}

          {sections.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "70px minmax(0, 1fr)", gap: 28, alignItems: "baseline" }} className="plan-grid-2col">
              <div style={{ ...mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED }}>
                Contents
              </div>
              <div style={{ borderTop: `0.5px solid ${LINE}` }}>
                {sections.map((s, i) => (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) auto", gap: 16, alignItems: "baseline", padding: "16px 0", borderBottom: `0.5px solid ${LINE}` }}>
                    <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", color: MUTED }}>
                      {s.number_label ?? String(i).padStart(2, "0")}
                    </div>
                    <div style={{ ...sans, fontSize: "clamp(16px, 1.6vw, 18px)", opacity: 0.92, letterSpacing: "-0.005em" }}>
                      {s.title}
                    </div>
                    {s.aside && (
                      <div style={{ ...serif, fontStyle: "italic", fontSize: "clamp(13px, 1.4vw, 15px)", color: MUTED, textAlign: "right" }}>
                        {s.aside}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── Section spreads ──────────────────────────────────── */}
      {sections.map((s, sIndex) => {
        const sItems = itemsBySection.get(s.id) ?? []
        return (
          <section
            key={s.id}
            style={{
              padding: "clamp(80px, 10vw, 140px) clamp(28px, 6vw, 80px)",
              maxWidth: 1100, margin: "0 auto",
              borderTop: `0.5px solid ${LINE}`,
            }}
          >
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) minmax(0, 2fr)",
              gap: 56,
            }} className="plan-section-grid">

              {/* Left column: section header */}
              <div>
                <div style={{ ...mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>
                  {s.number_label ?? String(sIndex).padStart(2, "0")}
                </div>
                <h2 style={{
                  ...sans, margin: 0, fontWeight: 400,
                  fontSize: "clamp(28px, 3.8vw, 40px)",
                  letterSpacing: "-0.02em", lineHeight: 1.1,
                  opacity: 0.95,
                }}>
                  {s.title}
                </h2>
                {s.lede && (
                  <div style={{ ...serif, fontStyle: "italic", fontSize: 16, color: MUTED, lineHeight: 1.55, marginTop: 16, maxWidth: 320 }}>
                    {s.lede}
                  </div>
                )}
              </div>

              {/* Right column: items */}
              <div>
                {sItems.length === 0 ? (
                  <div style={{ ...serif, fontStyle: "italic", fontSize: 15, color: SOFT }}>
                    No items yet.
                  </div>
                ) : (
                  <div style={{ borderTop: `0.5px solid ${LINE}` }}>
                    {sItems.map(it => {
                      const est = fmt$(it.estimate_cents)
                      return (
                        <div key={it.id} style={{ display: "grid", gridTemplateColumns: "12px minmax(0, 1fr) 110px", gap: 18, alignItems: "baseline", padding: "18px 0", borderBottom: `0.5px solid ${LINE}` }} className="plan-item-row">
                          <div style={{ ...mono, fontSize: 8, color: INK, opacity: 0.6, paddingTop: 5 }}>■</div>
                          <div style={{ lineHeight: 1.55 }}>
                            <span style={{ ...sans, fontSize: "clamp(15px, 1.55vw, 17px)", fontWeight: 500, opacity: 0.95 }}>{it.title}</span>
                            {it.description && (
                              <span style={{ ...sans, fontSize: "clamp(15px, 1.55vw, 17px)", opacity: 0.72 }}>
                                {" "}— {it.description}
                              </span>
                            )}
                          </div>
                          <div style={{ ...mono, fontSize: 12, letterSpacing: "0.06em", textAlign: "right", whiteSpace: "nowrap", paddingTop: 3 }}>
                            {est && (
                              <>
                                <span style={{ color: MUTED, marginRight: 8, fontSize: 10, letterSpacing: "0.1em" }}>EST.</span>
                                <span style={{ color: INK, opacity: 1 }}>{est}</span>
                              </>
                            )}
                            {!est && it.estimate_note && (
                              <span style={{ color: MUTED, fontSize: 11 }}>{it.estimate_note}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        )
      })}

      {/* ─── Footer ────────────────────────────────────────────── */}
      <footer style={{
        padding: "60px clamp(28px, 6vw, 80px)",
        borderTop: `0.5px solid ${LINE}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>
          Studio Cinq · Direction Plan{client?.name ? ` · ${client.name}` : ""}
        </div>
        <CinqLogo width={22} color={INK} />
      </footer>

      <style>{`
        @media (max-width: 760px) {
          .plan-section-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .plan-grid-2col { grid-template-columns: 1fr !important; gap: 16px !important; }
          .plan-item-row { grid-template-columns: 12px minmax(0, 1fr) !important; }
          .plan-item-row > div:last-child { grid-column: 2; text-align: left !important; margin-top: 4px; padding-top: 0 !important; }
        }
      `}</style>
    </div>
  )
}
