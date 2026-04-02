"use client"

import { useState } from "react"

export default function ResendProposalButton({ proposalId }: { proposalId: string }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/send-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId }),
      })
      if (res.ok) {
        setSent(true)
        setTimeout(() => setSent(false), 3000)
      } else {
        const payload = await res.json().catch(() => ({}))
        setError(payload.error ?? "Unable to resend email.")
      }
    } catch (err) {
      console.error("[resend-proposal]", err)
      setError("Unable to resend email.")
    }
    setSending(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={handleResend}
        disabled={sending || sent}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-eyebrow)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink)",
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
      {error && (
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-sm)",
          color: "var(--amber)",
          opacity: 0.85,
          lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
