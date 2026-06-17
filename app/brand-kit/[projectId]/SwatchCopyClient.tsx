"use client"

import { useState } from "react"

type Swatch = {
  id: string
  name: string
  hex: string
  rgb?: string | null
  usage_note?: string | null
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

function isLight(hex: string): boolean {
  return relativeLuminance(hex) > 0.55
}

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" }

const LINE = "rgba(28,25,22,0.1)"
const PAPER = "#FBF7EE"

export default function SwatchCopyClient({ swatches }: { swatches: Swatch[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function copy(swatch: Swatch) {
    try {
      await navigator.clipboard.writeText(swatch.hex.toUpperCase())
      setCopiedId(swatch.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 16,
      marginTop: 56,
    }}>
      {swatches.map(s => {
        const light = isLight(s.hex)
        return (
          <button
            key={s.id}
            onClick={() => copy(s)}
            style={{
              background: PAPER,
              border: `0.5px solid ${LINE}`,
              padding: 0,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              textAlign: "left",
              transition: "transform 0.15s, border-color 0.15s",
              fontFamily: "inherit",
            }}
            className="bk-swatch"
            aria-label={`Copy ${s.name} ${s.hex.toUpperCase()}`}
          >
            {/* Chip — solid block of color, no text inside */}
            <div style={{
              background: s.hex,
              height: 130,
              borderBottom: `0.5px solid ${light ? LINE : "rgba(255,255,255,0.05)"}`,
              position: "relative",
            }}>
              {copiedId === s.id && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                  color: light ? "rgba(28,25,22,0.85)" : "rgba(245,241,234,0.95)",
                }}>
                  Copied
                </div>
              )}
            </div>
            {/* Info pane */}
            <div style={{ padding: "14px 16px 16px" }}>
              <div style={{ ...sans, fontSize: 14, opacity: 0.92, letterSpacing: "-0.005em" }}>
                {s.name || "Swatch"}
              </div>
              <div style={{ ...mono, fontSize: 11, letterSpacing: "0.04em", opacity: 0.6, marginTop: 4 }}>
                {s.hex.toUpperCase()}{s.rgb ? ` · rgb(${s.rgb})` : ""}
              </div>
              {s.usage_note && (
                <div style={{ ...sans, fontSize: 12, color: "rgba(28,25,22,0.55)", marginTop: 8, lineHeight: 1.5 }}>
                  {s.usage_note}
                </div>
              )}
            </div>
          </button>
        )
      })}

      <style>{`
        .bk-swatch:hover { transform: translateY(-2px); border-color: rgba(28,25,22,0.25) !important; }
      `}</style>
    </div>
  )
}
