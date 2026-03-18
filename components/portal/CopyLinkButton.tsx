"use client"

import { useState } from "react"

export default function CopyLinkButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(`https://portal.studiocinq.com/proposals/${id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
        color: copied ? "#6B8F71" : "#0F0F0E",
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
