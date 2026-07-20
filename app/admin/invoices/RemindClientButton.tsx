"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Button on the invoices client-group header that fires ONE reminder email
 * covering every outstanding invoice for that client. Replaces the pattern
 * of clicking REMIND on each row in a client group (which sent N separate
 * emails within seconds of each other).
 */
export default function RemindClientButton({
  clientId, clientName, count,
}: {
  clientId: string
  clientName: string
  count: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleRemind() {
    if (busy || done) return
    const noun = count === 1 ? "invoice" : `invoices (${count})`
    if (!confirm(`Send one reminder to ${clientName} covering all outstanding ${noun}?`)) return

    setBusy(true)
    try {
      const res = await fetch("/api/admin/send-client-invoice-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed")
      setDone(true)
      setTimeout(() => {
        setDone(false)
        router.refresh()
      }, 1600)
    } catch (err: any) {
      console.error("[remind-client]", err)
      alert(err?.message ?? "Couldn't send the reminder.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleRemind}
      disabled={busy || done}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: done ? "var(--complete)" : "var(--ink)",
        background: "transparent",
        border: "0.5px solid rgba(15,15,14,0.2)",
        padding: "5px 9px",
        cursor: busy || done ? "default" : "pointer",
        opacity: busy ? 0.5 : 0.85,
      }}
    >
      {busy ? "Sending…" : done ? "Reminder sent ✓" : "Remind client"}
    </button>
  )
}
