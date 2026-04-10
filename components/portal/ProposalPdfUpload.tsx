"use client"

import { useState, useRef } from "react"

interface Props {
  proposalId: string
  initialUrl?: string | null
}

export default function ProposalPdfUpload({ proposalId, initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl || "")
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("proposalId", proposalId)
      const res = await fetch("/api/admin/proposal-pdf", { method: "POST", body: form })
      if (!res.ok) throw new Error("Upload failed")
      const { url: newUrl } = await res.json()
      setUrl(newUrl)
    } catch (err) {
      console.error("[proposal-pdf-upload]", err)
    }
    setUploading(false)
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await fetch("/api/admin/proposal-pdf", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId }),
      })
      setUrl("")
    } catch (err) {
      console.error("[proposal-pdf-remove]", err)
    }
    setRemoving(false)
  }

  const mono: React.CSSProperties = {
    fontFamily: "'Matter SemiMono', monospace",
    fontSize: 9,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  }

  const btnStyle: React.CSSProperties = {
    ...mono,
    color: "#0F0F0E",
    background: "none",
    border: "0.5px solid rgba(15,15,14,0.2)",
    padding: "8px 14px",
    cursor: "pointer",
    opacity: 0.6,
  }

  if (url) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ ...mono, opacity: 0.5, color: "var(--sage)", letterSpacing: "0.1em" }}>
          Custom PDF uploaded
        </div>
        <button onClick={handleRemove} disabled={removing} style={{ ...btnStyle, opacity: removing ? 0.3 : 0.5 }}>
          {removing ? "Removing…" : "Remove"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
          }}
        />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...btnStyle, opacity: uploading ? 0.3 : 0.6 }}>
          {uploading ? "Replacing…" : "Replace"}
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        style={{ display: "none" }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleUpload(f)
        }}
      />
      <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...btnStyle, opacity: uploading ? 0.3 : 0.6 }}>
        {uploading ? "Uploading…" : "↑ Upload PDF"}
      </button>
    </div>
  )
}
