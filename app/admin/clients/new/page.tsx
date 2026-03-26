"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import PortalNav from "@/components/portal/Nav"

const mono: React.CSSProperties = {
  fontFamily: "'Matter SemiMono', 'DM Mono', monospace",
}

const serif: React.CSSProperties = {
  fontFamily: "'Söhne', 'Inter', system-ui, sans-serif",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "transparent",
  border: "none",
  borderBottom: "0.5px solid rgba(15,15,14,0.2)",
  padding: "10px 0",
  fontFamily: "'Söhne', 'Inter', system-ui, sans-serif",
  fontSize: 15,
  color: "#0F0F0E",
  outline: "none",
  letterSpacing: "-0.01em",
}

const labelStyle: React.CSSProperties = {
  ...mono,
  fontSize: 8,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  opacity: 0.45,
  display: "block",
  marginBottom: 6,
}

export default function NewClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    name:          "",
    contact_name:  "",
    contact_email: "",
    logo_url:      "",
    notes:         "",
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit() {
    setError(null)
    if (!form.name.trim())          return setError("Client name is required.")
    if (!form.contact_name.trim())  return setError("Contact name is required.")
    if (!form.contact_email.trim()) return setError("Contact email is required.")

    setSaving(true)

    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:          form.name.trim(),
        contact_name:  form.contact_name.trim(),
        contact_email: form.contact_email.trim(),
        logo_url:      form.logo_url.trim() || null,
        notes:         form.notes.trim() || null,
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? "Something went wrong.")
      setSaving(false)
      return
    }

    router.push("/admin/clients")
    router.refresh()
  }

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 640, margin: "0 auto", padding: "48px 48px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ ...mono, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 14 }}>
            Clients / New
          </div>
          <h1 style={{ ...serif, fontWeight: 400, fontSize: 26, opacity: 0.88, letterSpacing: "-0.015em", margin: 0 }}>
            New client
          </h1>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

          <div>
            <label style={labelStyle}>Client / studio name *</label>
            <input
              style={inputStyle}
              placeholder="Acme Studio"
              value={form.name}
              onChange={e => set("name", e.target.value)}
            />
          </div>

          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Contact name *</label>
              <input
                style={inputStyle}
                placeholder="Jane Smith"
                value={form.contact_name}
                onChange={e => set("contact_name", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Contact email *</label>
              <input
                style={inputStyle}
                type="email"
                placeholder="jane@acme.com"
                value={form.contact_email}
                onChange={e => set("contact_email", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Logo URL <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <input
              style={inputStyle}
              placeholder="https://..."
              value={form.logo_url}
              onChange={e => set("logo_url", e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Notes <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <textarea
              style={{
                ...inputStyle,
                borderBottom: "0.5px solid rgba(15,15,14,0.2)",
                resize: "none",
                lineHeight: 1.7,
              }}
              placeholder="Anything useful to remember about this client…"
              rows={4}
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
            />
          </div>

          {error && (
            <div style={{ ...mono, fontSize: 10, color: "#c0392b", opacity: 0.8 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 20, paddingTop: 8 }}>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                ...mono,
                fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
                background: "#0F0F0E", color: "#F4F1EC",
                border: "none", padding: "14px 28px",
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.4 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {saving ? "Saving…" : "Create client"}
            </button>

            <button
              onClick={() => router.push("/admin/clients")}
              style={{
                ...mono,
                fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                background: "transparent", color: "#0F0F0E",
                border: "none", padding: "14px 0",
                cursor: "pointer", opacity: 0.35,
              }}
            >
              Cancel
            </button>
          </div>

        </div>
      </main>
    </>
  )
}