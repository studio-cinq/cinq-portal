"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

export default function NewReviewPage() {
  const router = useRouter()
  const [clients, setClients]   = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

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
    supabase
      .from("projects")
      .select("id, title")
      .eq("client_id", form.client_id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setProjects(data ?? []))
  }, [form.client_id])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleCreate() {
    setError(null)
    if (!form.client_id) return setError("Please select a client.")
    if (!form.project_id) return setError("Please select a project.")
    if (!form.site_url.trim()) return setError("Please enter the website URL.")

    // Ensure URL has protocol
    let url = form.site_url.trim()
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
    }

    setSaving(true)
    try {
      const res = await fetch("/api/admin/create-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: form.project_id,
          clientId: form.client_id,
          siteUrl: url,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        router.push(`/admin/reviews/${data.id}`)
      } else {
        setError(data.error || "Something went wrong.")
        setSaving(false)
      }
    } catch {
      setError("Something went wrong.")
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-eyebrow)",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--ink)",
    opacity: 0.4,
    display: "block",
    marginBottom: 8,
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-body)",
    color: "var(--ink)",
    background: "rgba(255,255,255,0.35)",
    border: "0.5px solid rgba(15,15,14,0.12)",
    outline: "none",
    boxSizing: "border-box",
  }

  return (
    <>
      <PortalNav isAdmin />
      <main style={{ padding: "clamp(32px, 5vw, 48px)", maxWidth: 560 }}>
        {/* Header */}
        <Link href="/admin/reviews" style={{
          fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "var(--ink)", opacity: 0.4, textDecoration: "none",
          display: "block", marginBottom: 16,
        }}>← Reviews</Link>

        <h1 style={{
          fontFamily: "var(--font-serif)", fontSize: "var(--text-title)",
          fontWeight: 400, color: "var(--ink)", opacity: "var(--op-full)" as any,
          margin: "0 0 32px",
        }}>New Website Review</h1>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Client */}
          <div>
            <label style={labelStyle}>Client</label>
            <select
              value={form.client_id}
              onChange={e => { set("client_id", e.target.value); set("project_id", "") }}
              style={inputStyle}
            >
              <option value="">Select a client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Project */}
          <div>
            <label style={labelStyle}>Project</label>
            <select
              value={form.project_id}
              onChange={e => set("project_id", e.target.value)}
              style={inputStyle}
              disabled={!form.client_id}
            >
              <option value="">Select a project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          {/* Site URL */}
          <div>
            <label style={labelStyle}>Website URL</label>
            <input
              type="url"
              value={form.site_url}
              onChange={e => set("site_url", e.target.value)}
              placeholder="https://clientsite.com"
              style={inputStyle}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes for client (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Any context or instructions for the client…"
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-serif)" }}
            />
          </div>

          {/* Error */}
          {error && (
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
              color: "var(--danger)", margin: 0,
            }}>{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
              letterSpacing: "0.16em", textTransform: "uppercase",
              background: "var(--ink)", color: "#EDE8E0",
              padding: "14px 24px", border: "none", cursor: "pointer",
              opacity: saving ? 0.4 : 1, transition: "opacity 0.2s",
              alignSelf: "flex-start",
            }}
          >
            {saving ? "Creating…" : "Create & send invite"}
          </button>
        </div>
      </main>
    </>
  )
}
