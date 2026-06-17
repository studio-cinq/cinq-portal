"use client"

import { useState } from "react"

type Swatch = {
  id: string
  name: string
  hex: string
  rgb?: string | null
  cmyk?: string | null
  pms?: string | null
  tier?: string | null
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

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" }

const INK = "#1C1916"
const PLASTER_FALLBACK = "#F5F1EA"
const HAIRLINE = "rgba(28,25,22,0.1)"

function formatRgb(s?: string | null): string | null {
  if (!s) return null
  // Stored as "r, g, b" or "r/g/b"; render as "R / G / B"
  return s
    .split(/[,/]/)
    .map(p => p.trim())
    .filter(Boolean)
    .join(" / ")
}

export default function SwatchCopyClient({
  swatches, panelColor,
}: {
  swatches: Swatch[]
  panelColor?: string
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const panel = panelColor || PLASTER_FALLBACK

  async function copy(swatch: Swatch) {
    try {
      await navigator.clipboard.writeText(swatch.hex.toUpperCase())
      setCopiedId(swatch.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {}
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: 20,
      marginTop: 56,
    }}>
      {swatches.map(s => {
        const blockDark = relativeLuminance(s.hex) < 0.55
        const onBlockColor = blockDark ? panel : INK
        const onBlockMuted = blockDark ? "rgba(245,241,234,0.65)" : "rgba(28,25,22,0.55)"
        const rgb = formatRgb(s.rgb)
        const rows: Array<[string, string | null | undefined]> = [
          ["HEX",  s.hex?.toUpperCase()],
          ["RGB",  rgb],
          ["CMYK", s.cmyk],
          ["PMS",  s.pms],
        ]

        return (
          <button
            key={s.id}
            onClick={() => copy(s)}
            className="bk-swatch-card"
            aria-label={`Copy ${s.name} ${s.hex.toUpperCase()}`}
            style={{
              background: "transparent",
              border: `0.5px solid ${HAIRLINE}`,
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
              display: "flex", flexDirection: "column",
              aspectRatio: "3 / 4",
              position: "relative",
              transition: "border-color 0.15s, transform 0.15s",
            }}
          >
            {/* Color block — 62.5% */}
            <div style={{
              background: s.hex,
              flex: "0 0 62.5%",
              position: "relative",
              padding: "20px 22px",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
              {s.tier && (
                <div style={{
                  ...mono, fontSize: 10, fontWeight: 500, letterSpacing: "0.2em",
                  textTransform: "uppercase", color: onBlockColor,
                }}>
                  {s.tier}
                </div>
              )}
              <div style={{
                ...serif, fontWeight: 300, fontSize: "clamp(30px, 3vw, 40px)",
                lineHeight: 1, color: onBlockColor,
                letterSpacing: "-0.005em",
              }}>
                {s.name || "Swatch"}
              </div>

              {copiedId === s.id && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  ...mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
                  color: onBlockColor, background: blockDark ? "rgba(28,25,22,0.35)" : "rgba(245,241,234,0.5)",
                  pointerEvents: "none",
                }}>
                  Copied
                </div>
              )}
            </div>

            {/* Plaster panel — 37.5% */}
            <div style={{
              background: panel,
              flex: "1 1 37.5%",
              padding: "16px 22px 18px",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              borderTop: `0.5px solid rgba(28,25,22,0.2)`,
              color: INK,
            }}>
              {rows.map(([label, value], i) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  paddingTop: i === 0 ? 0 : 8,
                  paddingBottom: 8,
                  borderBottom: i === rows.length - 1 ? "none" : "0.5px solid rgba(28,25,22,0.1)",
                  minHeight: 18,
                }}>
                  <span style={{
                    ...mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                    color: "rgba(28,25,22,0.6)",
                  }}>
                    {label}
                  </span>
                  <span style={{ ...mono, fontSize: 12, color: INK, textAlign: "right" }}>
                    {value || <span style={{ opacity: 0.3 }}>—</span>}
                  </span>
                </div>
              ))}
            </div>
          </button>
        )
      })}

      <style>{`
        .bk-swatch-card:hover { transform: translateY(-2px); border-color: rgba(28,25,22,0.3) !important; }
      `}</style>
    </div>
  )
}
