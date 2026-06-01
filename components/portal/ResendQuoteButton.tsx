"use client"

import { useState } from "react"

export default function ResendQuoteButton({ quoteId }: { quoteId: string }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/send-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId }),
      })
      if (res.ok) {
        setSent(true)
        setTimeout(() => setSent(false), 3000)
      } else {
        const payload = await res.json().catch(() => ({}))
        setError(payload.error ?? "Unable to send email.")
      }
    } catch (err) {
      console.error("[resend-quote]", err)
      setError("Unable to send email.")
    }
    setSending(false)
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button
        onClick={handleResend}
        disabled={sending || sent}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-eyebrow)",
          letterSpacing: "0.12em",
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
        {sent ? "Sent!" : sending ? "Sending…" : "Send email"}
      </button>
      {error && (
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--amber)", opacity: 0.85, lineHeight: 1.4, maxWidth: 320 }}>
          {error}
        </div>
      )}
    </div>
  )
}
