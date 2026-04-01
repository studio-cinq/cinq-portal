"use client"

import { useState } from "react"

export default function ResendProposalButton({ proposalId }: { proposalId: string }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleResend() {
    setSending(true)
    try {
      const res = await fetch("/api/admin/send-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId }),
      })
      if (res.ok) {
        setSent(true)
        setTimeout(() => setSent(false), 3000)
      }
    } catch (err) {
      console.error("[resend-proposal]", err)
    }
    setSending(false)
  }

  return (
    <button
      onClick={handleResend}
      disabled={sending || sent}
      style={{
        fontFamily: "'Matter SemiMono', monospace",
        fontSize: 9,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "#0F0F0E",
        textDecoration: "none",
        border: "0.5px solid rgba(15,15,14,0.2)",
        padding: "8px 14px",
        opacity: sent ? 0.8 : 0.6,
        background: sent ? "rgba(143,167,181,0.15)" : "transparent",
        cursor: sending ? "default" : "pointer",
        transition: "all 0.2s",
      }}
    >
      {sent ? "Sent!" : sending ? "Sending..." : "Resend email"}
    </button>
  )
}
