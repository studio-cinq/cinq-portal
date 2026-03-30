"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"
import { Suspense } from "react"

interface LineItem {
  description: string
  amount: string
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
    due_date:       "",
    status:         "sent",
    unlocks_files:  false,
    notes:          "",
  })

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", amount: "" },
  ])

  const total = lineItems.reduce((sum, item) => {
    const val = parseFloat(item.amount)
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

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

  function updateLineItem(index: number, field: keyof LineItem, value: string) {
    setLineItems(items => items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function addLineItem() {
    setLineItems(items => [...items, { description: "", amount: "" }])
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return
    setLineItems(items => items.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setError(null)
    if (!form.client_id)             return setError("Please select a client.")
    if (!form.description.trim())    return setError("Invoice title is required.")
    if (!form.invoice_number.trim()) return setError("Invoice number is required.")

    const validItems = lineItems.filter(item => item.description.trim() && parseFloat(item.amount) > 0)
    if (validItems.length === 0)     return setError("Add at least one line item.")

    setSaving(true)

    const items = validItems.map(item => ({
      description: item.description.trim(),
      amount: Math.round(parseFloat(item.amount) * 100),
    }))
    const totalCents = items.reduce((sum, item) => sum + item.amount, 0)

    const { error: dbError } = await supabase.from("invoices").insert({
      client_id:      form.client_id,
      project_id:     form.project_id || null,
      invoice_number: form.invoice_number.trim(),
      description:    form.description.trim(),
      amount:         totalCents,
      line_items:     items,
      notes:          form.notes.trim() || null,
      due_date:       form.due_date || null,
      status:         form.status,
      unlocks_files:  form.unlocks_files,
    } as any)

    setSaving(false)

    if (dbError) { setError(dbError.message); return }

    if (form.status === "sent") {
      fetch("/api/admin/send-invoice-by-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: form.invoice_number.trim(),
          clientId: form.client_id,
        }),
      }).catch(err => console.error("[send-invoice]", err))
    }

    router.push("/admin/invoices")
    router.refresh()
  }

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 720, margin: "0 auto", padding: "48px 48px 80px" }}>

        <Link href="/admin/invoices" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Invoices
        </Link>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 14 }}>
            Invoices / New
          </div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 26, opacity: 0.88, letterSpacing: "-0.015em", margin: 0 }}>
            New invoice
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

          {/* Invoice number + Due date */}
          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Invoice number *</label>
              <input style={inputStyle} placeholder="SC-001" value={form.invoice_number} onChange={e => set("invoice_number", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Due date <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input style={inputStyle} type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
          </div>

          {/* Invoice title */}
          <div>
            <label style={labelStyle}>Invoice title *</label>
            <input style={inputStyle} placeholder="Brand Identity — Phase 1" value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          {/* Line items */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Line items *</label>
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
                gap: 16, alignItems: "end",
                padding: "12px 0",
                borderTop: i === 0 ? "0.5px solid rgba(15,15,14,0.1)" : "none",
                borderBottom: "0.5px solid rgba(15,15,14,0.1)",
              }}>
                <div>
                  {i === 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.35, marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>Description</div>}
                  <input
                    value={item.description}
                    onChange={e => updateLineItem(i, "description", e.target.value)}
                    placeholder="Logo design & brand mark"
                    style={{ ...inputStyle, borderBottom: "none", padding: "6px 0" }}
                  />
                </div>
                <div>
                  {i === 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.35, marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>Amount</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, opacity: 0.35 }}>$</span>
                    <input
                      type="number"
                      value={item.amount}
                      onChange={e => updateLineItem(i, "amount", e.target.value)}
                      placeholder="0"
                      style={{ ...inputStyle, borderBottom: "none", padding: "6px 0", textAlign: "right" }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeLineItem(i)}
                  disabled={lineItems.length <= 1}
                  aria-label="Remove line item"
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 11,
                    background: "none", border: "none", cursor: lineItems.length <= 1 ? "default" : "pointer",
                    color: "var(--ink)", opacity: lineItems.length <= 1 ? 0.15 : 0.35,
                    padding: "10px 6px", margin: "-4px",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Total */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              padding: "16px 0 0",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5 }}>
                Total
              </span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 22, letterSpacing: "-0.01em", opacity: 0.88 }}>
                ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes <span style={{ opacity: 0.5 }}>(optional — visible on PDF)</span></label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Payment terms, additional context, etc."
              rows={3}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.7 }}
            />
          </div>

          {/* Status + Unlocks */}
          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "end", paddingBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.unlocks_files} onChange={e => set("unlocks_files", e.target.checked)} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", opacity: 0.6 }}>
                  Payment unlocks brand library files
                </span>
              </label>
            </div>
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
              {saving ? "Saving…" : "Create invoice"}
            </button>
            <button onClick={() => router.push("/admin/invoices")} style={{
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

export default function NewInvoicePage() {
  return (
    <Suspense>
      <NewInvoicePageInner />
    </Suspense>
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
