"use client"

import { useState } from "react"

export default function CopyLinkButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const base = typeof window !== "undefined" ? window.location.origin : "https://portal.studiocinq.com"
    try {
      await navigator.clipboard.writeText(`${base}/proposals/${id}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available (e.g. non-secure context)
    }
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
        color: copied ? "#8fa7b5" : "#0F0F0E",
        opacity: copied ? 0.8 : 0.4,
        background: "none", border: "0.5px solid rgba(15,15,14,0.15)",
        padding: "5px 10px", cursor: "pointer",
        fontFamily: "inherit", transition: "all 0.2s",
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  )
}
