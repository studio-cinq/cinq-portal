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

const FORMAT_ORDER = ["svg", "png", "jpg", "jpeg", "webp", "pdf", "eps", "ai"]

function fileSize(bytes?: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

/**
 * For a given colorway, pick the best file per format:
 *   prefer files tagged with that color, fall back to color-agnostic source files.
 */
function bundleForColor(files: File[], colorId: string): File[] {
  const byFormat = new Map<string, File>()
  for (const f of files) {
    const fmt = (f.file_type ?? "").toLowerCase()
    const matches = f.color_id === colorId
    const generic = !f.color_id
    if (!matches && !generic) continue
    const existing = byFormat.get(fmt)
    // Prefer color-specific over generic
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

export default function MarkColorwaysClient({
  markName, colorways, files,
}: {
  markName: string
  colorways: Swatch[]
  files: File[]
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.55, marginBottom: 12 }}>
        Colorways <span style={{ opacity: 0.55 }}>· tap to download</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 14px" }}>
        {colorways.map(c => {
          const light = c.hex && relativeLuminance(c.hex) > 0.85
          const open = openId === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(open ? null : c.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "5px 10px 5px 6px",
                background: open ? "rgba(28,25,22,0.06)" : "transparent",
                border: open ? "0.5px solid rgba(28,25,22,0.4)" : "0.5px solid rgba(28,25,22,0.18)",
                cursor: "pointer", textAlign: "left",
                fontFamily: "inherit",
              }}
            >
              <span style={{
                display: "inline-block", width: 16, height: 16, borderRadius: "50%",
                background: c.hex || "transparent",
                border: light ? `0.5px solid ${LINE}` : "0.5px solid transparent",
              }} />
              <span style={{ ...sans, fontSize: 13, opacity: 0.88 }}>{c.name}</span>
            </button>
          )
        })}
      </div>

      {openId && (() => {
        const c = colorways.find(x => x.id === openId)!
        const bundle = bundleForColor(files, openId)
        return (
          <div style={{ marginTop: 16, padding: "16px 18px", background: "rgba(28,25,22,0.03)", border: `0.5px solid ${LINE}` }}>
            <div style={{ ...mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.55, marginBottom: 10 }}>
              {markName} · {c.name}
            </div>
            {bundle.length === 0 ? (
              <div style={{ ...sans, fontSize: 13, color: "rgba(28,25,22,0.55)", fontStyle: "italic" }}>
                No files uploaded for this colorway yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
