"use client"

import { useState } from "react"

export default function DownloadAllButton({ assets }: { assets: { file_url: string; name: string }[] }) {
  const [opening, setOpening] = useState(false)

  async function handleDownloadAll() {
    setOpening(true)
    try {
      for (const asset of assets) {
        const a = document.createElement("a")
        a.href = asset.file_url
        a.download = asset.name || "download"
        a.target = "_blank"
        a.rel = "noopener"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        await new Promise(r => setTimeout(r, 300))
      }
    } finally {
      setOpening(false)
    }
  }

  return (
    <button
      onClick={handleDownloadAll}
      disabled={opening}
      className="portal-button-dark"
      style={{
        fontFamily: "var(--font-mono)",
        display: "flex", alignItems: "center", gap: 8,
        fontSize: "var(--text-eyebrow)",
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: "rgba(237,232,224,0.55)",
        border: "0.5px solid rgba(237,232,224,0.25)",
        padding: "10px 18px", cursor: opening ? "default" : "pointer",
        background: "none",
        opacity: opening ? 0.6 : 1,
      }}
    >
      {opening ? "Opening file links…" : `Open ${assets.length} file link${assets.length === 1 ? "" : "s"}`}
    </button>
  )
}
