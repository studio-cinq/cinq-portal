"use client"

import { useState } from "react"
import type { ColorSwatch } from "@/types/database"

export default function ColorSwatches({ colors }: { colors: ColorSwatch[] }) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(hex: string) {
    navigator.clipboard.writeText(hex).catch(() => {})
    setCopied(hex)
    setTimeout(() => setCopied(null), 1400)
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(colors.length, 5)}, 1fr)`, gap: 8, marginBottom: 40 }}>
      {colors.map(c => (
        <div key={c.id} onClick={() => copy(c.hex)} style={{ cursor: "pointer" }}>
          <div style={{
            height: 56,
            background: c.hex,
            border: "0.5px solid rgba(15,15,14,0.08)",
            marginBottom: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: copied === c.hex ? 1 : 0,
              transition: "opacity 0.2s",
              fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.8)",
            }}>
              {copied === c.hex ? "Copied" : "Copy"}
            </div>
          </div>
          <div style={{ fontSize: 9, color: "var(--ink)", opacity: 0.6, marginBottom: 2 }}>{c.name}</div>
          <div style={{ fontSize: 9, color: "var(--ink)", opacity: 0.38, letterSpacing: "0.04em", fontFamily: "monospace" }}>{c.hex}</div>
        </div>
      ))}
    </div>
  )
}
