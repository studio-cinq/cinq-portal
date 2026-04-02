"use client"

import { useEffect, useRef } from "react"

export default function InvoiceViewTracker({ invoiceIds }: { invoiceIds: string[] }) {
  const tracked = useRef<string | null>(null)

  useEffect(() => {
    if (invoiceIds.length === 0) return
    // Prevent re-tracking the same set of IDs on every render
    const key = invoiceIds.slice().sort().join(",")
    if (tracked.current === key) return
    tracked.current = key

    fetch("/api/track-invoice-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceIds }),
    }).catch(() => {})
  }, [invoiceIds])

  return null
}
