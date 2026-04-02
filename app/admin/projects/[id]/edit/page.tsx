"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, useParams } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState("")
  const [contacts, setContacts] = useState<any[]>([])

  const [form, setForm] = useState({
    title: "",
    scope: "",
    contact_id: "",
    status: "active",
    start_date: "",
    end_date: "",
    total_weeks: "",
    current_week: "1",
  })

  useEffect(() => {
    supabase.from("projects").select("*").eq("id", params.id).single().then(({ data }) => {
      if (data) {
        setClientId(data.client_id)
        setForm({
          title: data.title ?? "",
          scope: data.scope ?? "",
          contact_id: data.contact_id ?? "",
          status: data.status ?? "active",
          start_date: data.start_date ?? "",
          end_date: data.end_date ?? "",
          total_weeks: data.total_weeks ? String(data.total_weeks) : "",
          current_week: data.current_week ? String(data.current_week) : "1",
        })
        // Load contacts for this client
        fetch(`/api/admin/contacts?client_id=${data.client_id}`)
          .then(res => res.json())
          .then(json => setContacts(json.contacts ?? []))
          .catch(() => {})
      }
      setLoading(false)
    })
  }, [params.id])

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setError(null)
    if (!form.title.trim()) return setError("Project title is required.")
    setSaving(true)

    const { error: updateErr } = await supabase.from("projects").update({
      title: form.title.trim(),
      scope: form.scope.trim() || null,
      contact_id: form.contact_id || null,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      total_weeks: form.total_weeks ? parseInt(form.total_weeks) : null,
      current_week: form.current_week ? parseInt(form.current_week) : 1,
    }).eq("id", params.id)

    setSaving(false)
    if (updateErr) { setError(updateErr.message); return }

    if (clientId) {
      router.push(`/admin/clients/${clientId}`)
    } else {
      router.push("/admin/studio")
    }
    router.refresh()
  }

  if (loading) return (
    <>
      <PortalNav isAdmin />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>Loading…</div>
      </div>
    </>
  )

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 640, margin: "0 auto", padding: "48px 48px 80px" }}>

        <Link href={clientId ? `/admin/clients/${clientId}` : "/admin/studio"} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Back
        </Link>

        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 14 }}>
            Projects / Edit
          </div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 26, opacity: 0.88, letterSpacing: "-0.015em", margin: 0 }}>
            {form.title || "Edit project"}
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

          <div>
            <label style={labelStyle}>Project title *</label>
            <input style={inputStyle} placeholder="Brand Identity & Launch" value={form.title} onChange={e => set("title", e.target.value)} />
          </div>

          {/* Contact assignment */}
          {contacts.length > 0 && (
            <div>
              <label style={labelStyle}>Assign to contact <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <select
                value={form.contact_id}
                onChange={e => set("contact_id", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">All contacts (shared project)</option>
                {contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ""}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Scope <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <textarea style={{ ...inputStyle, resize: "none", lineHeight: 1.7 }} placeholder="Brief description…" rows={3} value={form.scope} onChange={e => set("scope", e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="proposal_sent">Proposal sent</option>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="complete">Complete</option>
            </select>
          </div>

          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Start date <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input style={inputStyle} type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>End date <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input style={inputStyle} type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>

          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Total weeks <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input style={inputStyle} type="number" placeholder="8" value={form.total_weeks} onChange={e => set("total_weeks", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Current week</label>
              <input style={inputStyle} type="number" placeholder="1" value={form.current_week} onChange={e => set("current_week", e.target.value)} />
            </div>
          </div>

          {error && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--danger)", opacity: 0.8 }}>{error}</div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 20, paddingTop: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase",
              background: "var(--ink)", color: "var(--cream)",
              border: "none", padding: "14px 28px",
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.4 : 1,
            }}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button onClick={() => router.back()} style={{
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
