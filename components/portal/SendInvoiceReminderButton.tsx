"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  invoiceId: string
  /** Compact mode: smaller, used inline on the invoices list. */
  compact?: boolean
  /** Optional: how many reminders have already been sent (shows in the label) */
  remindersSent?: number
}

export default function SendInvoiceReminderButton({ invoiceId, compact = false, remindersSent = 0 }: Props) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSend() {
    if (sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/send-invoice-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      })
      if (res.ok) {
        setSent(true)
        setTimeout(() => setSent(false), 3000)
        router.refresh()
      } else {
        const payload = await res.json().catch(() => ({}))
        setError(payload.error ?? "Couldn't send reminder.")
      }
    } catch (err) {
      console.error("[invoice-reminder]", err)
      setError("Couldn't send reminder.")
    }
    setSending(false)
  }

  const label = sent
    ? "Reminder sent ✓"
    : sending
      ? "Sending…"
      : remindersSent > 0
        ? "Send another reminder"
        : "Send reminder"

  if (compact) {
    return (
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSend() }}
          disabled={sending || sent}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase",
            background: "none", border: "none",
            color: sent ? "var(--sage)" : "var(--ink)",
            opacity: sent ? 0.9 : sending ? 0.4 : 0.55,
            cursor: sending || sent ? "default" : "pointer",
            padding: 0,
          }}
        >
          {sent ? "Sent ✓" : sending ? "Sending…" : "Remind"}
        </button>
        {error && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--amber)", opacity: 0.85, maxWidth: 180 }}>
            {error}
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button
        onClick={handleSend}
        disabled={sending || sent}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
          color: "var(--ink)",
          textDecoration: "none",
          border: "0.5px solid rgba(15,15,14,0.2)",
          padding: "8px 14px",
          opacity: sent ? 0.85 : 0.6,
          background: sent ? "rgba(143,167,181,0.15)" : "transparent",
          cursor: sending || sent ? "default" : "pointer",
          transition: "all 0.2s",
        }}
      >
        {label}
      </button>
      {error && (
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--amber)", opacity: 0.85, lineHeight: 1.4, maxWidth: 320 }}>
          {error}
        </div>
      )}
    </div>
  )
}
