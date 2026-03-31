"use client"

import { useState, useEffect, Suspense } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

const mono: React.CSSProperties = { fontFamily: "'Matter SemiMono', 'DM Mono', monospace" }
const serif: React.CSSProperties = { fontFamily: "'Söhne', 'Inter', system-ui, sans-serif" }

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "transparent",
  border: "none",
  borderBottom: "0.5px solid rgba(15,15,14,0.2)",
  padding: "10px 0",
  fontFamily: "'Söhne', 'Inter', system-ui, sans-serif",
  fontSize: 15, color: "#0F0F0E", outline: "none",
  letterSpacing: "-0.01em",
}

const labelStyle: React.CSSProperties = {
  ...mono,
  fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
  opacity: 0.45, display: "block", marginBottom: 6,
}

function NewProjectPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedClient = searchParams.get("client") ?? ""

  const [clients, setClients] = useState<any[]>([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [form, setForm] = useState({
    client_id:    preselectedClient,
    title:        "",
    scope:        "",
    status:       "active",
    start_date:   "",
    end_date:     "",
    total_weeks:  "",
    current_week: "1",
  })

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => {
      setClients(data ?? [])
    })
  }, [])

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setError(null)
    if (!form.client_id)    return setError("Please select a client.")
    if (!form.title.trim()) return setError("Project title is required.")

    setSaving(true)

    const { data, error } = await supabase.from("projects").insert({
      client_id:    form.client_id,
      title:        form.title.trim(),
      scope:        form.scope.trim() || null,
      status:       form.status,
      start_date:   form.start_date || null,
      end_date:     form.end_date || null,
      total_weeks:  form.total_weeks ? parseInt(form.total_weeks) : null,
      current_week: form.current_week ? parseInt(form.current_week) : 1,
    }).select().single()

    setSaving(false)

    if (error) { setError(error.message); return }

    // Go to the client workspace if we came from a client page
    if (preselectedClient) {
      router.push(`/admin/clients/${preselectedClient}`)
    } else {
      router.push("/admin/studio")
    }
    router.refresh()
  }

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 640, margin: "0 auto", padding: "48px 48px 80px" }}>

        <Link href="/admin/studio" style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Studio
        </Link>

        <div style={{ marginBottom: 48 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 14 }}>
            Projects / New
          </div>
          <h1 style={{ ...serif, fontWeight: 400, fontSize: 26, opacity: 0.88, letterSpacing: "-0.015em", margin: 0 }}>
            New project
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

          {/* Client */}
          <div>
            <label style={labelStyle}>Client *</label>
            <select
              value={form.client_id}
              onChange={e => set("client_id", e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Project title *</label>
            <input
              style={inputStyle}
              placeholder="Brand Identity & Launch"
              value={form.title}
              onChange={e => set("title", e.target.value)}
            />
          </div>

          {/* Scope */}
          <div>
            <label style={labelStyle}>Scope <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <textarea
              style={{ ...inputStyle, resize: "none", lineHeight: 1.7 }}
              placeholder="Brief description of the project scope…"
              rows={3}
              value={form.scope}
              onChange={e => set("scope", e.target.value)}
            />
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <select
              value={form.status}
              onChange={e => set("status", e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="proposal_sent">Proposal sent</option>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="complete">Complete</option>
            </select>
          </div>

          {/* Dates */}
          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Start date <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input
                style={inputStyle}
                type="date"
                value={form.start_date}
                onChange={e => set("start_date", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>End date <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input
                style={inputStyle}
                type="date"
                value={form.end_date}
                onChange={e => set("end_date", e.target.value)}
              />
            </div>
          </div>

          {/* Timeline */}
          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Total weeks <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input
                style={inputStyle}
                type="number"
                placeholder="8"
                value={form.total_weeks}
                onChange={e => set("total_weeks", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Current week</label>
              <input
                style={inputStyle}
                type="number"
                placeholder="1"
                value={form.current_week}
                onChange={e => set("current_week", e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div style={{ ...mono, fontSize: 10, color: "#c0392b", opacity: 0.8 }}>{error}</div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, paddingTop: 8 }}>
            <button
              onClick={handleSave}
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
              {saving ? "Saving…" : "Create project"}
            </button>
            <button
              onClick={() => router.back()}
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

export default function NewProjectPage() {
  return (
    <Suspense>
      <NewProjectPageInner />
    </Suspense>
  )
}