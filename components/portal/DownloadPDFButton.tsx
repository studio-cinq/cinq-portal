"use client"

import { useState } from "react"

interface DownloadPDFButtonProps {
  type: "proposal" | "invoice"
  id: string
  label?: string
}

export default function DownloadPDFButton({ type, id, label }: DownloadPDFButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    try {
      const res = await fetch(`/api/pdf/${type}/${id}`)
      if (!res.ok) throw new Error("Failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ?? `${type}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("[download-pdf]", err)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-eyebrow)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        background: "none",
        border: "0.5px solid rgba(15,15,14,0.2)",
        padding: "7px 14px",
        cursor: loading ? "default" : "pointer",
        color: "var(--ink)",
        opacity: loading ? 0.3 : 0.55,
        transition: "opacity 0.2s",
        whiteSpace: "nowrap",
      }}
    >
      {loading ? "Generating…" : label ?? "↓ PDF"}
    </button>
  )
}
