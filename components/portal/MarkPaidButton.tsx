"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

interface MarkPaidButtonProps {
  invoiceId: string
  invoiceNumber: string
  onMarked?: () => void  // for client-side state updates (client workspace)
}

export default function MarkPaidButton({ invoiceId, invoiceNumber, onMarked }: MarkPaidButtonProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [done, setDone]             = useState(false)

  async function handleMark() {
    setSaving(true)
    await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      } as any)
      .eq("id", invoiceId)

    setSaving(false)
    setDone(true)
    setConfirming(false)

    if (onMarked) {
      onMarked()
    } else {
      setTimeout(() => {
        router.refresh()
      }, 500)
    }
  }

  if (done) {
    return (
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-eyebrow)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--sage)",
        opacity: 0.8,
      }}>
        Paid ✓
      </span>
    )
  }

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={handleMark}
          disabled={saving}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "var(--sage)",
            color: "var(--cream)",
            border: "none",
            padding: "4px 10px",
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.5 : 1,
          }}
          title={`Mark invoice #${invoiceNumber} as paid`}
        >
          {saving ? "…" : "Yes"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "none",
            color: "var(--ink)",
            border: "none",
            padding: "4px 6px",
            cursor: "pointer",
            opacity: 0.35,
          }}
        >
          No
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true) }}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-eyebrow)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        background: "none",
        color: "var(--sage)",
        border: "0.5px solid rgba(107,143,113,0.3)",
        padding: "4px 10px",
        cursor: "pointer",
        opacity: 0.7,
      }}
      title={`Mark invoice #${invoiceNumber} as paid`}
    >
      Mark paid
    </button>
  )
}
