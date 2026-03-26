"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

const mono: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
}

const serif: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "transparent",
  border: "none",
  borderBottom: "0.5px solid rgba(15,15,14,0.2)",
  padding: "10px 0",
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  color: "var(--ink)",
  outline: "none",
  letterSpacing: "-0.01em",
}

const labelStyle: React.CSSProperties = {
  ...mono,
  fontSize: "var(--text-eyebrow)" as any,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  opacity: 0.45,
  display: "block",
  marginBottom: 6,
}

export default function EditClientPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [saved, setSaved]     = useState(false)

  const [form, setForm] = useState({
    name:          "",
    contact_name:  "",
    contact_email: "",
    logo_url:      "",
    notes:         "",
  })

  useEffect(() => {
    supabase
      .from("clients")
      .select("*")
      .eq("id", params.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            name:          data.name ?? "",
            contact_name:  data.contact_name ?? "",
            contact_email: data.contact_email ?? "",
            logo_url:      data.logo_url ?? "",
            notes:         data.notes ?? "",
          })
        }
        setLoading(false)
      })
  }, [params.id])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleSubmit() {
    setError(null)
    if (!form.name.trim())          return setError("Client name is required.")
    if (!form.contact_name.trim())  return setError("Contact name is required.")
    if (!form.contact_email.trim()) return setError("Contact email is required.")

    setSaving(true)

    const res = await fetch("/api/admin/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id:            params.id,
        name:          form.name.trim(),
        contact_name:  form.contact_name.trim(),
        contact_email: form.contact_email.trim(),
        logo_url:      form.logo_url.trim() || null,
        notes:         form.notes.trim() || null,
      }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(json.error ?? "Something went wrong.")
      return
    }

    setSaved(true)
    setTimeout(() => {
      router.push(`/admin/clients/${params.id}`)
      router.refresh()
    }, 600)
  }

  if (loading) {
    return (
      <>
        <PortalNav isAdmin />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>Loading…</div>
        </div>
      </>
    )
  }

  return (
    <>
      <PortalNav isAdmin />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 48px 80px" }}>

        {/* Header */}
        <Link href={`/admin/clients/${params.id}`} style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.35, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Back to client
        </Link>
        <div style={{ marginBottom: 48 }}>
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 14 }}>
            Clients / Edit
          </div>
          <h1 style={{ ...serif, fontWeight: 400, fontSize: 26, opacity: 0.88, letterSpacing: "-0.015em", margin: 0 }}>
            Edit client
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
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
            <div style={{ ...mono, fontSize: 10, color: "var(--danger)", opacity: 0.8 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 20, paddingTop: 8 }}>
            <button
              onClick={handleSubmit}
              disabled={saving || saved}
              style={{
                ...mono,
                fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase",
                background: saved ? "var(--sage)" : "var(--ink)", color: "var(--cream)",
                border: "none", padding: "14px 28px",
                cursor: saving || saved ? "default" : "pointer",
                opacity: saving ? 0.4 : 1,
                transition: "all 0.3s",
              }}
            >
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save changes"}
            </button>

            <button
              onClick={() => router.push(`/admin/clients/${params.id}`)}
              style={{
                ...mono,
                fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
                background: "transparent", color: "var(--ink)",
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
