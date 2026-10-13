"use client"

import { useState } from "react"

/**
 * Copies the client's public statement URL (/statement/{clientId}) — the
 * page with the "pay full balance by card" button — to the clipboard.
 */
export default function CopyStatementLinkButton({ clientId }: { clientId: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    const url = `${window.location.origin}/statement/${clientId}`
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy the client's statement page link — one card checkout for every open invoice."
      style={{
        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
        color: copied ? "var(--complete)" : "var(--ink)", background: "transparent",
        border: `0.5px solid ${copied ? "var(--complete)" : "rgba(15,15,14,0.2)"}`,
        padding: "5px 9px", cursor: "pointer", opacity: 0.85, transition: "all 0.2s",
      }}
    >
      {copied ? "Link copied ✓" : "Copy pay link"}
    </button>
  )
}
