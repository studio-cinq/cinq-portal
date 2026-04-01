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
  is_ongoing: boolean
  phase: "now" | "later"
  is_recommended: boolean
  is_optional: boolean
  is_required: boolean
}

const emptyItem = (): LineItem => ({
  name: "", description: "", price: "",
  timeline_min: "2", timeline_max: "4", is_ongoing: false,
  phase: "now", is_recommended: false, is_optional: false, is_required: false,
})

export default function NewProposalPage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    client_id:        "",
    title:            "",
    subtitle:         "",
    overview:         "",
    closing:          "",
    expires_at:       "",
    status:           "sent",
    payment_schedule: "50/50",
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

  function addItem() { setItems(items => [...items, emptyItem()]) }
  function removeItem(index: number) { setItems(items => items.filter((_, i) => i !== index)) }

  async function handleSave(status: "draft" | "sent") {
    if (!form.client_id || !form.title) return
    setLoading(true)

    const schedule = form.payment_schedule.split("/").map(Number)

    const { data: proposal, error } = await supabase
      .from("proposals")
      .insert({
        client_id:  form.client_id,
        title:      form.title,
        subtitle:   form.subtitle || null,
        overview:   form.overview || null,
        closing:    form.closing || null,
        expires_at: form.expires_at || null,
        payment_schedule: schedule,
        status,
      } as any)
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
        timeline_weeks_min: item.is_ongoing ? 0 : (parseInt(item.timeline_min) || 2),
        timeline_weeks_max: item.is_ongoing ? 0 : (parseInt(item.timeline_max) || 4),
        phase:              item.phase,
        is_recommended:     item.is_recommended,
        is_optional:        item.is_optional,
        is_required:        item.is_required,
        sort_order:         idx,
        accepted:           false,
      }))

    if (proposalItems.length > 0) {
      await supabase.from("proposal_items").insert(proposalItems)
    }

    // Send email to client if status is "sent"
    if (status === "sent") {
      await fetch("/api/admin/send-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id }),
      }).catch(err => console.error("[send-proposal]", err))
    }

    setLoading(false)
    router.push("/admin/proposals")
  }

  const totalEstimate = items.reduce((sum, item) => {
    if (!item.price || item.is_optional) return sum
    return sum + (parseFloat(item.price) || 0)
  }, 0)

  const optionalTotal = items.reduce((sum, item) => {
    if (!item.price || !item.is_optional) return sum
    return sum + (parseFloat(item.price) || 0)
  }, 0)

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 860, margin: "0 auto", padding: "40px 48px 80px" }}>

        <Link href="/admin/proposals" style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Proposals
        </Link>

        <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 40 }}>
          New proposal
        </div>

        {/* Section: Basics */}
        <Section label="Basics">
          <Field label="Client">
            <select value={form.client_id} onChange={e => setField("client_id", e.target.value)} style={inputStyle}>
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 16 }}>
            <Field label="Proposal title">
              <input type="text" value={form.title} onChange={e => setField("title", e.target.value)} placeholder="Brand Identity & Launch" style={inputStyle} />
            </Field>
            <Field label="Expires">
              <input type="date" value={form.expires_at} onChange={e => setField("expires_at", e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label="Subtitle (shown under title)">
            <input type="text" value={form.subtitle} onChange={e => setField("subtitle", e.target.value)} placeholder="A focused scope for your spring launch." style={inputStyle} />
          </Field>

          <Field label="Payment schedule">
            <select value={form.payment_schedule} onChange={e => setField("payment_schedule", e.target.value)} style={inputStyle}>
              <option value="50/50">50% deposit · 50% on completion</option>
              <option value="50/25/25">50% deposit · 25% midpoint · 25% completion</option>
              <option value="100">100% upfront</option>
              <option value="33/33/34">33% · 33% · 34% (three equal payments)</option>
            </select>
          </Field>
        </Section>

        {/* Section: Overview */}
        <Section label="Overview">
          <Field label="Opening narrative">
            <textarea
              value={form.overview}
              onChange={e => setField("overview", e.target.value)}
              placeholder="Set the context for this proposal — the project background, your read on the opportunity, and how you're thinking about the scope. This shows at the top of the proposal before the line items."
              rows={6}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
            />
          </Field>
        </Section>

        {/* Section: Scope */}
        <Section label="Scope">
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {items.map((item, i) => (
              <div key={i} style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)", padding: "24px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4 }}>Item {i + 1}</span>
                    {item.is_required && <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink)", border: "0.5px solid rgba(15,15,14,0.2)", padding: "2px 7px" }}>Required</span>}
                    {item.is_optional && <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c95a3b", border: "0.5px solid rgba(201,90,59,0.3)", padding: "2px 7px" }}>Optional</span>}
                    {item.is_recommended && <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b5a042", border: "0.5px solid rgba(232,200,91,0.4)", padding: "2px 7px" }}>Recommended</span>}
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.3, background: "none", border: "none", cursor: "pointer", color: "#0F0F0E", fontFamily: "var(--font-sans)" }}>
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12 }}>
                    <Field label="Name">
                      <input type="text" value={item.name} onChange={e => setItem(i, "name", e.target.value)} placeholder="Brand Identity" style={inputStyle} />
                    </Field>
                    <Field label="Price (USD)">
                      <input type="number" value={item.price} onChange={e => setItem(i, "price", e.target.value)} placeholder="0" style={inputStyle} />
                    </Field>
                  </div>

                  <Field label="Scope description">
                    <textarea
                      value={item.description}
                      onChange={e => setItem(i, "description", e.target.value)}
                      placeholder="What's included — be specific enough that the client understands the deliverables."
                      rows={3}
                      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                    />
                  </Field>

                  <div className="form-grid-3col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <Field label="Timeline min (weeks)">
                      <input type="number" value={item.timeline_min} onChange={e => setItem(i, "timeline_min", e.target.value)} disabled={item.is_ongoing} style={{ ...inputStyle, opacity: item.is_ongoing ? 0.35 : 1 }} />
                    </Field>
                    <Field label="Timeline max (weeks)">
                      <input type="number" value={item.timeline_max} onChange={e => setItem(i, "timeline_max", e.target.value)} disabled={item.is_ongoing} style={{ ...inputStyle, opacity: item.is_ongoing ? 0.35 : 1 }} />
                    </Field>
                    <Field label="Default phase">
                      <select value={item.phase} onChange={e => setItem(i, "phase", e.target.value as "now" | "later")} style={inputStyle}>
                        <option value="now">Priority for launch</option>
                        <option value="later">Second phase</option>
                      </select>
                    </Field>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, opacity: 0.65, cursor: "pointer" }}>
                    <input type="checkbox" checked={item.is_ongoing} onChange={e => setItem(i, "is_ongoing", e.target.checked)} />
                    Ongoing (spans the full project)
                  </label>

                  <div style={{ display: "flex", gap: 24 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, opacity: 0.65, cursor: "pointer" }}>
                      <input type="checkbox" checked={item.is_required} onChange={e => setItem(i, "is_required", e.target.checked)} />
                      Required (client can't deselect)
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, opacity: 0.65, cursor: "pointer" }}>
                      <input type="checkbox" checked={item.is_recommended} onChange={e => setItem(i, "is_recommended", e.target.checked)} />
                      Recommended
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, opacity: 0.65, cursor: "pointer" }}>
                      <input type="checkbox" checked={item.is_optional} onChange={e => setItem(i, "is_optional", e.target.checked)} />
                      Optional add-on
                    </label>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={addItem} style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, background: "none", border: "0.5px solid rgba(15,15,14,0.2)", padding: "10px 20px", cursor: "pointer", color: "#0F0F0E", fontFamily: "var(--font-sans)" }}>
                + Add item
              </button>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Base estimate: <strong>${totalEstimate.toLocaleString()}</strong></div>
                {optionalTotal > 0 && <div style={{ fontSize: 10, opacity: 0.45, marginTop: 2 }}>With add-ons: ${(totalEstimate + optionalTotal).toLocaleString()}</div>}
              </div>
            </div>
          </div>
        </Section>

        {/* Section: Closing */}
        <Section label="Closing note">
          <Field label="Personal closing">
            <textarea
              value={form.closing}
              onChange={e => setField("closing", e.target.value)}
              placeholder="Your closing thought — why you're excited about the project, a personal note to the client, next steps. This shows at the bottom of the proposal after the pricing."
              rows={5}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
            />
          </Field>
        </Section>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, paddingTop: 8 }}>
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.4, marginBottom: 20, paddingBottom: 10, borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.4)",
  border: "0.5px solid rgba(15,15,14,0.15)",
  padding: "10px 12px",
  fontFamily: "var(--font-sans)",
  fontSize: 12, fontWeight: 300,
  color: "#0F0F0E", outline: "none",
}

const btnStyle: React.CSSProperties = {
  padding: "12px 28px",
  fontFamily: "var(--font-sans)",
  fontSize: 9, letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer", border: "none",
}
