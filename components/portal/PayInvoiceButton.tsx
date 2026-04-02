"use client"

import { useState } from "react"

export default function PayInvoiceButton({
  invoiceId,
  amount,
  label,
}: {
  invoiceId: string
  amount:    number
  label?:    string
}) {
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    setLoading(true)
    const res  = await fetch("/api/checkout", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ invoiceId }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    else setLoading(false)
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="portal-button-dark"
      style={{
        background: "var(--ink)", border: "none",
        padding: "11px 24px", fontFamily: "var(--font-mono)",
        fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
        color: "#EDE8E0", cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.4 : 1, whiteSpace: "nowrap",
      }}
    >
      {loading ? "Redirecting…" : label ?? `Pay $${(amount / 100).toLocaleString()}`}
    </button>
  )
}
