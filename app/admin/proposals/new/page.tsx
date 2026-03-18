"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

interface LineItem {
  name: string
  description: string
  price: string
  timeline_min: string
  timeline_max: string
  phase: "now" | "later"
  is_recommended: boolean
}

const emptyItem = (): LineItem => ({
  name: "", description: "", price: "",
  timeline_min: "2", timeline_max: "4",
  phase: "now", is_recommended: false,
})

export default function NewProposalPage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    client_id: "",
    title: "",
    subtitle: "",
    expires_at: "",
    status: "sent",
  })

  const [items, setItems] = useState<LineItem[]>([emptyItem()])

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => {
      setClients(data ?? [])
    })
  }, [])

  function setField(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setItem(index: number, key: keyof LineItem, value: any) {
    setItems(items => items.map((item, i) => i === index ? { ...item, [key]: value } : item))
  }

  function addItem() {
    setItems(items => [...items, emptyItem()])
  }

  function removeItem(index: number) {
    setItems(items => items.filter((_, i) => i !== index))
  }

  async function handleSave(status: "draft" | "sent") {
    if (!form.client_id || !form.title) return
    setLoading(true)

    const { data: proposal, error } = await supabase
      .from("proposals")
      .insert({
        client_id:  form.client_id,
        title:      form.title,
        subtitle:   form.subtitle || null,
        expires_at: form.expires_at || null,
        status,
      })
      .select()
      .single()

    if (error || !proposal) { setLoading(false); return }

    const proposalItems = items
      .filter(i => i.name && i.price)
      .map((item, idx) => ({
        proposal_id:        proposal.id,
        project_id:         null,
        name:               item.name,
        description:        item.description || null,
        price:              Math.round(parseFloat(item.price) * 100),
        timeline_weeks_min: parseInt(item.timeline_min) || 2,
        timeline_weeks_max: parseInt(item.timeline_max) || 4,
        phase:              item.phase,
        is_recommended:     item.is_recommended,
        sort_order:         idx,
        accepted:           false,
      }))

    if (proposalItems.length > 0) {
      await supabase.from("proposal_items").insert(proposalItems)
    }

    setLoading(false)
    router.push("/admin/proposals")
  }

  return (
    <>
      <PortalNav isAdmin />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 48px" }}>

        <Link href="/admin/proposals" style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Proposals
        </Link>

        <div style={{ fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 32 }}>
          New proposal
        </div>

        {/* Proposal details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40 }}>
          <Field label="Client">
            <select value={form.client_id} onChange={e => setField("client_id", e.target.value)} style={inputStyle}>
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Proposal title">
              <input type="text" value={form.title} onChange={e => setField("title", e.target.value)} placeholder="Brand Identity & Launch" style={inputStyle} />
            </Field>
            <Field label="Expires">
              <input type="date" value={form.expires_at} onChange={e => setField("expires_at", e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label="Subtitle / context (optional)">
            <input type="text" value={form.subtitle} onChange={e => setField("subtitle", e.target.value)} placeholder="A focused scope for your spring launch." style={inputStyle} />
          </Field>
        </div>

        {/* Line items */}
        <div style={{ fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 16 }}>
          Line items
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {items.map((item, i) => (
            <div key={i} style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)", padding: "20px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4 }}>Item {i + 1}</div>
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.35, background: "none", border: "none", cursor: "pointer", color: "#0F0F0E" }}>
                    Remove
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12 }}>
                  <Field label="Name">
                    <input type="text" value={item.name} onChange={e => setItem(i, "name", e.target.value)} placeholder="Brand Identity" style={inputStyle} />
                  </Field>
                  <Field label="Price (USD)">
                    <input type="number" value={item.price} onChange={e => setItem(i, "price", e.target.value)} placeholder="0" style={inputStyle} />
                  </Field>
                </div>

                <Field label="Description">
                  <textarea value={item.description} onChange={e => setItem(i, "description", e.target.value)} placeholder="What's included…" rows={2} style={{ ...inputStyle, resize: "none" }} />
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <Field label="Timeline min (weeks)">
                    <input type="number" value={item.timeline_min} onChange={e => setItem(i, "timeline_min", e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Timeline max (weeks)">
                    <input type="number" value={item.timeline_max} onChange={e => setItem(i, "timeline_max", e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Default phase">
                    <select value={item.phase} onChange={e => setItem(i, "phase", e.target.value as "now" | "later")} style={inputStyle}>
                      <option value="now">Start now</option>
                      <option value="later">Schedule later</option>
                    </select>
                  </Field>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={item.is_recommended} onChange={e => setItem(i, "is_recommended", e.target.checked)} id={`rec-${i}`} />
                  <label htmlFor={`rec-${i}`} style={{ fontSize: 11, opacity: 0.65 }}>Mark as recommended</label>
                </div>
              </div>
            </div>
          ))}

          <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)", paddingTop: 16 }}>
            <button onClick={addItem} style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, background: "none", border: "0.5px solid rgba(15,15,14,0.2)", padding: "10px 20px", cursor: "pointer", color: "#0F0F0E", fontFamily: "'Jost', sans-serif" }}>
              + Add item
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, paddingTop: 32 }}>
          <button onClick={() => handleSave("draft")} disabled={loading || !form.client_id || !form.title} style={{ ...btnStyle, background: "transparent", color: "#0F0F0E", border: "0.5px solid rgba(15,15,14,0.2)", opacity: loading ? 0.4 : 0.65 }}>
            Save as draft
          </button>
          <button onClick={() => handleSave("sent")} disabled={loading || !form.client_id || !form.title} style={{ ...btnStyle, background: "#0F0F0E", color: "#EDE8E0", opacity: loading ? 0.4 : 1 }}>
            {loading ? "Saving…" : "Send to client"}
          </button>
        </div>

      </main>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.4)",
  border: "0.5px solid rgba(15,15,14,0.15)",
  padding: "10px 12px",
  fontFamily: "'Jost', sans-serif",
  fontSize: 12, fontWeight: 300,
  color: "#0F0F0E", outline: "none",
}

const btnStyle: React.CSSProperties = {
  padding: "12px 24px",
  fontFamily: "'Jost', sans-serif",
  fontSize: 9, letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer", border: "none",
}
