"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"

/* ─── Typography ─── */
const serif: React.CSSProperties = { fontFamily: "'Newsreader', 'Times New Roman', Georgia, serif" }
const sans: React.CSSProperties = { fontFamily: "'Söhne', 'Inter', system-ui, sans-serif" }
const mono: React.CSSProperties = { fontFamily: "'Matter SemiMono', 'SF Mono', monospace" }

/* ─── Colors ─── */
const DARK_BG = "#0C0C0C"
const DARK_TEXT = "#E8E5E0"
const LIGHT_BG = "#F0EDE6"
const LIGHT_TEXT = "#1C1916"

function bg(isDark: boolean) { return isDark ? DARK_BG : LIGHT_BG }
function fg(isDark: boolean) { return isDark ? DARK_TEXT : LIGHT_TEXT }

/* ─── Emphasis parser: *word* → serif italic ─── */
function renderEmphasis(text: string) {
  return text.split(/(\*[^*]+\*)/).map((part, i) =>
    part.startsWith("*") && part.endsWith("*")
      ? <em key={i} style={{ ...serif, fontStyle: "italic", fontWeight: 400 }}>{part.slice(1, -1)}</em>
      : part
  )
}

/* ─── Fade-in on scroll ─── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, style: { opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: "opacity 0.8s ease, transform 0.8s ease" } }
}

/* ─── Grid layouts for moodboards ─── */
const GRID_AREAS: Record<string, string[]> = {
  "tall-sides":          ["1/1/3/2", "1/2/2/3", "2/2/3/3", "1/3/3/4"],
  "tall-left":           ["1/1/3/2", "1/2/2/3", "1/3/2/4", "2/2/3/3", "2/3/3/4"],
  "tall-center":         ["1/1/2/2", "2/1/3/2", "1/2/3/3", "1/3/2/4", "2/3/3/4"],
  "grid-2x3":           ["1/1/2/2", "1/2/2/3", "1/3/2/4", "2/1/3/2", "2/2/3/3", "2/3/3/4"],
  "tall-left-bottom-span": ["1/1/3/2", "1/2/2/3", "1/3/2/4", "2/2/3/4"],
}

/* ═══════════════════════════════════════════
   SECTION COMPONENTS
   ═══════════════════════════════════════════ */

function CoverSection({ content, isDark, isMobile }: { content: any; isDark: boolean; isMobile: boolean }) {
  const fade = useFadeIn()
  return (
    <section style={{ minHeight: "100vh", background: bg(isDark), color: fg(isDark), display: "flex", flexDirection: "column", justifyContent: "space-between", padding: isMobile ? "48px 28px" : "56px 64px", scrollSnapAlign: "start" }}>
      <div ref={fade.ref} style={fade.style}>
        <div style={{ ...sans, fontSize: isMobile ? 28 : 38, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          {content.client_name}
        </div>
        <div style={{ ...sans, fontSize: isMobile ? 22 : 30, fontWeight: 300, letterSpacing: "-0.01em", opacity: 0.7, marginTop: 4 }}>
          {content.subtitle}
        </div>
      </div>
      <div style={{ ...mono, fontSize: 11, letterSpacing: "0.08em", opacity: 0.3 }}>
        {content.date}{content.version ? ` / ${content.version}` : ""}
      </div>
    </section>
  )
}

function PurposeSection({ content, isDark, isMobile }: { content: any; isDark: boolean; isMobile: boolean }) {
  const fade = useFadeIn()
  return (
    <section style={{ minHeight: "100vh", background: bg(isDark), color: fg(isDark), display: "flex", flexDirection: "column", justifyContent: "space-between", padding: isMobile ? "48px 28px" : "56px 64px", scrollSnapAlign: "start" }}>
      <div style={{ ...sans, fontSize: isMobile ? 13 : 15, fontWeight: 600, letterSpacing: "0.01em" }}>
        {content.label}
      </div>
      <div ref={fade.ref} style={{ ...fade.style, maxWidth: 800 }}>
        <div style={{ ...sans, fontSize: isMobile ? 22 : 30, fontWeight: 300, lineHeight: 1.45, letterSpacing: "-0.01em" }}>
          {renderEmphasis(content.statement)}
        </div>
      </div>
    </section>
  )
}

function PhilosophySection({ content, isDark, isMobile }: { content: any; isDark: boolean; isMobile: boolean }) {
  const fade = useFadeIn()
  const traits: string[] = content.traits ?? []
  return (
    <section style={{ minHeight: "100vh", background: bg(isDark), color: fg(isDark), display: "flex", flexDirection: isMobile ? "column" : "row", scrollSnapAlign: "start" }}>
      {/* Left — text */}
      <div ref={fade.ref} style={{ ...fade.style, flex: 1, padding: isMobile ? "48px 28px" : "56px 64px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ ...sans, fontSize: isMobile ? 22 : 26, fontWeight: 600, letterSpacing: "-0.015em", marginBottom: 20 }}>
          {content.title}
        </div>
        <div style={{ width: 48, height: 1, background: fg(isDark), opacity: 0.2, marginBottom: 24 }} />
        <div style={{ ...sans, fontSize: isMobile ? 14 : 15, lineHeight: 1.75, opacity: 0.75, maxWidth: 480, marginBottom: 48 }}>
          {content.body}
        </div>
        {traits.length > 0 && (
          <>
            <div style={{ ...sans, fontSize: isMobile ? 18 : 22, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 16 }}>
              {content.traits_title ?? "Core Brand Traits"}
            </div>
            {traits.map((t: string, i: number) => (
              <div key={i} style={{ ...sans, fontSize: isMobile ? 14 : 15, padding: "10px 0", borderBottom: `0.5px solid ${isDark ? "rgba(232,229,224,0.12)" : "rgba(28,25,22,0.1)"}` }}>
                {t}
              </div>
            ))}
          </>
        )}
      </div>
      {/* Right — image */}
      <div style={{ flex: 1, minHeight: isMobile ? 300 : "auto", position: "relative", overflow: "hidden" }}>
        {content.image_url ? (
          <img src={content.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", minHeight: isMobile ? 300 : 600, background: isDark ? "rgba(232,229,224,0.05)" : "rgba(28,25,22,0.04)" }} />
        )}
      </div>
    </section>
  )
}

function MoodboardSection({ content, isDark, isMobile }: { content: any; isDark: boolean; isMobile: boolean }) {
  const fade = useFadeIn()
  const layout = content.layout ?? "tall-left"
  const areas = GRID_AREAS[layout] ?? GRID_AREAS["tall-left"]
  const images: string[] = content.images ?? []

  return (
    <section style={{ background: bg(isDark), color: fg(isDark), padding: isMobile ? "32px 0 0" : "40px 0 0", scrollSnapAlign: "start" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: isMobile ? "0 28px 16px" : "0 64px 20px", flexWrap: "wrap", gap: 8 }}>
        <div style={{ ...sans, fontSize: isMobile ? 16 : 18, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {content.trait_name}
        </div>
        {content.descriptor && (
          <div style={{ ...serif, fontStyle: "italic", fontSize: isMobile ? 12 : 13, opacity: 0.55, maxWidth: 400, textAlign: "right" }}>
            {content.descriptor}
          </div>
        )}
      </div>
      {/* Image grid */}
      <div ref={fade.ref} style={{
        ...fade.style,
        display: "grid",
        gridTemplateRows: "1fr 1fr",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 4,
        aspectRatio: isMobile ? "4/5" : "16/9",
        padding: isMobile ? "0" : "0",
      }}>
        {areas.map((area, i) => (
          <div key={i} style={{ gridArea: area, overflow: "hidden", position: "relative", background: isDark ? "rgba(232,229,224,0.06)" : "rgba(28,25,22,0.05)" }}>
            {images[i] ? (
              <img src={images[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ ...mono, fontSize: 10, opacity: 0.15, textTransform: "uppercase", letterSpacing: "0.1em" }}>{i + 1}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function SummarySection({ content, isDark, isMobile, traits }: { content: any; isDark: boolean; isMobile: boolean; traits: { name: string }[] }) {
  const fade = useFadeIn()
  return (
    <section style={{ background: bg(isDark), color: fg(isDark), padding: isMobile ? "64px 28px" : "80px 64px", scrollSnapAlign: "start" }}>
      {/* Closing statement */}
      <div ref={fade.ref} style={{ ...fade.style, ...sans, fontSize: isMobile ? 15 : 16, lineHeight: 1.75, fontWeight: 500, maxWidth: 800, marginBottom: 64 }}>
        {content.closing_statement}
      </div>

      <div style={{ width: "100%", height: 0.5, background: fg(isDark), opacity: 0.1, marginBottom: 64 }} />

      {/* Recap */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 40 : 64, alignItems: isMobile ? "flex-start" : "center", marginBottom: 48 }}>
        {/* Circle + text */}
        <div style={{ flex: "0 0 auto", width: isMobile ? "100%" : 280 }}>
          <div style={{
            width: isMobile ? 160 : 200, height: isMobile ? 160 : 200,
            borderRadius: "50%", border: `0.5px solid ${isDark ? "rgba(232,229,224,0.15)" : "rgba(28,25,22,0.12)"}`,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 28, marginBottom: 0,
          }}>
            <div>
              <div style={{ ...sans, fontSize: isMobile ? 14 : 16, fontWeight: 600, lineHeight: 1.4, marginBottom: 12 }}>
                {content.recap_title}
              </div>
              <div style={{ ...sans, fontSize: isMobile ? 11 : 12, lineHeight: 1.6, opacity: 0.6 }}>
                {content.recap_body}
              </div>
            </div>
          </div>
        </div>
        {/* Trait thumbnails */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : `repeat(${Math.min(traits.length, 5)}, 1fr)`, gap: 16, flex: 1 }}>
          {traits.map((t, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ aspectRatio: "1", background: isDark ? "rgba(232,229,224,0.06)" : "rgba(28,25,22,0.05)", marginBottom: 8, borderRadius: 2, overflow: "hidden" }} />
              <div style={{ ...sans, fontSize: 10, opacity: 0.5, lineHeight: 1.4 }}>{t.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Closing line */}
      {content.closing_line && (
        <div style={{ ...serif, fontStyle: "italic", fontSize: isMobile ? 14 : 16, opacity: 0.65, maxWidth: 700, lineHeight: 1.7 }}>
          {content.closing_line}
        </div>
      )}
    </section>
  )
}

function NextStepsSection({ content, isDark, isMobile }: { content: any; isDark: boolean; isMobile: boolean }) {
  const fade = useFadeIn()
  const steps: { title: string; bullets: string[] }[] = content.steps ?? []
  return (
    <section style={{ background: bg(isDark), color: fg(isDark), padding: isMobile ? "64px 28px" : "80px 64px", scrollSnapAlign: "start" }}>
      <div style={{ width: "100%", height: 0.5, background: fg(isDark), opacity: 0.1, marginBottom: 48 }} />
      <div ref={fade.ref} style={fade.style}>
        <div style={{ ...sans, fontSize: isMobile ? 18 : 20, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 24 }}>
          Next Steps &#9654; Bringing the Brand to Life
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 32 : 48, marginBottom: 48 }}>
          {/* Intro */}
          <div style={{ ...sans, fontSize: isMobile ? 13 : 14, lineHeight: 1.7, opacity: 0.65, flex: isMobile ? "auto" : "0 0 280px", maxWidth: 320 }}>
            {content.intro}
          </div>
          {/* Steps */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : `repeat(${steps.length}, 1fr)`, gap: isMobile ? 28 : 32 }}>
            {steps.map((step, i) => (
              <div key={i}>
                <div style={{ ...sans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{step.title}</div>
                {step.bullets.map((b: string, j: number) => (
                  <div key={j} style={{ ...sans, fontSize: 12, lineHeight: 1.65, opacity: 0.6, marginBottom: 6, paddingLeft: 12, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0 }}>&#9654;</span> {b}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   APPROVAL SECTION
   ═══════════════════════════════════════════ */

function ApprovalSection({ foundation, isDark, isMobile, onApprove }: {
  foundation: any; isDark: boolean; isMobile: boolean;
  onApprove: (note: string) => void
}) {
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const fade = useFadeIn()

  if (foundation.status === "approved") {
    return (
      <section style={{ background: bg(isDark), color: fg(isDark), padding: isMobile ? "64px 28px 80px" : "80px 64px 120px", textAlign: "center", scrollSnapAlign: "start" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.35, marginBottom: 16 }}>Direction Approved</div>
          <div style={{ ...sans, fontSize: 14, opacity: 0.5 }}>
            {foundation.approved_at && new Date(foundation.approved_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
          {foundation.approval_note && (
            <div style={{ ...sans, fontSize: 13, opacity: 0.45, marginTop: 16, fontStyle: "italic", lineHeight: 1.6 }}>
              &ldquo;{foundation.approval_note}&rdquo;
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <section style={{ background: bg(isDark), color: fg(isDark), padding: isMobile ? "64px 28px 80px" : "80px 64px 120px" }}>
      <div ref={fade.ref} style={{ ...fade.style, maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <CinqLogo width={24} color={fg(isDark)} />
        <div style={{ ...sans, fontSize: isMobile ? 18 : 22, fontWeight: 400, marginTop: 32, marginBottom: 8, letterSpacing: "-0.01em" }}>
          Ready to approve this direction?
        </div>
        <div style={{ ...sans, fontSize: 13, opacity: 0.45, marginBottom: 32, lineHeight: 1.6 }}>
          Once approved, we&rsquo;ll move into identity design.
        </div>
        <textarea
          placeholder="Add a note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          style={{
            width: "100%", maxWidth: 400, margin: "0 auto 24px",
            ...sans, fontSize: 13, lineHeight: 1.6,
            background: isDark ? "rgba(232,229,224,0.06)" : "rgba(28,25,22,0.04)",
            border: `0.5px solid ${isDark ? "rgba(232,229,224,0.1)" : "rgba(28,25,22,0.1)"}`,
            borderRadius: 4, padding: "12px 16px", color: fg(isDark),
            outline: "none", resize: "vertical", display: "block",
          }}
        />
        <button
          onClick={async () => {
            setSubmitting(true)
            await onApprove(note)
          }}
          disabled={submitting}
          style={{
            ...mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
            background: fg(isDark), color: bg(isDark),
            border: "none", padding: "14px 36px", cursor: "pointer",
            opacity: submitting ? 0.5 : 1,
          }}
        >
          {submitting ? "Submitting..." : "Approve Direction"}
        </button>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */

export default function BrandFoundationsPage({ params }: { params: { id: string } }) {
  const [foundation, setFoundation] = useState<any>(null)
  const [sections, setSections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: f } = await supabase
        .from("brand_foundations")
        .select("*, clients(name, contact_name)")
        .eq("id", params.id)
        .single()

      if (!f) { setLoading(false); return }
      setFoundation(f)

      const { data: s } = await supabase
        .from("brand_foundation_sections")
        .select("*")
        .eq("foundation_id", params.id)
        .order("sort_order")

      setSections(s ?? [])
      setLoading(false)

      // Track view (skip if admin)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        fetch("/api/notify/foundations-viewed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ foundationId: params.id }),
        }).catch(() => {})
      }
    }
    load()
  }, [params.id])

  async function handleApprove(note: string) {
    const now = new Date().toISOString()
    await supabase.from("brand_foundations").update({
      status: "approved",
      approved_at: now,
      approved_by: foundation?.clients?.contact_name ?? "Client",
      approval_note: note || null,
    }).eq("id", params.id)

    setFoundation((prev: any) => ({
      ...prev,
      status: "approved",
      approved_at: now,
      approval_note: note || null,
    }))

    // Notify admin
    fetch("/api/notify/foundations-approved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foundationId: params.id, note }),
    }).catch(() => {})
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CinqLogo width={28} color={DARK_TEXT} />
      </div>
    )
  }

  if (!foundation) {
    return (
      <div style={{ minHeight: "100vh", background: LIGHT_BG, display: "flex", alignItems: "center", justifyContent: "center", ...sans, opacity: 0.4 }}>
        Not found
      </div>
    )
  }

  // Extract trait names from moodboard sections for summary
  const moodboardTraits = sections
    .filter(s => s.section_type === "moodboard")
    .map(s => ({ name: s.content?.trait_name ?? "" }))

  // Determine last section bg for approval
  const lastSection = sections[sections.length - 1]
  const approvalDark = lastSection?.background === "dark"

  return (
    <div style={{ background: DARK_BG, height: "100vh", overflowY: "auto", scrollSnapType: "y proximity" }}>
      {/* Floating logo */}
      <div style={{
        position: "fixed", top: isMobile ? 16 : 24, left: isMobile ? 20 : 32,
        zIndex: 50, mixBlendMode: "difference",
      }}>
        <CinqLogo width={22} color="#F0EDE6" />
      </div>

      {/* Sections */}
      {sections.map((section) => {
        const isDark = section.background === "dark"
        const content = section.content ?? {}

        switch (section.section_type) {
          case "cover":
            return <CoverSection key={section.id} content={content} isDark={isDark} isMobile={isMobile} />
          case "purpose":
            return <PurposeSection key={section.id} content={content} isDark={isDark} isMobile={isMobile} />
          case "philosophy":
            return <PhilosophySection key={section.id} content={content} isDark={isDark} isMobile={isMobile} />
          case "moodboard":
            return <MoodboardSection key={section.id} content={content} isDark={isDark} isMobile={isMobile} />
          case "summary":
            return <SummarySection key={section.id} content={content} isDark={isDark} isMobile={isMobile} traits={moodboardTraits} />
          case "next_steps":
            return <NextStepsSection key={section.id} content={content} isDark={isDark} isMobile={isMobile} />
          default:
            return null
        }
      })}

      {/* Approval */}
      <ApprovalSection
        foundation={foundation}
        isDark={approvalDark}
        isMobile={isMobile}
        onApprove={handleApprove}
      />
    </div>
  )
}
