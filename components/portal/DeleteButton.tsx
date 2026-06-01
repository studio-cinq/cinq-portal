"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface DeleteButtonProps {
  endpoint: string
  id: string
  label?: string
  confirm?: string
  /** Where to navigate after a successful delete. Defaults to refreshing the current page. */
  redirectTo?: string
}

export default function DeleteButton({ endpoint, id, label = "Delete", confirm = "Are you sure? This cannot be undone.", redirectTo }: DeleteButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!window.confirm(confirm)) return
    setLoading(true)
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setLoading(false)
      if (res.ok) {
        if (redirectTo) {
          router.push(redirectTo)
        } else {
          router.refresh()
        }
      } else {
        alert("Something went wrong. Please try again.")
      }
    } catch {
      setLoading(false)
      alert("Network error. Please try again.")
    }
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete() }}
      disabled={loading}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase",
        background: "none", border: "none",
        color: "var(--danger)", opacity: loading ? 0.3 : 0.45,
        cursor: loading ? "default" : "pointer",
        padding: 0,
      }}
    >
      {loading ? "Deleting…" : label}
    </button>
  )
}