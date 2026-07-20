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
  const prefillTitle      = searchParams.get("title") ?? ""
  const prefillAmount     = searchParams.get("amount") ?? ""   // dollar amount, e.g. "1500.00"
  const prefillLineLabel  = searchParams.get("line") ?? ""     // line item description

  const [clients, setClients]   = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Inline "+ New project" — when active, project_id stays empty and we
  // create a project on submit using newProjectTitle.
  const [newProjectMode, setNewProjectMode]   = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState("")

  const [form, setForm] = useState({
    client_id:      preselectedClient,
    project_id:     "",
    invoice_number: "",
    description:    prefillTitle,
    due_date:       "",
    status:         "sent",
    unlocks_files:  false,
    notes:          "",
    payment_alert:  "",
    payment_methods: ["stripe"] as string[],
    cc_emails: "",
    skip_email:     false,
  })

  const [lineItems, setLineItems] = useState<LineItem[]>(
    prefillAmount
      ? [{ description: prefillLineLabel || prefillTitle || "", amount: prefillAmount }]
      : [{ description: "", amount: "" }]
  )

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

  // Auto-fill CC recipients from the client's default list. Never overwrites
  // something already typed — only fills the blank.
  useEffect(() => {
    if (!form.client_id) return
    supabase
      .from("clients")
      .select("cc_emails")
      .eq("id", form.client_id)
      .single()
      .then(({ data }) => {
        const list = ((data as any)?.cc_emails ?? []) as string[]
        if (list.length === 0) return
        setForm(f => f.cc_emails.trim() ? f : { ...f, cc_emails: list.join(", ") })
      })
  }, [form.client_id])

  // Suggest the next invoice number based on the client's most recent one.
  // Finds the last run of digits at the tail (e.g. "NEU-2602", "4W-26001",
  // "SC-001") and increments it, preserving zero-padding width. Only fills
  // if the field is still empty — never overwrites something typed.
  useEffect(() => {
    if (!form.client_id) return
    supabase
      .from("invoices")
      .select("invoice_number")
      .eq("client_id", form.client_id)
      .not("invoice_number", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const last = (data ?? [])[0]?.invoice_number as string | undefined
        if (!last) return
        const match = last.match(/^(.*?)(\d+)$/)
        if (!match) return
        const [, prefix, num] = match
        const next = String(parseInt(num, 10) + 1).padStart(num.length, "0")
        setForm(f => f.invoice_number ? f : { ...f, invoice_number: prefix + next })
      })
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
    if (form.payment_methods.length === 0) return setError("Select at least one payment method.")

    setSaving(true)

    const items = validItems.map(item => ({
      description: item.description.trim(),
      amount: Math.round(parseFloat(item.amount) * 100),
    }))
    const totalCents = items.reduce((sum, item) => sum + item.amount, 0)

    // Inline "+ New project" — spin up a lightweight project first so the
    // invoice can carry a project_id. Silently skips if the input is empty.
    let projectIdForInvoice: string | null = form.project_id || null
    if (newProjectMode && newProjectTitle.trim()) {
      const clientName = clients.find(c => c.id === form.client_id)?.name ?? "project"
      const baseSlug = `${clientName} ${newProjectTitle}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      const { data: takenRows } = await supabase.from("projects").select("slug").ilike("slug", `${baseSlug}%`)
      const taken = new Set(((takenRows ?? []) as any[]).map(r => r.slug).filter(Boolean))
      let slug = baseSlug
      let n = 2
      while (taken.has(slug)) { slug = `${baseSlug}-${n}`; n++ }

      const { data: newProject, error: projectErr } = await supabase.from("projects").insert({
        client_id: form.client_id,
        title:     newProjectTitle.trim(),
        status:    "active",
        slug,
      } as any).select("id").single()

      if (projectErr || !newProject) {
        setSaving(false)
        setError(`Couldn't create project — ${projectErr?.message ?? "unknown error"}`)
        return
      }
      projectIdForInvoice = (newProject as any).id
    }

    const { error: dbError } = await supabase.from("invoices").insert({
      client_id:      form.client_id,
      project_id:     projectIdForInvoice,
      invoice_number: form.invoice_number.trim(),
      description:    form.description.trim(),
      amount:         totalCents,
      line_items:     items,
      notes:          form.notes.trim() || null,
      payment_alert:  form.payment_alert.trim() || null,
      due_date:       form.due_date || null,
      status:         form.status,
      unlocks_files:  form.unlocks_files,
      payment_methods: form.payment_methods,
      cc_emails: form.cc_emails.trim()
        ? form.cc_emails.split(",").map((e: string) => e.trim()).filter(Boolean)
        : [],
    } as any)

    setSaving(false)

    if (dbError) { setError(dbError.message); return }

    if (form.status === "sent" && !form.skip_email) {
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
              <select
                value={form.client_id}
                onChange={e => {
                  set("client_id", e.target.value)
                  set("project_id", "")
                  setNewProjectMode(false)
                  setNewProjectTitle("")
                }}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Project <span style={{ opacity: 0.5 }}>(optional)</span></label>
              {newProjectMode ? (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <input
                    type="text"
                    value={newProjectTitle}
                    onChange={e => setNewProjectTitle(e.target.value)}
                    placeholder="Project title…"
                    autoFocus
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => { setNewProjectMode(false); setNewProjectTitle("") }}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 9,
                      letterSpacing: "0.12em", textTransform: "uppercase",
                      color: "var(--ink)", opacity: 0.45,
                      background: "transparent", border: "none",
                      cursor: "pointer", padding: "8px 0",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  value={form.project_id}
                  onChange={e => {
                    if (e.target.value === "__new__") {
                      setNewProjectMode(true)
                      set("project_id", "")
                    } else {
                      set("project_id", e.target.value)
                    }
                  }}
                  disabled={!form.client_id}
                  style={{ ...inputStyle, cursor: form.client_id ? "pointer" : "default", opacity: form.client_id ? 1 : 0.4 }}
                >
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  {form.client_id && (
                    <option value="__new__" style={{ fontStyle: "italic" }}>+ New project…</option>
                  )}
                </select>
              )}
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

          {/* Payment alert */}
          <div>
            <label style={labelStyle}>Payment alert <span style={{ opacity: 0.5 }}>(optional — shows as prominent banner at top of client invoice; use sparingly for urgent payment changes)</span></label>
            <textarea
              value={form.payment_alert}
              onChange={e => set("payment_alert", e.target.value)}
              placeholder="e.g. Our bank account has changed — please update your records and use the new ACH details below."
              rows={2}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.7 }}
            />
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

          {/* CC recipients */}
          <div>
            <label style={labelStyle}>CC recipients <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <input
              style={inputStyle}
              placeholder="accounting@client.com, partner@client.com"
              value={form.cc_emails}
              onChange={e => set("cc_emails", e.target.value)}
            />
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.3, marginTop: 6, letterSpacing: "0.04em" }}>
              Comma-separated. Invoice email will also be sent to these addresses.
            </div>
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

          {/* Skip-email option (only when Sent — would otherwise auto-email the client) */}
          {form.status === "sent" && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", paddingTop: 4 }}>
              <input
                type="checkbox"
                checked={form.skip_email}
                onChange={e => set("skip_email", e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", opacity: 0.7 }}>
                  Skip portal email (I&rsquo;m sending this manually)
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.04em", opacity: 0.4, marginTop: 4, lineHeight: 1.5 }}>
                  Saves the invoice as Sent without firing the portal&rsquo;s automated email.
                </div>
              </div>
            </label>
          )}

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
