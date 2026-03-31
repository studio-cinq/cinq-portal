"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const serif: React.CSSProperties = { fontFamily: "var(--font-sans)" }

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "transparent",
  border: "none",
  borderBottom: "0.5px solid rgba(15,15,14,0.2)",
  padding: "10px 0",
  fontFamily: "var(--font-sans)",
  fontSize: 15, color: "var(--ink)", outline: "none",
  letterSpacing: "-0.01em",
}

const labelStyle: React.CSSProperties = {
  ...mono,
  fontSize: "var(--text-eyebrow)" as any, letterSpacing: "0.16em", textTransform: "uppercase",
  opacity: 0.45, display: "block", marginBottom: 6,
}

export default function EditInvoicePage({ params }: { params: { id: string } }) {
  const router = useRouter()

  const [loading, setLoading]     = useState(true)
  const [clients, setClients]     = useState<any[]>([])
  const [projects, setProjects]   = useState<any[]>([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [saved, setSaved]         = useState(false)
  const [originalStatus, setOriginalStatus] = useState("")

  const [form, setForm] = useState({
    client_id:      "",
    project_id:     "",
    invoice_number: "",
    description:    "",
    amount:         "",
    due_date:       "",
    status:         "draft",
    unlocks_files:  false,
    notes:          "",
    payment_methods: ["stripe"] as string[],
  })

  const [lineItems, setLineItems] = useState<{ description: string; amount: string }[]>([
    { description: "", amount: "" },
  ])

  const total = lineItems.reduce((sum, item) => {
    const val = parseFloat(item.amount)
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

  useEffect(() => {
    Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("invoices").select("*").eq("id", params.id).single(),
    ]).then(([clientsRes, invoiceRes]) => {
      setClients(clientsRes.data ?? [])

      if (invoiceRes.data) {
        const inv = invoiceRes.data as any
        setOriginalStatus(inv.status)
        setForm({
          client_id:      inv.client_id ?? "",
          project_id:     inv.project_id ?? "",
          invoice_number: inv.invoice_number ?? "",
          description:    inv.description ?? "",
          amount:         inv.amount ? String(inv.amount / 100) : "",
          due_date:       inv.due_date ?? "",
          status:         inv.status ?? "draft",
          unlocks_files:  inv.unlocks_files ?? false,
          notes:          inv.notes ?? "",
          payment_methods: inv.payment_methods ?? ["stripe"],
        })

        // Load line items from DB
        if (Array.isArray(inv.line_items) && inv.line_items.length > 0) {
          setLineItems(inv.line_items.map((item: any) => ({
            description: item.description ?? "",
            amount: item.amount ? String(item.amount / 100) : "",
          })))
        }

        // Load projects for this client
        if (inv.client_id) {
          supabase
            .from("projects")
            .select("id, title")
            .eq("client_id", inv.client_id)
            .order("created_at", { ascending: false })
            .then(({ data }) => setProjects(data ?? []))
        }
      }
      setLoading(false)
    })
  }, [params.id])

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
    setSaved(false)
  }

  function updateLineItem(index: number, field: string, value: string) {
    setLineItems(items => items.map((item, i) => i === index ? { ...item, [field]: value } : item))
    setSaved(false)
  }

  function addLineItem() {
    setLineItems(items => [...items, { description: "", amount: "" }])
    setSaved(false)
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return
    setLineItems(items => items.filter((_, i) => i !== index))
    setSaved(false)
  }

  async function handleSave() {
    setError(null)
    if (!form.client_id)             return setError("Please select a client.")
    if (!form.description.trim())    return setError("Invoice title is required.")
    if (!form.invoice_number.trim()) return setError("Invoice number is required.")

    const validItems = lineItems.filter(item => item.description.trim() && parseFloat(item.amount) > 0)

    setSaving(true)

    const items = validItems.map(item => ({
      description: item.description.trim(),
      amount: Math.round(parseFloat(item.amount) * 100),
    }))
    const totalCents = items.length > 0
      ? items.reduce((sum, item) => sum + item.amount, 0)
      : Math.round(parseFloat(form.amount || "0") * 100)

    const updatePayload: any = {
      client_id:      form.client_id,
      project_id:     form.project_id || null,
      invoice_number: form.invoice_number.trim(),
      description:    form.description.trim(),
      amount:         totalCents,
      line_items:     items.length > 0 ? items : [],
      notes:          form.notes.trim() || null,
      due_date:       form.due_date || null,
      status:         form.status,
      unlocks_files:  form.unlocks_files,
      payment_methods: form.payment_methods,
    }

    // If marking as paid, set paid_at
    if (form.status === "paid" && originalStatus !== "paid") {
      updatePayload.paid_at = new Date().toISOString()
    }
    // If un-paying, clear paid_at
    if (form.status !== "paid" && originalStatus === "paid") {
      updatePayload.paid_at = null
    }

    const { error } = await supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", params.id)

    setSaving(false)

    if (error) { setError(error.message); return }

    // Re-send invoice email if status changed to "sent"
    if (form.status === "sent" && originalStatus !== "sent") {
      fetch("/api/admin/send-invoice-by-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: form.invoice_number.trim(),
          clientId: form.client_id,
        }),
      }).catch(err => console.error("[resend-invoice]", err))
    }

    setSaved(true)
    setOriginalStatus(form.status)
    setTimeout(() => {
      router.push("/admin/invoices")
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

  const statusChanged = form.status !== originalStatus
  const willResend    = form.status === "sent" && originalStatus !== "sent"

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 640, margin: "0 auto", padding: "48px 48px 80px" }}>

        {/* Header */}
        <Link href="/admin/invoices" style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Invoices
        </Link>
        <div style={{ marginBottom: 48 }}>
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 14 }}>
            Invoices / Edit
          </div>
          <h1 style={{ ...serif, fontWeight: 400, fontSize: 26, opacity: 0.88, letterSpacing: "-0.015em", margin: 0 }}>
            Edit invoice #{form.invoice_number || "—"}
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

          {/* Client + Project */}
          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
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
          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Invoice number *</label>
              <input
                style={inputStyle}
                placeholder="SC-001"
                value={form.invoice_number}
                onChange={e => set("invoice_number", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Due date <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input style={inputStyle} type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
          </div>

          {/* Invoice title */}
          <div>
            <label style={labelStyle}>Invoice title *</label>
            <input
              style={inputStyle}
              placeholder="Brand Identity — Phase 1"
              value={form.description}
              onChange={e => set("description", e.target.value)}
            />
          </div>

          {/* Line items */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Line items</label>
              <button onClick={addLineItem} style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                letterSpacing: "0.12em", textTransform: "uppercase",
                opacity: 0.5, background: "none",
                border: "0.5px solid rgba(15,15,14,0.2)", padding: "5px 12px",
                cursor: "pointer", color: "var(--ink)",
              }}>
                + Add item
              </button>
            </div>
            {lineItems.map((item, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 140px 24px",
                gap: 16, alignItems: "end", padding: "12px 0",
                borderTop: i === 0 ? "0.5px solid rgba(15,15,14,0.1)" : "none",
                borderBottom: "0.5px solid rgba(15,15,14,0.1)",
              }}>
                <div>
                  {i === 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.35, marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>Description</div>}
                  <input value={item.description} onChange={e => updateLineItem(i, "description", e.target.value)} placeholder="Logo design" style={{ ...inputStyle, borderBottom: "none", padding: "6px 0" }} />
                </div>
                <div>
                  {i === 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.35, marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>Amount</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, opacity: 0.35 }}>$</span>
                    <input type="number" value={item.amount} onChange={e => updateLineItem(i, "amount", e.target.value)} placeholder="0" style={{ ...inputStyle, borderBottom: "none", padding: "6px 0", textAlign: "right" }} />
                  </div>
                </div>
                <button onClick={() => removeLineItem(i)} disabled={lineItems.length <= 1} style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, background: "none", border: "none",
                  cursor: lineItems.length <= 1 ? "default" : "pointer",
                  color: "var(--ink)", opacity: lineItems.length <= 1 ? 0.15 : 0.35, padding: "6px 0", marginBottom: 2,
                }}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "16px 0 0" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5 }}>Total</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 22, letterSpacing: "-0.01em", opacity: 0.88 }}>${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes <span style={{ opacity: 0.5 }}>(optional — visible on PDF)</span></label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Payment terms, additional context, etc." rows={3} style={{ ...inputStyle, resize: "none", lineHeight: 1.7 }} />
          </div>

          {/* Payment methods */}
          <div>
            <label style={labelStyle}>Payment methods</label>
            <div style={{ display: "flex", gap: 20, paddingTop: 4 }}>
              {([
                { value: "stripe", label: "Stripe (card checkout)" },
                { value: "ach",    label: "ACH bank transfer" },
              ] as const).map(opt => (
                <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.payment_methods.includes(opt.value)}
                    onChange={e => {
                      set("payment_methods",
                        e.target.checked
                          ? [...form.payment_methods, opt.value]
                          : form.payment_methods.filter((m: string) => m !== opt.value)
                      )
                    }}
                  />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", opacity: 0.6 }}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
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
            <div style={{ display: "flex", alignItems: "end", paddingBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.unlocks_files} onChange={e => set("unlocks_files", e.target.checked)} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", opacity: 0.6 }}>Payment unlocks brand library files</span>
              </label>
            </div>
          </div>

          {/* Resend notice */}
          {willResend && (
            <div style={{
              ...mono,
              fontSize: 10, letterSpacing: "0.08em",
              color: "var(--sage)", opacity: 0.8,
              background: "rgba(143,167,181,0.08)",
              border: "0.5px solid rgba(143,167,181,0.2)",
              padding: "10px 14px",
            }}>
              Invoice email will be re-sent to the client when you save.
            </div>
          )}

          {error && (
            <div style={{ ...mono, fontSize: 10, color: "var(--danger)", opacity: 0.8 }}>{error}</div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, paddingTop: 8 }}>
            <button
              onClick={handleSave}
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
              onClick={() => router.push("/admin/invoices")}
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
