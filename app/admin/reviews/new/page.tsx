"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

export default function NewReviewPage() {
  const router = useRouter()

  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_id: "",
    project_id: "",
    site_url: "",
    notes: "",
  })

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => {
      setClients(data ?? [])
    })
  }, [])

  useEffect(() => {
    if (!form.client_id) { setProjects([]); return }
    supabase.from("projects").select("id, title")
      .eq("client_id", form.client_id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setProjects(data ?? []))
  }, [form.client_id])

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setError(null)
    if (!form.client_id) return setError("Please select a client.")
    if (!form.site_url.trim()) return setError("Site URL is required.")

    setSaving(true)

    const res = await fetch("/api/review/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: form.client_id,
        projectId: form.project_id || null,
        siteUrl: form.site_url.trim(),
        screenshotUrl: "",
        notes: form.notes.trim() || null,
      }),
    })

    const { session, error: apiError } = await res.json()
    setSaving(false)

    if (apiError) { setError(apiError); return }

    router.push(`/admin/reviews/${session.id}`)
    router.refresh()
  }

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 640, margin: "0 auto", padding: "48px 48px 80px" }}>

        <Link href="/admin/reviews" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Reviews
        </Link>

        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 14 }}>
            Reviews / New
          </div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 26, opacity: 0.88, letterSpacing: "-0.015em", margin: 0 }}>
            New website review
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

          {/* Client + Project */}
          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Client *</label>
              <select value={form.client_id} onChange={e => { set("client_id", e.target.value); set("project_id", "") }} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Project <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <select value={form.project_id} onChange={e => set("project_id", e.target.value)} disabled={!form.client_id} style={{ ...inputStyle, cursor: form.client_id ? "pointer" : "default", opacity: form.client_id ? 1 : 0.4 }}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>

          {/* Site URL */}
          <div>
            <label style={labelStyle}>Site URL *</label>
            <input
              style={inputStyle}
              placeholder="https://clientsite.com"
              value={form.site_url}
              onChange={e => set("site_url", e.target.value)}
            />
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.35, marginTop: 8, lineHeight: 1.6 }}>
              The client will browse this site live in an iframe and leave comments in a sidebar panel.
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes for client <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Any context or things to focus on during review…"
              rows={3}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.7 }}
            />
          </div>

          {error && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--danger)", opacity: 0.8 }}>{error}</div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, paddingTop: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase",
              background: "var(--ink)", color: "var(--cream)",
              border: "none", padding: "14px 28px",
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.4 : 1, transition: "opacity 0.2s",
            }}>
              {saving ? "Creating…" : "Create review"}
            </button>
            <button onClick={() => router.push("/admin/reviews")} style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
              background: "transparent", color: "var(--ink)",
              border: "none", padding: "14px 0",
              cursor: "pointer", opacity: 0.35,
            }}>
              Cancel
            </button>
          </div>
        </div>
      </main>
    </>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase",
  opacity: 0.45, display: "block", marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "transparent", border: "none",
  borderBottom: "0.5px solid rgba(15,15,14,0.2)",
  padding: "10px 0",
  fontFamily: "var(--font-sans)",
  fontSize: 15, color: "var(--ink)", outline: "none",
  letterSpacing: "-0.01em",
}
