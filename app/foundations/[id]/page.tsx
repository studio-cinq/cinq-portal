"use client"

import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"

/* ─── Lightbox context — lets any section open a full-size image overlay ─── */
const LightboxContext = createContext<(src: string) => void>(() => {})
function useLightbox() { return useContext(LightboxContext) }

/* ─── Favorites context — lets any moodboard image toggle a favorite
       and optionally attach a note. All writes are optimistic and hit
       the foundation_image_favorites table. ─── */
type FavoriteRecord = { id: string; note: string | null; imageIndex: number }
type FavoritesApi = {
  favorites: Map<string, FavoriteRecord>
  toggle: (args: { sectionId: string; imageUrl: string; imageIndex: number }) => Promise<void>
  setNote: (imageUrl: string, note: string) => Promise<void>
}
const FavoritesContext = createContext<FavoritesApi>({
  favorites: new Map(),
  toggle: async () => {},
  setNote: async () => {},
})
function useFavorites() { return useContext(FavoritesContext) }

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

/* Focal point → object-position CSS. Defaults to center. */
function focalToObjectPosition(focal?: { x?: number; y?: number } | null): string {
  const x = typeof focal?.x === "number" ? focal.x : 50
  const y = typeof focal?.y === "number" ? focal.y : 50
  return `${x}% ${y}%`
}

/* ─── Lightbox overlay: click image → full view, ESC or click outside closes ─── */
function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    // Lock body scroll AND the inner foundations scroll container while open.
    // Locking body alone isn't enough because #foundations-scroll has its own
    // overflow-y: auto — wheel/trackpad events would otherwise scroll the page
    // behind the lightbox, landing the user somewhere else when they close it.
    const prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const scroller = document.getElementById("foundations-scroll")
    const prevScrollerOverflow = scroller?.style.overflow ?? ""
    if (scroller) scroller.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevBodyOverflow
      if (scroller) scroller.style.overflow = prevScrollerOverflow
    }
  }, [src, onClose])

  if (!src) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(8,8,8,0.94)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px 32px",
        cursor: "zoom-out",
        animation: "lightbox-fade 0.18s ease-out",
      }}
    >
      <img
        src={src}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "100%", maxHeight: "100%",
          objectFit: "contain", display: "block",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          cursor: "default",
        }}
      />
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "fixed", top: 20, right: 24,
          background: "transparent", border: "none", cursor: "pointer",
          color: "#F0EDE6", opacity: 0.7,
          fontFamily: "'Matter SemiMono', 'SF Mono', monospace",
          fontSize: 20, lineHeight: 1, padding: 8,
        }}
      >
        ✕
      </button>
      <style>{`@keyframes lightbox-fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  )
}

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
    const root = document.getElementById("foundations-scroll")
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1, root: root ?? undefined })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, style: { opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: "opacity 0.8s ease, transform 0.8s ease" } }
}

/* ─── Grid layouts for moodboards ─── */
const GRID_CONFIGS: Record<string, { areas: string[]; rows: string; cols: string; aspectDesktop?: string; aspectMobile?: string }> = {
  "tall-sides":            { areas: ["1/1/3/2", "1/2/2/3", "2/2/3/3", "1/3/3/4"], rows: "1fr 1fr", cols: "1fr 1fr 1fr" },
  "tall-left":             { areas: ["1/1/3/2", "1/2/2/3", "1/3/2/4", "2/2/3/3", "2/3/3/4"], rows: "1fr 1fr", cols: "1fr 1fr 1fr" },
  "tall-center":           { areas: ["1/1/2/2", "2/1/3/2", "1/2/3/3", "1/3/2/4", "2/3/3/4"], rows: "1fr 1fr", cols: "1fr 1fr 1fr" },
  "grid-2x3":             { areas: ["1/1/2/2", "1/2/2/3", "1/3/2/4", "2/1/3/2", "2/2/3/3", "2/3/3/4"], rows: "1fr 1fr", cols: "1fr 1fr 1fr" },
  "tall-left-bottom-span": { areas: ["1/1/3/2", "1/2/2/3", "1/3/2/4", "2/2/3/4"], rows: "1fr 1fr", cols: "1fr 1fr 1fr" },
  "grid-2x4":             { areas: ["1/1/2/2", "1/2/2/3", "1/3/2/4", "1/4/2/5", "2/1/3/2", "2/2/3/3", "2/3/3/4", "2/4/3/5"], rows: "1fr 1fr", cols: "1fr 1fr 1fr 1fr" },
  "grid-3x3":             { areas: ["1/1/2/2", "1/2/2/3", "1/3/2/4", "2/1/3/2", "2/2/3/3", "2/3/3/4", "3/1/4/2", "3/2/4/3", "3/3/4/4"], rows: "1fr 1fr 1fr", cols: "1fr 1fr 1fr", aspectDesktop: "4/3", aspectMobile: "3/4" },
  "tall-left-lg":          { areas: ["1/1/4/2", "1/2/2/3", "1/3/2/4", "2/2/3/3", "2/3/3/4", "3/2/4/3", "3/3/4/4"], rows: "1fr 1fr 1fr", cols: "1fr 1fr 1fr", aspectDesktop: "4/3", aspectMobile: "3/4" },
  // Mixed-aspect layouts — uneven grid tracks create natural portrait / landscape / square cells
  "portrait-pair":         { areas: ["1/1/3/2", "1/2/2/3", "1/3/2/4", "2/2/3/3", "2/3/3/4", "1/4/3/5"], rows: "1fr 1fr", cols: "2fr 3fr 3fr 2fr" },
  "hero-mosaic":           { areas: ["1/1/2/2", "1/2/2/3", "1/3/2/4", "2/1/3/2", "3/1/4/2", "2/2/4/3", "2/3/4/4"], rows: "3fr 2fr 2fr", cols: "3fr 2fr 2fr", aspectDesktop: "4/3", aspectMobile: "3/4" },
  "editorial-mix":         { areas: ["1/1/2/3", "1/3/2/4", "1/4/3/5", "2/1/3/2", "2/2/3/3", "2/3/3/4", "3/1/4/2", "3/2/4/4", "3/4/4/5"], rows: "2fr 3fr 2fr", cols: "3fr 2fr 3fr 2fr", aspectDesktop: "4/3", aspectMobile: "3/4" },
}

/* ═══════════════════════════════════════════
   SECTION COMPONENTS
   ═══════════════════════════════════════════ */

function CoverSection({ content, isDark, isMobile }: { content: any; isDark: boolean; isMobile: boolean }) {
  const fade = useFadeIn()
  return (
    <section style={{ minHeight: isMobile ? "100dvh" : "100vh", background: bg(isDark), color: fg(isDark), display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: isMobile ? "48px 28px" : "56px 64px", scrollSnapAlign: "start" }}>
      <div ref={fade.ref} style={{ ...fade.style, marginBottom: "auto", marginTop: isMobile ? "30dvh" : "35vh" }}>
        <div style={{ ...sans, fontSize: isMobile ? 34 : 48, fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
          {content.client_name}
        </div>
        <div style={{ ...sans, fontSize: isMobile ? 26 : 36, fontWeight: 300, letterSpacing: "-0.015em", opacity: 0.6, marginTop: 2 }}>
          {content.subtitle}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: "0.08em", opacity: 0.3 }}>
          {content.date}{content.version ? ` / ${content.version}` : ""}
        </div>
        <CinqLogo width={28} color={fg(isDark)} />
      </div>
    </section>
  )
}

function PurposeSection({ content, isDark, isMobile }: { content: any; isDark: boolean; isMobile: boolean }) {
  const fade = useFadeIn()
  const eyebrowColor = isDark ? "rgba(232,229,224,0.5)" : "rgba(28,25,22,0.45)"
  return (
    <section style={{ minHeight: isMobile ? "100dvh" : "100vh", background: bg(isDark), color: fg(isDark), display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: isMobile ? "48px 28px" : "56px 64px", scrollSnapAlign: "start" }}>
      <div ref={fade.ref} style={{ ...fade.style, maxWidth: 800 }}>
        <div style={{ ...mono, fontSize: isMobile ? 10 : 11, letterSpacing: "0.14em", textTransform: "uppercase", color: eyebrowColor, marginBottom: isMobile ? 18 : 22 }}>
          {content.label}
        </div>
        <div style={{ ...sans, fontSize: isMobile ? 22 : 30, fontWeight: 300, lineHeight: 1.45, letterSpacing: "-0.01em", whiteSpace: "pre-wrap" }}>
          {renderEmphasis(content.statement)}
        </div>
      </div>
    </section>
  )
}

function PhilosophySection({ content, isDark, isMobile, traitMeta = [] }: {
  content: any; isDark: boolean; isMobile: boolean
  traitMeta?: { name: string; descriptor?: string }[]
}) {
  const fade = useFadeIn()
  const traits: string[] = content.traits ?? []
  const openLightbox = useLightbox()

  // Map each trait to its descriptor (from moodboard), matched by name (case-insensitive)
  const descriptorFor = (trait: string) => {
    const match = traitMeta.find(m => m.name?.trim().toLowerCase() === trait.trim().toLowerCase())
    return match?.descriptor ?? ""
  }

  const dividerColor = isDark ? "rgba(232,229,224,0.14)" : "rgba(28,25,22,0.12)"
  const numberColor = isDark ? "rgba(232,229,224,0.4)" : "rgba(28,25,22,0.35)"

  return (
    <section style={{ minHeight: isMobile ? "100dvh" : "100vh", background: bg(isDark), color: fg(isDark), display: "flex", flexDirection: isMobile ? "column" : "row", scrollSnapAlign: "start" }}>
      {/* Left — text */}
      <div ref={fade.ref} style={{ ...fade.style, flex: 1, padding: isMobile ? "48px 28px 72px" : "56px 64px 96px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ ...sans, fontSize: isMobile ? 22 : 26, fontWeight: 600, letterSpacing: "-0.015em", marginBottom: 20 }}>
          {content.title}
        </div>
        <div style={{ width: 48, height: 1, background: fg(isDark), opacity: 0.2, marginBottom: 24 }} />
        <div style={{ ...sans, fontSize: isMobile ? 14 : 14, lineHeight: 1.72, opacity: 0.75, maxWidth: 580, marginBottom: 44, whiteSpace: "pre-wrap" }}>
          {content.body}
        </div>
        {traits.length > 0 && (
          <>
            <div style={{ ...sans, fontSize: isMobile ? 16 : 18, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 20, opacity: 0.85 }}>
              {content.traits_title ?? "Core Brand Traits"}
            </div>
            <div style={{ borderTop: `0.5px solid ${dividerColor}` }}>
              {traits.map((t: string, i: number) => {
                const descriptor = descriptorFor(t)
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "32px 1fr" : "44px 1fr",
                      columnGap: isMobile ? 12 : 20,
                      alignItems: "baseline",
                      padding: isMobile ? "16px 0" : "20px 0",
                      borderBottom: `0.5px solid ${dividerColor}`,
                    }}
                  >
                    {/* Numeral */}
                    <div style={{
                      ...mono, fontSize: isMobile ? 10 : 11,
                      letterSpacing: "0.1em", color: numberColor,
                      paddingTop: 4,
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    {/* Name + descriptor */}
                    <div>
                      <div style={{ ...sans, fontSize: isMobile ? 18 : 22, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.25 }}>
                        {t}
                      </div>
                      {descriptor && (
                        <div style={{ ...serif, fontStyle: "italic", fontSize: isMobile ? 13 : 14, lineHeight: 1.55, opacity: 0.55, marginTop: 6 }}>
                          {descriptor}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      {/* Right — image */}
      <div style={{ flex: 1, minHeight: isMobile ? 300 : "auto", position: "relative", overflow: "hidden" }}>
        {content.image_url ? (
          <img
            src={content.image_url}
            alt=""
            onClick={() => openLightbox(content.image_url)}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focalToObjectPosition(content.image_focal), display: "block", cursor: "zoom-in" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", minHeight: isMobile ? 300 : 600, background: isDark ? "rgba(232,229,224,0.05)" : "rgba(28,25,22,0.04)" }} />
        )}
      </div>
    </section>
  )
}

/* ─── Favorite button — heart + optional note, overlaid on moodboard image ─── */
function FavoriteButton({ sectionId, imageUrl, imageIndex, isMobile }: {
  sectionId: string; imageUrl: string; imageIndex: number; isMobile: boolean
}) {
  const { favorites, toggle, setNote } = useFavorites()
  const record = favorites.get(imageUrl)
  const isFav = !!record
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  // Keep the draft in sync when the record's note changes (e.g. after save).
  useEffect(() => { setDraft(record?.note ?? "") }, [record?.note])

  // Swallow the click so the lightbox underneath doesn't also fire.
  const stop = (e: React.MouseEvent) => { e.stopPropagation() }

  const chipBg = "rgba(12,12,12,0.55)"
  const chipBgHover = "rgba(12,12,12,0.75)"
  const iconSize = 30
  const iconFont = isMobile ? 15 : 14

  return (
    <>
      {/* Controls — bottom-right of image */}
      <div
        onClick={stop}
        style={{
          position: "absolute", bottom: 8, right: 8, zIndex: 2,
          display: "flex", gap: 6, alignItems: "center",
        }}
      >
        {isFav && (
          <button
            onClick={(e) => { stop(e); setEditing(true) }}
            aria-label={record?.note ? "Edit note" : "Add a note"}
            style={{
              ...mono, fontSize: isMobile ? 10 : 9,
              letterSpacing: "0.1em", textTransform: "uppercase",
              height: iconSize, padding: "0 12px",
              background: chipBg, color: "#F0EDE6",
              border: "none", borderRadius: iconSize / 2,
              cursor: "pointer", display: "flex", alignItems: "center",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = chipBgHover }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = chipBg }}
          >
            {record?.note ? "Edit note" : "+ Note"}
          </button>
        )}
        <button
          onClick={(e) => { stop(e); toggle({ sectionId, imageUrl, imageIndex }) }}
          aria-label={isFav ? "Remove favorite" : "Favorite this image"}
          aria-pressed={isFav}
          style={{
            width: iconSize, height: iconSize,
            background: chipBg, color: isFav ? "#ff5c7a" : "#F0EDE6",
            border: "none", borderRadius: "50%",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: iconFont, lineHeight: 1,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            transition: "transform 120ms ease, color 160ms ease",
          }}
          onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = chipBgHover }}
          onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = chipBg }}
        >
          <span aria-hidden style={{ transform: isFav ? "scale(1.08)" : "scale(1)", transition: "transform 120ms ease", display: "block" }}>
            {isFav ? "♥" : "♡"}
          </span>
        </button>
      </div>

      {/* Note editor overlay — inside the image cell, above the lightbox */}
      {editing && (
        <div
          onClick={(e) => { stop(e); setEditing(false) }}
          style={{
            position: "absolute", inset: 0, zIndex: 3,
            background: "rgba(8,8,8,0.72)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={stop}
            style={{
              background: "#F0EDE6", color: "#1C1916",
              borderRadius: 4, padding: 16,
              width: "100%", maxWidth: 320,
              boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 10 }}>
              Note on this image
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              rows={3}
              placeholder="Why this one?"
              style={{
                ...sans, fontSize: 13, lineHeight: 1.5,
                width: "100%", boxSizing: "border-box",
                background: "rgba(28,25,22,0.04)",
                border: "0.5px solid rgba(28,25,22,0.12)",
                borderRadius: 3, padding: "10px 12px",
                color: "#1C1916",
                outline: "none", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={(e) => { stop(e); setEditing(false) }}
                style={{ ...mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", background: "transparent", color: "#1C1916", border: "none", padding: "8px 14px", cursor: "pointer", opacity: 0.55 }}
              >
                Cancel
              </button>
              <button
                onClick={async (e) => { stop(e); await setNote(imageUrl, draft.trim()); setEditing(false) }}
                style={{ ...mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", background: "#1C1916", color: "#F0EDE6", border: "none", padding: "8px 14px", cursor: "pointer" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MoodboardSection({ content, sectionId, isDark, isMobile }: { content: any; sectionId: string; isDark: boolean; isMobile: boolean }) {
  const fade = useFadeIn()
  const layout = content.layout ?? "tall-left"
  const config = GRID_CONFIGS[layout]
  const images: string[] = content.images ?? []
  const openLightbox = useLightbox()
  const isMasonry = layout === "masonry"

  return (
    <section style={{ background: bg(isDark), color: fg(isDark), padding: isMobile ? "56px 0 48px" : "96px 0 72px", scrollSnapAlign: "start" }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "baseline", padding: isMobile ? "0 28px 24px" : "0 64px 32px", flexWrap: "wrap", gap: isMobile ? 4 : 8 }}>
        <div style={{ ...sans, fontSize: isMobile ? 20 : 24, fontWeight: 600, letterSpacing: "-0.015em" }}>
          {content.trait_name}
        </div>
        {content.descriptor && (
          <div style={{ ...serif, fontStyle: "italic", fontSize: isMobile ? 13 : 15, opacity: 0.5, maxWidth: 440, textAlign: isMobile ? "left" : "right" }}>
            {content.descriptor}
          </div>
        )}
      </div>

      {isMasonry ? (
        /* ─── Masonry: CSS columns, natural aspect ratios ─── */
        <div ref={fade.ref} style={{
          ...fade.style,
          columnCount: isMobile ? 2 : 3,
          columnGap: 4,
          padding: isMobile ? "0 4px" : "0",
        }}>
          {images.filter(Boolean).map((src, i) => (
            <div key={i} style={{ position: "relative", marginBottom: 4, breakInside: "avoid" }}>
              <img
                src={src}
                alt=""
                onClick={() => openLightbox(src)}
                style={{ width: "100%", display: "block", cursor: "zoom-in" }}
              />
              <FavoriteButton sectionId={sectionId} imageUrl={src} imageIndex={i} isMobile={isMobile} />
            </div>
          ))}
        </div>
      ) : (
        /* ─── Fixed grid: predefined cell areas ─── */
        <div ref={fade.ref} style={{
          ...fade.style,
          display: "grid",
          gridTemplateRows: (config ?? GRID_CONFIGS["tall-left"]).rows,
          gridTemplateColumns: (config ?? GRID_CONFIGS["tall-left"]).cols,
          gap: 4,
          aspectRatio: isMobile
            ? ((config ?? GRID_CONFIGS["tall-left"]).aspectMobile ?? "4/5")
            : ((config ?? GRID_CONFIGS["tall-left"]).aspectDesktop ?? "16/9"),
        }}>
          {(config ?? GRID_CONFIGS["tall-left"]).areas.map((area, i) => (
            <div key={i} style={{ gridArea: area, overflow: "hidden", position: "relative", background: isDark ? "rgba(232,229,224,0.06)" : "rgba(28,25,22,0.05)" }}>
              {images[i] ? (
                <>
                  <img
                    src={images[i]}
                    alt=""
                    onClick={() => openLightbox(images[i])}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focalToObjectPosition(content.image_focals?.[i]), display: "block", cursor: "zoom-in" }}
                  />
                  <FavoriteButton sectionId={sectionId} imageUrl={images[i]} imageIndex={i} isMobile={isMobile} />
                </>
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ ...mono, fontSize: 10, opacity: 0.15, textTransform: "uppercase", letterSpacing: "0.1em" }}>{i + 1}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function SummarySection({ content, isDark, isMobile, traits }: {
  content: any; isDark: boolean; isMobile: boolean
  traits: { name: string; image?: string | null; focal?: { x?: number; y?: number } | null }[]
}) {
  const fade = useFadeIn()
  const openLightbox = useLightbox()
  return (
    <section style={{ background: bg(isDark), color: fg(isDark), padding: isMobile ? "64px 28px" : "80px 64px", scrollSnapAlign: "start" }}>
      {/* Closing statement */}
      <div ref={fade.ref} style={{ ...fade.style, ...sans, fontSize: isMobile ? 15 : 16, lineHeight: 1.75, fontWeight: 500, maxWidth: 800, marginBottom: 64, whiteSpace: "pre-wrap" }}>
        {content.closing_statement}
      </div>

      <div style={{ width: "100%", height: 0.5, background: fg(isDark), opacity: 0.18, marginBottom: 64 }} />

      {/* Recap — circle left, thumbnail grid right */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 40 : 48, alignItems: "center", marginBottom: 48 }}>
        {/* Circle with title + body. Text is constrained to the inscribed
            square (diameter / √2 ≈ 0.7×) so long copy doesn't clip past
            the circle's curve at top and bottom. */}
        <div style={{ flex: "0 0 auto" }}>
          <div style={{
            width: isMobile ? 240 : 260, height: isMobile ? 240 : 260,
            borderRadius: "50%", border: `0.5px solid ${isDark ? "rgba(232,229,224,0.25)" : "rgba(28,25,22,0.22)"}`,
            display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 36 : 38,
          }}>
            <div style={{ maxWidth: isMobile ? 168 : 184, textAlign: "center" }}>
              <div style={{ ...sans, fontSize: isMobile ? 12 : 14, fontWeight: 700, lineHeight: 1.35, letterSpacing: "-0.01em", marginBottom: 10 }}>
                {content.recap_title}
              </div>
              {content.recap_body && (
                <div style={{ ...sans, fontSize: isMobile ? 10 : 10.5, lineHeight: 1.55, opacity: 0.5 }}>
                  {content.recap_body}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Trait thumbnails — 2-row grid */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : `repeat(${Math.min(Math.ceil(traits.length / 2), 4)}, 1fr)`, gap: isMobile ? 14 : 16 }}>
          {traits.map((t, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ aspectRatio: "1", background: isDark ? "rgba(232,229,224,0.06)" : "rgba(28,25,22,0.05)", marginBottom: 8, borderRadius: 2, overflow: "hidden" }}>
                {t.image && (
                  <img
                    src={t.image}
                    alt=""
                    onClick={() => openLightbox(t.image!)}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focalToObjectPosition(t.focal), display: "block", cursor: "zoom-in" }}
                  />
                )}
              </div>
              <div style={{ ...sans, fontSize: isMobile ? 11 : 10, opacity: 0.5, lineHeight: 1.4 }}>{t.name}</div>
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
      <div style={{ width: "100%", height: 0.5, background: fg(isDark), opacity: 0.18, marginBottom: 48 }} />
      <div ref={fade.ref} style={fade.style}>
        <div style={{ ...sans, fontSize: isMobile ? 18 : 20, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 24 }}>
          Next Steps <span style={{ fontSize: "0.6em", verticalAlign: "middle", opacity: 0.5 }}>&#9654;</span> Bringing the Brand to Life
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 32 : 48, marginBottom: 48 }}>
          {/* Intro */}
          <div style={{ ...sans, fontSize: isMobile ? 13 : 14, lineHeight: 1.7, opacity: 0.65, flex: isMobile ? "auto" : "0 0 280px", maxWidth: 320, whiteSpace: "pre-wrap" }}>
            {content.intro}
          </div>
          {/* Steps */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : `repeat(${steps.length}, 1fr)`, gap: isMobile ? 28 : 32 }}>
            {steps.map((step, i) => (
              <div key={i}>
                <div style={{ ...sans, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{step.title}</div>
                {step.bullets.map((b: string, j: number) => (
                  <div key={j} style={{ ...sans, fontSize: 12, lineHeight: 1.65, opacity: 0.6, marginBottom: 6, paddingLeft: 14, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, fontSize: 8, top: 4, opacity: 0.7 }}>&#9654;</span> {b}
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
      <section style={{ background: bg(isDark), color: fg(isDark), padding: isMobile ? "64px 28px 80px" : "80px 64px 120px", textAlign: "center", scrollSnapAlign: "end" }}>
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
    <section style={{ background: bg(isDark), color: fg(isDark), padding: isMobile ? "64px 28px 80px" : "80px 64px 120px", scrollSnapAlign: "end" }}>
      <div ref={fade.ref} style={{ ...fade.style, maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}><CinqLogo width={24} color={fg(isDark)} /></div>
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
            border: "none", padding: isMobile ? "16px 36px" : "14px 36px", cursor: "pointer",
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
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)
  const [cardDismissed, setCardDismissed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Hold the title card on screen long enough for its full sequence (~2.6s).
  // Without this, fast Supabase responses unmount the loader before the logo + tagline animate in.
  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 2600)
    return () => clearTimeout(t)
  }, [])

  // Once both data is ready AND the title sequence has played, fade the card out
  // over 900ms, then unmount it so it stops intercepting interaction.
  const cardReadyToFade = !loading && minTimeElapsed
  useEffect(() => {
    if (!cardReadyToFade) return
    const t = setTimeout(() => setCardDismissed(true), 950)
    return () => clearTimeout(t)
  }, [cardReadyToFade])

  // Paint html + body dark while the foundations page is mounted.
  // The scroll container is height: 100dvh on mobile; iOS Safari's URL bar
  // dynamically shrinks dvh, exposing the page's cream body gradient beneath.
  // Matching the background here avoids an off-white bar peeking at the bottom.
  useEffect(() => {
    const prevHtmlBg = document.documentElement.style.background
    const prevBodyBg = document.body.style.background
    document.documentElement.style.background = DARK_BG
    document.body.style.background = DARK_BG
    return () => {
      document.documentElement.style.background = prevHtmlBg
      document.body.style.background = prevBodyBg
    }
  }, [])

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

  // Lightbox state (declared above early returns to keep hook order stable)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const openLightbox = useCallback((src: string) => setLightboxSrc(src), [])

  /* ─── Favorites state ─────────────────────────────────────────────
     Mirrors foundation_image_favorites rows for this foundation. Keyed
     by image_url since that's the natural identifier in the UI. Writes
     are optimistic: update the map first, then hit Supabase; on error
     we roll the state back. ─────────────────────────────────────── */
  const [favorites, setFavorites] = useState<Map<string, FavoriteRecord>>(new Map())

  useEffect(() => {
    async function loadFavorites() {
      const { data } = await supabase
        .from("foundation_image_favorites")
        .select("id, image_url, image_index, note")
        .eq("foundation_id", params.id)
      if (!data) return
      const next = new Map<string, FavoriteRecord>()
      for (const row of data as any[]) {
        next.set(row.image_url, { id: row.id, note: row.note, imageIndex: row.image_index })
      }
      setFavorites(next)
    }
    loadFavorites()
  }, [params.id])

  const toggleFavorite = useCallback(async ({ sectionId, imageUrl, imageIndex }: { sectionId: string; imageUrl: string; imageIndex: number }) => {
    const existing = favorites.get(imageUrl)
    if (existing) {
      // Optimistic remove
      setFavorites(prev => { const next = new Map(prev); next.delete(imageUrl); return next })
      const { error } = await supabase.from("foundation_image_favorites").delete().eq("id", existing.id)
      if (error) {
        // Roll back
        setFavorites(prev => { const next = new Map(prev); next.set(imageUrl, existing); return next })
      }
    } else {
      // Optimistic add (temporary id until DB responds)
      const tempId = `temp-${Date.now()}`
      setFavorites(prev => { const next = new Map(prev); next.set(imageUrl, { id: tempId, note: null, imageIndex }); return next })
      const { data, error } = await supabase
        .from("foundation_image_favorites")
        .insert({ foundation_id: params.id, section_id: sectionId, image_url: imageUrl, image_index: imageIndex })
        .select("id")
        .single()
      if (error || !data) {
        setFavorites(prev => { const next = new Map(prev); next.delete(imageUrl); return next })
      } else {
        setFavorites(prev => { const next = new Map(prev); next.set(imageUrl, { id: (data as any).id, note: null, imageIndex }); return next })
      }
    }
  }, [favorites, params.id])

  const setFavoriteNote = useCallback(async (imageUrl: string, note: string) => {
    const existing = favorites.get(imageUrl)
    if (!existing) return
    const trimmed = note.trim()
    const newNote = trimmed.length === 0 ? null : trimmed
    // Optimistic update
    setFavorites(prev => { const next = new Map(prev); next.set(imageUrl, { ...existing, note: newNote }); return next })
    const { error } = await supabase.from("foundation_image_favorites").update({ note: newNote }).eq("id", existing.id)
    if (error) {
      setFavorites(prev => { const next = new Map(prev); next.set(imageUrl, existing); return next })
    }
  }, [favorites])

  const favoritesApi: FavoritesApi = { favorites, toggle: toggleFavorite, setNote: setFavoriteNote }

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

  // Extract trait name + descriptor + thumbnail from each moodboard section.
  // Powers both the Philosophy "Core Brand Traits" list and the Summary thumbnails.
  const moodboardTraits = !loading ? sections
    .filter(s => s.section_type === "moodboard")
    .map(s => {
      const c = s.content ?? {}
      const images: string[] = c.images ?? []
      const focals: any[] = c.image_focals ?? []
      const idx = typeof c.summary_image_index === "number" ? c.summary_image_index : 0
      return {
        name: c.trait_name ?? "",
        descriptor: c.descriptor ?? "",
        image: images[idx] ?? images.find(Boolean) ?? null,
        focal: focals[idx] ?? focals.find(Boolean) ?? null,
      }
    }) : []

  // Determine last section bg for approval
  const lastSection = sections[sections.length - 1]
  const approvalDark = lastSection?.background === "dark"

  // Not-found state (data loaded, no foundation)
  if (!loading && !foundation) {
    return (
      <div style={{ minHeight: "100vh", background: LIGHT_BG, display: "flex", alignItems: "center", justifyContent: "center", ...sans, opacity: 0.4 }}>
        Not found
      </div>
    )
  }

  return (
    <>
    {/* ─── Title card overlay ─── Always in the same tree position so React
        never unmounts/remounts it (which would restart CSS animations). */}
    {!cardDismissed && (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: DARK_BG, color: DARK_TEXT,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          opacity: cardReadyToFade ? 0 : 1,
          transition: "opacity 900ms cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: cardReadyToFade ? "none" : "auto",
        }}
      >
        <style>{`
          @keyframes title-rise {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: var(--title-opacity, 1); transform: translateY(0); }
          }
          @keyframes title-rule {
            from { transform: scaleX(0); }
            to   { transform: scaleX(1); }
          }
          .title-eyebrow {
            opacity: 0;
            animation: title-rise 1100ms cubic-bezier(0.22, 0.61, 0.36, 1) 200ms forwards;
            --title-opacity: 0.4;
          }
          .title-logo {
            opacity: 0;
            animation: title-rise 1200ms cubic-bezier(0.22, 0.61, 0.36, 1) 500ms forwards;
            --title-opacity: 1;
          }
          .title-rule {
            transform: scaleX(0);
            transform-origin: center;
            animation: title-rule 900ms cubic-bezier(0.22, 0.61, 0.36, 1) 1100ms forwards;
          }
          .title-tagline {
            opacity: 0;
            animation: title-rise 1300ms cubic-bezier(0.22, 0.61, 0.36, 1) 1300ms forwards;
            --title-opacity: 0.45;
          }
        `}</style>
        <div className="title-eyebrow" style={{ ...mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 18 }}>
          Prepared by
        </div>
        <div className="title-logo">
          <CinqLogo width={28} color={DARK_TEXT} />
        </div>
        <div className="title-rule" style={{ width: 24, height: 1, background: DARK_TEXT, opacity: 0.25, marginTop: 22 }} />
        <div className="title-tagline" style={{ ...sans, fontStyle: "italic", fontSize: 12, marginTop: 14, fontFamily: "var(--font-serif)" }}>
          A studio for thoughtful design.
        </div>
      </div>
    )}

    {/* ─── Page content (renders behind the title card while it's visible) ─── */}
    <LightboxContext.Provider value={openLightbox}>
    <FavoritesContext.Provider value={favoritesApi}>
    <div id="foundations-scroll" style={{ position: "relative", background: DARK_BG, height: isMobile ? "100dvh" : "100vh", overflowY: "auto", scrollSnapType: "y proximity" }}>
      {/* Back to portal — top-left, scrolls with page */}
      <div style={{
        position: "absolute", top: isMobile ? 8 : 24, left: isMobile ? 12 : 32,
        zIndex: 50, mixBlendMode: "difference",
      }}>
        <a href="/login" style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#F0EDE6", textDecoration: "none", opacity: 0.4, padding: isMobile ? "12px 16px" : undefined, display: "block" }}>
          ← Portal
        </a>
      </div>

      {/* Sections — only render once data is ready */}
      {foundation && sections.map((section) => {
        const isDark = section.background === "dark"
        const content = section.content ?? {}

        switch (section.section_type) {
          case "cover":
            return <CoverSection key={section.id} content={content} isDark={isDark} isMobile={isMobile} />
          case "purpose":
            return <PurposeSection key={section.id} content={content} isDark={isDark} isMobile={isMobile} />
          case "philosophy":
            return <PhilosophySection key={section.id} content={content} isDark={isDark} isMobile={isMobile} traitMeta={moodboardTraits} />
          case "moodboard":
            return <MoodboardSection key={section.id} sectionId={section.id} content={content} isDark={isDark} isMobile={isMobile} />
          case "summary":
            return <SummarySection key={section.id} content={content} isDark={isDark} isMobile={isMobile} traits={moodboardTraits} />
          case "next_steps":
            return <NextStepsSection key={section.id} content={content} isDark={isDark} isMobile={isMobile} />
          default:
            return null
        }
      })}

      {/* Approval */}
      {foundation && <ApprovalSection
        foundation={foundation}
        isDark={approvalDark}
        isMobile={isMobile}
        onApprove={handleApprove}
      />}

      {/* Lightbox */}
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
    </FavoritesContext.Provider>
    </LightboxContext.Provider>
    </>
  )
}
