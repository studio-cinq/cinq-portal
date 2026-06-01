"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

interface QItem {
  name: string
  price: string
}

const emptyItem = (): QItem => ({ name: "", price: "" })

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

export default function NewQuotePage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_id:        "",
    project_id:       "",
    title:            "",
    description:      "",
    expires_at:       "",
    status:           "sent",
    payment_schedule: "100",
  })

  const [items, setItems] = useState<QItem[]>([emptyItem()])

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => {
      setClients(data ?? [])
    })
  }, [])

  useEffect(() => {
    if (!form.client_id) { setProjects([]); return }
    supabase.from("projects").select("id, title").eq("client_id", form.client_id).eq("status", "active").then(({ data }) => {
      setProjects(data ?? [])
    })
  }, [form.client_id])

  function setField(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }
  function setItem(i: number, k: keyof QItem, v: any) {
    setItems(its => its.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  }
  function addItem() { setItems(its => [...its, emptyItem()]) }
  function removeItem(i: number) { setItems(its => its.filter((_, idx) => idx !== i)) }

  const totalCents = items.reduce((s, it) => s + Math.round(parseFloat(it.price || "0") * 100), 0)

  async function handleSave(status: "draft" | "sent") {
    setError(null)
    if (!form.client_id) return setError("Pick a client.")
    if (!form.title.trim()) return setError("Title is required.")
    if (items.filter(i => i.name.trim() && i.price).length === 0) return setError("Add at least one line item.")

    setLoading(true)

    const schedule = form.payment_schedule.split("/").map(Number)

    const { data: quote, error: qError } = await supabase.from("quotes").insert({
      client_id:        form.client_id,
      project_id:       form.project_id || null,
      title:            form.title.trim(),
      description:      form.description.trim() || null,
      expires_at:       form.expires_at || null,
      status,
      payment_schedule: schedule,
    } as any).select().single()

    if (qError || !quote) {
      setError(qError?.message ?? "Could not save quote.")
      setLoading(false)
      return
    }

    const quoteItems = items
      .filter(it => it.name.trim() && it.price)
      .map((it, idx) => ({
        quote_id: (quote as any).id,
        name: it.name.trim(),
        price: Math.round(parseFloat(it.price) * 100),
        sort_order: idx,
      }))

    if (quoteItems.length > 0) {
      await supabase.from("quote_items").insert(quoteItems)
    }

    // Send email if status is "sent"
    if (status === "sent") {
      try {
        const sendRes = await fetch("/api/admin/send-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteId: (quote as any).id }),
        })
        if (!sendRes.ok) {
          const payload = await sendRes.json().catch(() => ({}))
          const msg = payload?.error ?? "Email send failed"
          setLoading(false)
          alert(
            `Quote was saved, but the email to the client failed:\n\n${msg}\n\n` +
            `Open the quote and use "Resend email" to try again.`
          )
          router.push(`/admin/quotes/${(quote as any).id}`)
          return
        }
      } catch (err: any) {
        console.error("[send-quote]", err)
        setLoading(false)
        alert(`Quote was saved, but the email request failed:\n\n${err?.message ?? "unknown error"}`)
        router.push(`/admin/quotes/${(quote as any).id}`)
        return
      }
    }

    setLoading(false)
    router.push("/admin/quotes")
  }

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 720, margin: "0 auto", padding: "48px 48px 80px" }}>

        <Link href="/admin/quotes" style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Quotes
        </Link>

        <div style={{ marginBottom: 40 }}>
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.4, marginBottom: 10 }}>
            Quotes / New
          </div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 30, letterSpacing: "-0.02em", margin: 0, opacity: 0.92 }}>
            New quote
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Client + Project */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <label style={labelStyle}>Client *</label>
              <select value={form.client_id} onChange={e => setField("client_id", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">—</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Link to project <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <select value={form.project_id} onChange={e => setField("project_id", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }} disabled={!form.client_id}>
                <option value="">—</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setField("title", e.target.value)}
              placeholder="e.g. Brand color extension — 2 new tones"
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <textarea
              value={form.description}
              onChange={e => setField("description", e.target.value)}
              placeholder="Short context for the client. Skip if obvious."
              rows={2}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }}
            />
          </div>

          {/* Line items */}
          <div>
            <label style={labelStyle}>Line items *</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 12, alignItems: "center" }}>
                  <input
                    type="text"
                    value={item.name}
                    onChange={e => setItem(i, "name", e.target.value)}
                    placeholder="Item name"
                    style={{ ...inputStyle, padding: "8px 0" }}
                  />
                  <input
                    type="number"
                    value={item.price}
                    onChange={e => setItem(i, "price", e.target.value)}
                    placeholder="0"
                    style={{ ...inputStyle, padding: "8px 0", textAlign: "right" }}
                  />
                  <button
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    style={{
                      ...mono, fontSize: 12,
                      background: "transparent", border: "none",
                      cursor: items.length === 1 ? "default" : "pointer",
                      color: "var(--ink)", opacity: items.length === 1 ? 0.15 : 0.4,
                      padding: "6px 8px",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
              <button
                onClick={addItem}
                style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", background: "transparent", border: "none", padding: 0, color: "var(--ink)", opacity: 0.5, cursor: "pointer" }}
              >
                + Add item
              </button>
              <div>
                <span style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, marginRight: 12 }}>Total</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 22, opacity: 0.88, letterSpacing: "-0.01em" }}>${(totalCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Payment + Expires + Status */}
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
              <input
                type="date"
                value={form.expires_at}
                onChange={e => setField("expires_at", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => setField("status", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="draft">Draft</option>
                <option value="sent">Send now</option>
              </select>
            </div>
          </div>

          {error && (
            <div style={{ ...mono, fontSize: 10, color: "var(--amber)", opacity: 0.9 }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 12, alignItems: "center", paddingTop: 8 }}>
            <button
              onClick={() => handleSave(form.status as "draft" | "sent")}
              disabled={loading}
              style={{
                ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
                background: "var(--ink)", color: "var(--cream)",
                border: "none", padding: "14px 28px",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.4 : 1, transition: "opacity 0.2s",
              }}
            >
              {loading ? "Saving…" : form.status === "sent" ? "Save & send" : "Save draft"}
            </button>
            <Link href="/admin/quotes" style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none" }}>
              Cancel
            </Link>
          </div>

        </div>
      </main>
    </>
  )
}
