import { createServerComponentClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import CinqLogo from "@/components/CinqLogo"
import TrackPlanView from "./TrackPlanView"

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" }
const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" }

// Editorial palette — cream canvas, ink type, terracotta accent
const CANVAS = "#EBE4D5"
const PAPER = "#F4EFE3"
const INK = "#1C1A18"
const ACCENT = "#924D39"
const LINE = "rgba(28,26,24,0.15)"
const MUTED = "rgba(28,26,24,0.55)"

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
    <div style={{ background: CANVAS, color: INK, minHeight: "100vh", fontFamily: "var(--font-sans)" }}>

      <TrackPlanView planId={params.id} alreadyViewed={!!(plan as any).viewed_at} />

      {/* ─── Cover ────────────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh",
        padding: "clamp(36px, 5vw, 64px) clamp(28px, 6vw, 72px)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "auto" }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.85 }}>
            {plan.eyebrow ?? "Studio Cinq"}
          </div>
          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7, textAlign: "right" }}>
            {plan.prepared_for ? <>Prepared for {plan.prepared_for}</> : null}
            {plan.prepared_for && plan.prepared_date ? <span style={{ margin: "0 10px" }}>·</span> : null}
            {plan.prepared_date}
          </div>
        </div>

        {/* Client name + tagline */}
        <div style={{ paddingTop: "8vh" }}>
          <div style={{
            ...sans, fontSize: "clamp(40px, 7vw, 76px)", letterSpacing: "0.04em", lineHeight: 1.05,
            fontWeight: 700,
            color: INK,
          }}>
            {client?.name ?? ""}
          </div>
          {plan.tagline && (
            <div style={{ ...serif, fontStyle: "italic", fontSize: "clamp(15px, 1.6vw, 18px)", color: ACCENT, marginTop: 14 }}>
              {plan.tagline}
            </div>
          )}
        </div>

        {/* Title block */}
        <div style={{ marginTop: 48, maxWidth: 640 }}>
          <h1 style={{
            ...serif, margin: 0, fontWeight: 400,
            fontSize: "clamp(40px, 6vw, 68px)", lineHeight: 1.05,
            letterSpacing: "-0.005em",
          }}>
            {plan.title}
          </h1>
          {plan.subtitle && (
            <div style={{ ...serif, fontStyle: "italic", fontSize: "clamp(17px, 1.8vw, 21px)", marginTop: 18, lineHeight: 1.4, opacity: 0.85 }}>
              {plan.subtitle}
            </div>
          )}
        </div>

        {/* Optional cover image */}
        {plan.cover_image_url && (
          <div style={{ marginTop: 56, marginBottom: 56, textAlign: "center" }}>
            <img src={plan.cover_image_url} alt="" style={{ maxWidth: "min(680px, 100%)", height: "auto", display: "inline-block" }} />
          </div>
        )}

        {/* Footer pills + logo */}
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 48 }}>
          {pills.length > 0 ? (
            <div style={{ ...mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.7 }}>
              {pills.map((p, i) => (
                <span key={i}>
                  {p}
                  {i < pills.length - 1 ? <span style={{ margin: "0 12px", opacity: 0.45 }}>·</span> : null}
                </span>
              ))}
            </div>
          ) : <span />}
          <CinqLogo width={24} color={INK} />
        </div>
      </section>

      {/* ─── The Idea + Contents ──────────────────────────────── */}
      <section style={{
        padding: "clamp(40px, 6vw, 80px) clamp(28px, 6vw, 72px) clamp(80px, 10vw, 140px)",
        maxWidth: 880, margin: "0 auto",
        borderTop: `0.5px solid ${LINE}`,
      }}>
        {/* Header strip */}
        <RunningHeader clientName={client?.name ?? ""} />

        {plan.idea_body && (
          <div style={{ marginTop: 56 }}>
            <div style={{ ...mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT, marginBottom: 22 }}>
              {plan.idea_eyebrow || "The Idea"}
            </div>
            <div style={{ ...serif, fontSize: "clamp(20px, 2vw, 23px)", lineHeight: 1.5, opacity: 0.92, whiteSpace: "pre-wrap" }}>
              {plan.idea_body}
            </div>
          </div>
        )}

        {sections.length > 0 && (
          <div style={{ marginTop: plan.idea_body ? 88 : 56, borderTop: `0.5px solid ${LINE}`, paddingTop: 36 }}>
            <div style={{ ...mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT, marginBottom: 22 }}>
              Contents
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sections.map((s, i) => (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) auto", gap: 14, alignItems: "baseline", paddingBottom: 14, borderBottom: `0.5px solid ${LINE}` }}>
                  <div style={{ ...mono, fontSize: 11, letterSpacing: "0.1em", color: ACCENT }}>
                    {s.number_label ?? String(i).padStart(2, "0")}
                  </div>
                  <div style={{ ...serif, fontSize: "clamp(18px, 2vw, 21px)", letterSpacing: "-0.005em" }}>
                    {s.title}
                  </div>
                  {s.aside && (
                    <div style={{ ...serif, fontStyle: "italic", fontSize: "clamp(13px, 1.4vw, 15px)", opacity: 0.7, textAlign: "right" }}>
                      {s.aside}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── Section pages ─────────────────────────────────────── */}
      {sections.map((s, sIndex) => {
        const sItems = itemsBySection.get(s.id) ?? []
        return (
          <section
            key={s.id}
            style={{
              padding: "clamp(60px, 8vw, 100px) clamp(28px, 6vw, 72px)",
              maxWidth: 980, margin: "0 auto",
              borderTop: `0.5px solid ${LINE}`,
            }}
          >
            <RunningHeader clientName={client?.name ?? ""} />

            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) minmax(0, 2fr)",
              gap: 56,
              marginTop: 36,
            }} className="plan-section-grid">

              {/* Left column: section header */}
              <div>
                <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: ACCENT, marginBottom: 14 }}>
                  {s.number_label ?? String(sIndex).padStart(2, "0")}
                </div>
                <h2 style={{
                  ...serif, margin: 0, fontWeight: 400,
                  fontSize: "clamp(32px, 4vw, 44px)",
                  letterSpacing: "-0.005em", lineHeight: 1.1,
                }}>
                  {s.title}
                </h2>
                {s.lede && (
                  <div style={{ ...serif, fontStyle: "italic", fontSize: 16, opacity: 0.65, lineHeight: 1.55, marginTop: 18, maxWidth: 320 }}>
                    {s.lede}
                  </div>
                )}
              </div>

              {/* Right column: items */}
              <div>
                {sItems.length === 0 ? (
                  <div style={{ ...serif, fontStyle: "italic", fontSize: 15, opacity: 0.5 }}>
                    No items yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                    {sItems.map(it => {
                      const est = fmt$(it.estimate_cents)
                      return (
                        <div key={it.id} style={{ display: "grid", gridTemplateColumns: "16px minmax(0, 1fr) 100px", gap: 16, alignItems: "baseline" }} className="plan-item-row">
                          <div style={{ ...sans, fontSize: 14, color: INK, lineHeight: 1, paddingTop: 4 }}>■</div>
                          <div>
                            <span style={{ ...serif, fontSize: "clamp(15px, 1.5vw, 17px)", fontWeight: 600 }}>{it.title}</span>
                            {it.description && (
                              <span style={{ ...serif, fontSize: "clamp(15px, 1.5vw, 17px)", opacity: 0.82, lineHeight: 1.5 }}>
                                {" "}— {it.description}
                              </span>
                            )}
                          </div>
                          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.06em", color: ACCENT, textAlign: "right", whiteSpace: "nowrap" }}>
                            {est && (
                              <>
                                <span style={{ opacity: 0.65, marginRight: 6 }}>EST.</span>
                                <span style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>{est}</span>
                              </>
                            )}
                            {!est && it.estimate_note && (
                              <span style={{ opacity: 0.6 }}>{it.estimate_note}</span>
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
        padding: "60px clamp(28px, 6vw, 72px)",
        borderTop: `0.5px solid ${LINE}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.6 }}>
          {plan.title}
        </div>
        <div style={{ ...mono, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.6 }}>
          Studio Cinq
        </div>
      </footer>

      <style>{`
        @media (max-width: 760px) {
          .plan-section-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .plan-item-row { grid-template-columns: 14px minmax(0, 1fr) !important; }
          .plan-item-row > div:last-child { grid-column: 2; text-align: left !important; margin-top: 4px; }
        }
      `}</style>
    </div>
  )
}

function RunningHeader({ clientName }: { clientName: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.55 }}>
        {clientName}
      </div>
    </div>
  )
}
