"use client"

import { useState } from "react"

type Swatch = { id: string; name: string; hex: string }
type File = {
  id: string
  file_url: string
  file_type: string
  file_size_bytes?: number | null
  color_id?: string | null
}

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" }
const LINE = "rgba(28,25,22,0.1)"
const PAPER = "#FBF7EE"
const INK = "#1C1916"
const MUTED = "rgba(28,25,22,0.55)"

const FORMAT_ORDER = ["svg", "png", "jpg", "jpeg", "webp", "pdf", "eps", "ai"]
const PREVIEW_FORMAT_RANK: Record<string, number> = { svg: 0, png: 1, webp: 2, jpg: 3, jpeg: 3 }

/**
 * Hard-coded contrast pairs for the LoomHouse palette. Each colorway click
 * surfaces two combos: the colour as a mark, and the colour as a ground.
 * Ochre is too low-contrast on Plaster (under WCAG 3:1) so it pairs with Iron.
 */
type ComboKey = "iron" | "plaster" | "limestone" | "sage" | "clay" | "ochre"
const COLORWAY_PREVIEWS: Record<ComboKey, Array<{ mark: ComboKey; ground: ComboKey; label: string }>> = {
  iron:      [{ mark: "iron",      ground: "plaster",   label: "Iron on Plaster" },
              { mark: "plaster",   ground: "iron",      label: "Plaster on Iron" }],
  plaster:   [{ mark: "iron",      ground: "plaster",   label: "Iron on Plaster" },
              { mark: "plaster",   ground: "iron",      label: "Plaster on Iron" }],
  limestone: [{ mark: "iron",      ground: "limestone", label: "Iron on Limestone" },
              { mark: "limestone", ground: "iron",      label: "Limestone on Iron" }],
  sage:      [{ mark: "iron",      ground: "sage",      label: "Iron on Sage" },
              { mark: "sage",      ground: "iron",      label: "Sage on Iron" }],
  clay:      [{ mark: "clay",      ground: "plaster",   label: "Clay on Plaster" },
              { mark: "plaster",   ground: "clay",      label: "Plaster on Clay" }],
  ochre:     [{ mark: "iron",      ground: "ochre",     label: "Iron on Ochre" },
              { mark: "ochre",     ground: "iron",      label: "Ochre on Iron" }],
}

function relativeLuminance(hex: string): number {
  const h = (hex ?? "").replace("#", "").trim()
  if (h.length !== 6) return 0
  const toLin = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  const r = toLin(parseInt(h.slice(0, 2), 16))
  const g = toLin(parseInt(h.slice(2, 4), 16))
  const b = toLin(parseInt(h.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function fileSize(bytes?: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** For a given colorway, pick the best file per format. */
function bundleForColor(files: File[], colorId: string): File[] {
  const byFormat = new Map<string, File>()
  for (const f of files) {
    const fmt = (f.file_type ?? "").toLowerCase()
    const matches = f.color_id === colorId
    const generic = !f.color_id
    if (!matches && !generic) continue
    const existing = byFormat.get(fmt)
    if (!existing || (existing.color_id == null && matches)) {
      byFormat.set(fmt, f)
    }
  }
  return Array.from(byFormat.values()).sort((a, b) => {
    const ai = FORMAT_ORDER.indexOf((a.file_type ?? "").toLowerCase())
    const bi = FORMAT_ORDER.indexOf((b.file_type ?? "").toLowerCase())
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })
}

/** Pick the best preview file for a given colour swatch (svg > png > jpg…). */
function previewFileForColor(files: File[], swatchId: string | null): File | null {
  const candidates = files
    .filter(f => /(svg|png|jpg|jpeg|webp)$/i.test(f.file_type ?? ""))
    .filter(f => swatchId == null ? f.color_id == null : f.color_id === swatchId)
    .sort((a, b) => (PREVIEW_FORMAT_RANK[(a.file_type ?? "").toLowerCase()] ?? 99)
                   - (PREVIEW_FORMAT_RANK[(b.file_type ?? "").toLowerCase()] ?? 99))
  return candidates[0] ?? null
}

export default function MarkSpreadClient({
  projectId, markName, description, primaryUse, colorways, files, defaultColorwayId, displayScale = 1,
}: {
  projectId: string
  markName: string
  description?: string | null
  primaryUse?: string | null
  colorways: Swatch[]
  files: File[]
  defaultColorwayId?: string | null
  displayScale?: number
}) {
  // Initial colorway: explicit default → first in palette
  const initialId = defaultColorwayId && colorways.some(c => c.id === defaultColorwayId)
    ? defaultColorwayId
    : (colorways[0]?.id ?? null)
  const [selectedId, setSelectedId] = useState<string | null>(initialId)
  const [openDownloads, setOpenDownloads] = useState<string | null>(null)

  const swatchById = new Map(colorways.map(c => [c.id, c]))
  const swatchByName = new Map(colorways.map(c => [c.name.toLowerCase(), c]))
  const selected = selectedId ? swatchById.get(selectedId) : null

  // Try the LoomHouse-style hard-coded combos first; fall back to a luminance
  // pairing (selected colour as mark on lightest, selected as ground under darkest).
  function previewsForSelected() {
    if (!selected) return null
    const key = selected.name.toLowerCase() as ComboKey
    if (COLORWAY_PREVIEWS[key]) {
      // Verify every named ground/mark exists in the palette; otherwise fall back.
      const combos = COLORWAY_PREVIEWS[key]
      const allFound = combos.every(c => swatchByName.has(c.mark) && swatchByName.has(c.ground))
      if (allFound) {
        return combos.map(c => ({
          markSwatch: swatchByName.get(c.mark)!,
          groundSwatch: swatchByName.get(c.ground)!,
          label: c.label,
        }))
      }
    }
    // Fallback: pair the selected colour with the project's lightest + darkest.
    const sorted = [...colorways].sort((a, b) => relativeLuminance(a.hex) - relativeLuminance(b.hex))
    const darkest = sorted[0]
    const lightest = sorted[sorted.length - 1]
    return [
      { markSwatch: selected, groundSwatch: lightest, label: `${selected.name} on ${lightest?.name ?? "Light"}` },
      { markSwatch: lightest ?? selected, groundSwatch: darkest, label: `${(lightest ?? selected).name} on ${darkest?.name ?? "Ink"}` },
    ]
  }
  const previews = previewsForSelected()

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(280px, 1fr) minmax(0, 1.5fr)",
      gap: "clamp(28px, 4vw, 56px)",
      alignItems: "flex-start",
    }} className="bk-mark-spread">

      {/* LEFT — name, description, primary use, colorway picker + downloads */}
      <div>
        <h3 style={{
          ...sans, margin: 0, fontWeight: 400,
          fontSize: "clamp(28px, 3.5vw, 42px)",
          letterSpacing: "-0.02em", lineHeight: 1.1,
          opacity: 0.95,
        }}>
          {markName}
        </h3>
        {description && (
          <div style={{ ...sans, fontSize: "clamp(15px, 1.55vw, 16px)", color: "rgba(28,25,22,0.72)", lineHeight: 1.6, marginTop: 20, maxWidth: 420 }}>
            {description}
          </div>
        )}
        {primaryUse && (
          <div style={{ marginTop: 28 }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.55, marginBottom: 8 }}>
              Primary Use
            </div>
            <div style={{ ...sans, fontSize: "clamp(15px, 1.55vw, 16px)", color: "rgba(28,25,22,0.72)", lineHeight: 1.6, maxWidth: 420 }}>
              {primaryUse}
            </div>
          </div>
        )}

        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.55, marginBottom: 12, marginTop: 32 }}>
          Colorways <span style={{ opacity: 0.55 }}>· tap to preview</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 14px" }}>
          {colorways.map(c => {
            const isActive = c.id === selectedId
            const light = c.hex && relativeLuminance(c.hex) > 0.85
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "5px 10px 5px 6px",
                  background: isActive ? "rgba(28,25,22,0.08)" : "transparent",
                  border: isActive ? "0.5px solid rgba(28,25,22,0.6)" : "0.5px solid rgba(28,25,22,0.18)",
                  cursor: "pointer", textAlign: "left",
                  fontFamily: "inherit",
                }}
                title={`Preview ${c.name}`}
              >
                <span style={{
                  display: "inline-block", width: 16, height: 16, borderRadius: "50%",
                  background: c.hex || "transparent",
                  border: light ? `0.5px solid ${LINE}` : "0.5px solid transparent",
                }} />
                <span style={{ ...sans, fontSize: 13, opacity: isActive ? 1 : 0.78 }}>{c.name}</span>
              </button>
            )
          })}
        </div>

        {/* Download CTA for selected colorway */}
        {selected && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setOpenDownloads(openDownloads === selected.id ? null : selected.id)}
              style={{
                ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                color: "var(--ink)", background: "transparent",
                border: `0.5px solid ${LINE}`,
                padding: "6px 10px", cursor: "pointer",
              }}
            >
              {openDownloads === selected.id ? "Hide downloads" : `Download ${selected.name} files`}
            </button>
          </div>
        )}

        {openDownloads && (() => {
          const c = colorways.find(x => x.id === openDownloads)
          if (!c) return null
          const bundle = bundleForColor(files, openDownloads)
          return (
            <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(28,25,22,0.03)", border: `0.5px solid ${LINE}` }}>
              <div style={{ ...mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.55, marginBottom: 10 }}>
                {markName} · {c.name}
              </div>
              {bundle.length === 0 ? (
                <div style={{ ...sans, fontSize: 13, color: "rgba(28,25,22,0.55)", fontStyle: "italic" }}>
                  No files uploaded for this colorway yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {bundle.map(f => (
                    <a
                      key={f.id}
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      style={{
                        ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                        textDecoration: "none", color: "var(--ink)",
                        border: `0.5px solid ${LINE}`,
                        background: "var(--cream, #F5F1EA)",
                        padding: "6px 10px",
                        display: "inline-flex", alignItems: "center", gap: 8,
                      }}
                      title={`Download ${f.file_type}${f.file_size_bytes ? ` · ${fileSize(f.file_size_bytes)}` : ""}${!f.color_id ? " · source file" : ""}`}
                    >
                      <span>{f.file_type}</span>
                      <span style={{ opacity: 0.5 }}>↓</span>
                    </a>
                  ))}
                  {bundle.length > 1 && (
                    <a
                      href={`/api/brand-kit/download?projectId=${encodeURIComponent(projectId)}&mark=${encodeURIComponent(markName)}&colorwayId=${encodeURIComponent(c.id)}`}
                      download
                      style={{
                        ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                        textDecoration: "none", color: "var(--cream, #F5F1EA)",
                        background: "rgba(28,25,22,0.92)",
                        border: "0.5px solid rgba(28,25,22,0.92)",
                        padding: "6px 10px",
                        display: "inline-flex", alignItems: "center", gap: 8,
                        marginLeft: 4,
                      }}
                      title={`Download all ${bundle.length} files as a .zip`}
                    >
                      <span>Download all</span>
                      <span style={{ opacity: 0.7 }}>↓</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* RIGHT — two stacked stage panels, driven by the selected colorway */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {previews ? previews.map((p, i) => (
          <Stage
            key={`${selectedId}-${i}`}
            markName={markName}
            markFile={previewFileForColor(files, p.markSwatch.id) ?? previewFileForColor(files, null)}
            groundHex={p.groundSwatch.hex || PAPER}
            label={p.label}
            isDark={relativeLuminance(p.groundSwatch.hex) < 0.55}
            scale={displayScale}
          />
        )) : (
          <div style={{ ...sans, fontSize: 14, color: MUTED, fontStyle: "italic" }}>
            Tag at least one colourway to preview the mark.
          </div>
        )}
      </div>
    </div>
  )
}

function Stage({
  markName, markFile, groundHex, label, isDark, scale,
}: {
  markName: string
  markFile: File | null
  groundHex: string
  label: string
  isDark: boolean
  scale: number
}) {
  const widthPct = Math.max(10, Math.min(95, 60 * scale))
  const heightPct = Math.max(10, Math.min(95, 75 * scale))
  const captionColor = isDark ? "rgba(245,241,234,0.6)" : "rgba(28,25,22,0.55)"
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(28,25,22,0.08)"
  const isImg = markFile && /(svg|png|jpg|jpeg|webp)$/i.test(markFile.file_type ?? "")
  return (
    <div style={{
      background: groundHex,
      border: `0.5px solid ${borderColor}`,
      aspectRatio: "16/9",
      position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "32px 24px",
      transition: "background 0.25s ease",
    }}>
      {markFile && isImg ? (
        <img
          src={markFile.file_url}
          alt={markName}
          style={{
            maxWidth: `${widthPct}%`, maxHeight: `${heightPct}%`, objectFit: "contain",
            transition: "opacity 0.2s ease",
          }}
        />
      ) : (
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: captionColor }}>
          {markFile ? "Source file" : "Upload this colourway"}
        </div>
      )}
      <span style={{
        position: "absolute", left: 16, bottom: 12,
        ...mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
        color: captionColor,
      }}>
        {label}
      </span>
    </div>
  )
}
