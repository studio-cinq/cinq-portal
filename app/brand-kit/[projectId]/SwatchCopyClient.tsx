"use client"

import { useState } from "react"

type Swatch = { id: string; name: string; hex: string }

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "").trim()
  if (h.length !== 6) return ""
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

function isLight(hex: string): boolean {
  const h = hex.replace("#", "").trim()
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.65
}

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" }

export default function SwatchCopyClient({ swatches }: { swatches: Swatch[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function copy(swatch: Swatch) {
    try {
      await navigator.clipboard.writeText(swatch.hex.toUpperCase())
      setCopiedId(swatch.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // Clipboard unavailable — silently ignore
    }
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: 16,
      marginTop: 56,
    }}>
      {swatches.map(s => {
        const light = isLight(s.hex)
        const textColor = light ? "rgba(28,25,22,0.78)" : "rgba(245,241,234,0.92)"
        const dimColor = light ? "rgba(28,25,22,0.5)" : "rgba(245,241,234,0.55)"
        return (
          <button
            key={s.id}
            onClick={() => copy(s)}
            style={{
              background: s.hex,
              border: light ? "0.5px solid rgba(28,25,22,0.12)" : "0.5px solid rgba(255,255,255,0.08)",
              padding: "22px 18px",
              aspectRatio: "4/5",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "stretch",
              textAlign: "left",
              transition: "transform 0.15s",
              fontFamily: "inherit",
            }}
            className="bk-swatch"
            aria-label={`Copy ${s.name} ${s.hex.toUpperCase()}`}
          >
            <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: dimColor }}>
              {copiedId === s.id ? "Copied" : (s.name || "Swatch")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ ...sans, fontSize: 18, letterSpacing: "-0.01em", color: textColor }}>
                {s.hex.toUpperCase()}
              </div>
              <div style={{ ...mono, fontSize: 10, letterSpacing: "0.08em", color: dimColor }}>
                RGB {hexToRgb(s.hex)}
              </div>
            </div>
          </button>
        )
      })}

      <style>{`
        .bk-swatch:hover { transform: translateY(-2px); }
      `}</style>
    </div>
  )
}
