"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"
import { Suspense } from "react"

const mono: React.CSSProperties = { fontFamily: "'Matter SemiMono', 'DM Mono', monospace" }
const serif: React.CSSProperties = { fontFamily: "'PP Writer', 'Cormorant Garamond', Georgia, serif" }

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "transparent",
  border: "none",
  borderBottom: "0.5px solid rgba(15,15,14,0.2)",
  padding: "10px 0",
  fontFamily: "'PP Writer', Georgia, serif",
  fontSize: 15, color: "#0F0F0E", outline: "none",
  letterSpacing: "-0.01em",
}

const labelStyle: React.CSSProperties = {
  ...mono,
  fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase",
  opacity: 0.45, display: "block", marginBottom: 6,
}

function NewInvoicePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedClient = searchParams.get("client") ?? ""

  const [clients, setClients]   = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const [form, setForm] = useState({
    client_id:      preselectedClient,
    project_id:     "",
    invoice_number: "",
    description:    "",
    amount:         "",
    due_date:       "",
    status:         "sent",
    unlocks_files:  false,
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

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setError(null)
    if (!form.client_id)      return setError("Please select a client.")
    if (!form.description.trim()) return setError("Description is required.")
    if (!form.amount)         return setError("Amount is required.")
    if (!form.invoice_number.trim()) return setError("Invoice number is required.")

    setSaving(true)

    const { data, error } = await supabase.from("invoices").insert({
      client_id:      form.client_id,
      project_id:     form.project_id || null,
      invoice_number: form.invoice_number.trim(),
      description:    form.description.trim(),
      amount:         Math.round(parseFloat(form.amount) * 100),
      due_date:       form.due_date || null,
      status:         form.status,
      unlocks_files:  form.unlocks_files,
    })

    setSaving(false)

    if (error) { setError(error.message); return }

    // Fire invoice email if status is sent
    if (form.status === "sent" && data) {
      fetch("/api/admin/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: data.id }),
      }).catch(err => console.error("[send-invoice]", err))
    }
    
    router.push("/admin/invoices")
    router.refresh()
  }

  return (
    <>
      <PortalNav isAdmin />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 48px 80px" }}>

        {/* Header */}
        <Link href="/admin/invoices" style={{ ...mono, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Invoices
        </Link>
        <div style={{ marginBottom: 48 }}>
          <div style={{ ...mono, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 14 }}>
            Invoices / New
          </div>
          <h1 style={{ ...serif, fontWeight: 400, fontSize: 26, opacity: 0.88, letterSpacing: "-0.015em", margin: 0 }}>
            New invoice
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

          {/* Client + Project */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Client *</label>
              <select
                value={form.client_id}
                onChange={e => { set("client_id", e.target.value); set("project_id", "") }}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Project <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <select
                value={form.project_id}
                onChange={e => set("project_id", e.target.value)}
                disabled={!form.client_id}
                style={{ ...inputStyle, cursor: form.client_id ? "pointer" : "default", opacity: form.client_id ? 1 : 0.4 }}
              >
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>

          {/* Invoice number + Amount */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Invoice number *</label>
              <input
                style={inputStyle}
                placeholder="001"
                value={form.invoice_number}
                onChange={e => set("invoice_number", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Amount (USD) *</label>
              <input
                style={inputStyle}
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={e => set("amount", e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description *</label>
            <input
              style={inputStyle}
              placeholder="Brand Identity — 50% deposit"
              value={form.description}
              onChange={e => set("description", e.target.value)}
            />
          </div>

          {/* Due date + Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Due date <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input
                style={inputStyle}
                type="date"
                value={form.due_date}
                onChange={e => set("due_date", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status}
                onChange={e => set("status", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          {/* Unlocks files */}
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.unlocks_files}
                onChange={e => set("unlocks_files", e.target.checked)}
              />
              <span style={{ ...mono, fontSize: 9, letterSpacing: "0.08em", opacity: 0.6 }}>
                Payment unlocks brand library files for this client
              </span>
            </label>
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
              {saving ? "Saving…" : "Create invoice"}
            </button>
            <button
              onClick={() => router.push("/admin/invoices")}
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

export default function NewInvoicePage() {
  return (
    <Suspense>
      <NewInvoicePageInner />
    </Suspense>
  )
}