"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface DeleteButtonProps {
  endpoint: string
  id: string
  label?: string
  confirm?: string
}

export default function DeleteButton({ endpoint, id, label = "Delete", confirm = "Are you sure? This cannot be undone." }: DeleteButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!window.confirm(confirm)) return
    setLoading(true)
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      alert("Something went wrong. Please try again.")
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      style={{
        fontFamily: "'Matter SemiMono', monospace",
        fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
        background: "none", border: "none",
        color: "#c0392b", opacity: loading ? 0.3 : 0.45,
        cursor: loading ? "default" : "pointer",
        padding: 0,
      }}
    >
      {loading ? "Deleting…" : label}
    </button>
  )
}