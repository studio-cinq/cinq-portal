"use client"

import { useState } from "react"

export default function PayInvoiceButton({
  invoiceId,
  amount,
}: {
  invoiceId: string
  amount:    number
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
      style={{
        background: "#0F0F0E", border: "none",
        padding: "11px 24px", fontFamily: "'Jost', sans-serif",
        fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase",
        color: "#EDE8E0", cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.4 : 1, whiteSpace: "nowrap",
      }}
    >
      {loading ? "Redirecting…" : `Pay $${(amount / 100).toLocaleString()}`}
    </button>
  )
}
