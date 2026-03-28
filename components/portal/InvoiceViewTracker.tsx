"use client"

import { useEffect } from "react"

export default function InvoiceViewTracker({ invoiceIds }: { invoiceIds: string[] }) {
  useEffect(() => {
    if (invoiceIds.length === 0) return
    fetch("/api/track-invoice-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceIds }),
    }).catch(() => {})
  }, [invoiceIds])

  return null
}
