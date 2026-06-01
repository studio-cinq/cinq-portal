"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

interface QItem {
  id?: string
  name: string
  price: string
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
  background: "transparent", border: "none",
  borderBottom: "0.5px solid rgba(15,15,14,0.12)",
  padding: "10px 0", color: "var(--ink)", outline: "none",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
  letterSpacing: "0.12em", textTransform: "uppercase",
  opacity: 0.5, marginBottom: 8,
}

const mono = { fontFamily: "var(--font-mono)" } as const

export default function EditQuotePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalStatus, setOriginalStatus] = useState("")
  const [clientName, setClientName] = useState("")

  const [form, setForm] = useState({
    title:            "",
    description:      "",
    expires_at:       "",
    status:           "draft",
    payment_schedule: "100",
  })
  const [items, setItems] = useState<QItem[]>([])
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const { data: q } = await supabase.from("quotes").select("*, clients(name)").eq("id", params.id).single()
      if (q) {
        const schedule = Array.isArray((q as any).payment_schedule) ? (q as any).payment_schedule.join("/") : "100"
        setOriginalStatus((q as any).status)
        setClientName((q as any).clients?.name ?? "")
        setForm({
          title:       (q as any).title ?? "",
          description: (q as any).description ?? "",
          expires_at:  (q as any).expires_at ?? "",
          status:      (q as any).status ?? "draft",
          payment_schedule: schedule,
        })
      }
      const { data: its } = await supabase.from("quote_items").select("*").eq("quote_id", params.id).order("sort_order")
      setItems((its ?? []).map((it: any) => ({
        id: it.id,
        name: it.name,
        price: ((it.price ?? 0) / 100).toString(),
      })))
      setLoading(false)
    }
    load()
  }, [params.id])

  function setField(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }
  function setItem(i: number, k: keyof QItem, v: any) {
    setItems(its => its.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  }
  function addItem() { setItems(its => [...its, { name: "", price: "" }]) }
  function removeItem(i: number) {
    const it = items[i]
    if (it.id) setDeletedItemIds(ids => [...ids, it.id!])
    setItems(its => its.filter((_, idx) => idx !== i))
  }

  const totalCents = items.reduce((s, it) => s + Math.round(parseFloat(it.price || "0") * 100), 0)

  async function handleSave() {
    setError(null)
    if (!form.title.trim()) return setError("Title is required.")
    if (items.filter(i => i.name.trim() && i.price).length === 0) return setError("Add at least one line item.")
    setSaving(true)

    const schedule = form.payment_schedule.split("/").map(Number)

    const { error: updateErr } = await supabase.from("quotes").update({
      title:            form.title.trim(),
      description:      form.description.trim() || null,
      expires_at:       form.expires_at || null,
      status:           form.status,
      payment_schedule: schedule,
    } as any).eq("id", params.id)

    if (updateErr) { setError(updateErr.message); setSaving(false); return }

    // Items: delete removed, update existing, insert new
    if (deletedItemIds.length > 0) {
      await supabase.from("quote_items").delete().in("id", deletedItemIds)
    }

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx]
      if (!it.name.trim() || !it.price) continue
      const payload = {
        quote_id:   params.id,
        name:       it.name.trim(),
        price:      Math.round(parseFloat(it.price) * 100),
        sort_order: idx,
      }
      if (it.id) {
        await supabase.from("quote_items").update(payload).eq("id", it.id)
      } else {
        await supabase.from("quote_items").insert(payload)
      }
    }

    // Fire send email if status changed Draft → Sent
    if (form.status === "sent" && originalStatus !== "sent") {
      try {
        const res = await fetch("/api/admin/send-quote", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteId: params.id }),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          setSaving(false)
          alert(`Quote saved, but email failed:\n\n${payload?.error ?? "unknown error"}\n\nUse "Send email" on the quote page to retry.`)
          router.push(`/admin/quotes/${params.id}`)
          return
        }
      } catch (err: any) {
        setSaving(false)
        alert(`Quote saved, but email request failed:\n\n${err?.message ?? "unknown error"}`)
        router.push(`/admin/quotes/${params.id}`)
        return
      }
    }

    setSaving(false)
    router.push(`/admin/quotes/${params.id}`)
  }

  if (loading) return (
    <>
      <PortalNav isAdmin />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>
        Loading…
      </div>
    </>
  )

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 720, margin: "0 auto", padding: "48px 48px 80px" }}>

        <Link href={`/admin/quotes/${params.id}`} style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Back to quote
        </Link>

        <div style={{ marginBottom: 40 }}>
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.4, marginBottom: 10 }}>
            Quotes / Edit · {clientName}
          </div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 28, letterSpacing: "-0.02em", margin: 0, opacity: 0.92 }}>
            {form.title || "Edit quote"}
          </h1>
        </div>

        {originalStatus === "accepted" && (
          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.08em", color: "var(--amber)", background: "rgba(201,90,59,0.08)", border: "0.5px solid rgba(201,90,59,0.3)", padding: "10px 14px", marginBottom: 28 }}>
            This quote has been accepted. Edits won't update the invoice that was already created.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          <div>
            <label style={labelStyle}>Title *</label>
            <input type="text" value={form.title} onChange={e => setField("title", e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Description <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <textarea value={form.description} onChange={e => setField("description", e.target.value)} rows={2} style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }} />
          </div>

          <div>
            <label style={labelStyle}>Line items *</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 12, alignItems: "center" }}>
                  <input type="text" value={it.name} onChange={e => setItem(i, "name", e.target.value)} placeholder="Item name" style={{ ...inputStyle, padding: "8px 0" }} />
                  <input type="number" value={it.price} onChange={e => setItem(i, "price", e.target.value)} placeholder="0" style={{ ...inputStyle, padding: "8px 0", textAlign: "right" }} />
                  <button onClick={() => removeItem(i)} style={{ ...mono, fontSize: 12, background: "transparent", border: "none", cursor: "pointer", color: "var(--ink)", opacity: 0.4, padding: "6px 8px" }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
              <button onClick={addItem} style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", background: "transparent", border: "none", padding: 0, color: "var(--ink)", opacity: 0.5, cursor: "pointer" }}>+ Add item</button>
              <div>
                <span style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, marginRight: 12 }}>Total</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 22, opacity: 0.88, letterSpacing: "-0.01em" }}>${(totalCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
            <div>
              <label style={labelStyle}>Payment schedule</label>
              <select value={form.payment_schedule} onChange={e => setField("payment_schedule", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="100">100% on approval</option>
                <option value="50/50">50% now · 50% on completion</option>
                <option value="40/30/30">40% · 30% midpoint · 30% completion</option>
                <option value="50/25/25">50% · 25% midpoint · 25% completion</option>
                <option value="0/100">100% on completion · unlocks files</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Expires <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input type="date" value={form.expires_at} onChange={e => setField("expires_at", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => setField("status", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          {form.status === "sent" && originalStatus !== "sent" && (
            <div style={{ ...mono, fontSize: 10, letterSpacing: "0.08em", color: "var(--sage)", background: "rgba(143,167,181,0.08)", border: "0.5px solid rgba(143,167,181,0.2)", padding: "10px 14px" }}>
              Email will be sent to the client when you save.
            </div>
          )}

          {error && <div style={{ ...mono, fontSize: 10, color: "var(--amber)", opacity: 0.9 }}>{error}</div>}

          <div style={{ display: "flex", gap: 12, alignItems: "center", paddingTop: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{
              ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
              background: "var(--ink)", color: "var(--cream)", border: "none", padding: "14px 28px",
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.4 : 1, transition: "opacity 0.2s",
            }}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <Link href={`/admin/quotes/${params.id}`} style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none" }}>
              Cancel
            </Link>
          </div>

        </div>
      </main>
    </>
  )
}
