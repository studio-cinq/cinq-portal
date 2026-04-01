"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

interface LineItem {
  id?: string
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
  _deleted?: boolean
}

const emptyItem = (): LineItem => ({
  name: "", description: "", price: "",
  timeline_min: "2", timeline_max: "4", is_ongoing: false,
  phase: "now", is_recommended: false, is_optional: false, is_required: false,
})

export default function EditProposalPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [clients, setClients]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

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
    Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("proposals").select("*").eq("id", params.id).single(),
      supabase.from("proposal_items").select("*").eq("proposal_id", params.id).order("sort_order"),
    ]).then(([clientsRes, proposalRes, itemsRes]) => {
      setClients(clientsRes.data ?? [])

      if (proposalRes.data) {
        const p = proposalRes.data as any
        const schedule = Array.isArray(p.payment_schedule) ? p.payment_schedule.join("/") : "50/50"
        setForm({
          client_id:        p.client_id ?? "",
          title:            p.title ?? "",
          subtitle:         p.subtitle ?? "",
          overview:         p.overview ?? "",
          closing:          p.closing ?? "",
          expires_at:       p.expires_at ?? "",
          status:           p.status ?? "sent",
          payment_schedule: schedule,
        })
      }

      if (itemsRes.data && itemsRes.data.length > 0) {
        setItems(itemsRes.data.map((item: any) => ({
          id:             item.id,
          name:           item.name ?? "",
          description:    item.description ?? "",
          price:          item.price ? String(item.price / 100) : "",
          timeline_min:   String(item.timeline_weeks_min ?? 2),
          timeline_max:   String(item.timeline_weeks_max ?? 4),
          is_ongoing:     (item.timeline_weeks_min === 0 && item.timeline_weeks_max === 0),
          phase:          item.phase ?? "now",
          is_recommended: item.is_recommended ?? false,
          is_optional:    item.is_optional ?? false,
          is_required:    item.is_required ?? false,
        })))
      }

      setLoading(false)
    })
  }, [params.id])

  function setField(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
  }

  function setItem(index: number, key: keyof LineItem, value: any) {
    setItems(items => items.map((item, i) => i === index ? { ...item, [key]: value } : item))
    setSaved(false)
  }

  function addItem() { setItems(items => [...items, emptyItem()]) }

  function removeItem(index: number) {
    const item = items[index]
    if (item.id) {
      // Mark existing DB item for deletion
      setItems(items => items.map((it, i) => i === index ? { ...it, _deleted: true } : it))
    } else {
      // Remove unsaved item entirely
      setItems(items => items.filter((_, i) => i !== index))
    }
    setSaved(false)
  }

  async function handleSave() {
    setError(null)
    if (!form.client_id || !form.title) {
      setError("Client and title are required.")
      return
    }
    setSaving(true)

    const schedule = form.payment_schedule.split("/").map(Number)

    // 1. Update proposal
    const { error: proposalError } = await supabase
      .from("proposals")
      .update({
        client_id:  form.client_id,
        title:      form.title,
        subtitle:   form.subtitle || null,
        overview:   form.overview || null,
        closing:    form.closing || null,
        expires_at: form.expires_at || null,
        status:     form.status,
        payment_schedule: schedule,
      } as any)
      .eq("id", params.id)

    if (proposalError) {
      setError(proposalError.message)
      setSaving(false)
      return
    }

    // 2. Delete removed items
    const deletedIds = items.filter(i => i._deleted && i.id).map(i => i.id!)
    if (deletedIds.length > 0) {
      await supabase.from("proposal_items").delete().in("id", deletedIds)
    }

    // 3. Update existing items & insert new ones
    const activeItems = items.filter(i => !i._deleted && i.name && i.price)

    for (let idx = 0; idx < activeItems.length; idx++) {
      const item = activeItems[idx]
      const payload = {
        proposal_id:        params.id,
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
      }

      if (item.id) {
        // Update existing
        await supabase.from("proposal_items").update(payload).eq("id", item.id)
      } else {
        // Insert new
        const { data } = await supabase.from("proposal_items").insert(payload).select().single()
        if (data) {
          // Update local state with the new ID
          setItems(prev => prev.map((it, i) => {
            const activeIndex = prev.filter(x => !x._deleted).indexOf(it)
            return activeIndex === idx && !it.id ? { ...it, id: data.id } : it
          }))
        }
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      router.push(`/admin/proposals/${params.id}`)
      router.refresh()
    }, 600)
  }

  if (loading) {
    return (
      <>
        <PortalNav isAdmin />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>Loading…</div>
        </div>
      </>
    )
  }

  const visibleItems = items.filter(i => !i._deleted)

  const totalEstimate = visibleItems.reduce((sum, item) => {
    if (!item.price || item.is_optional) return sum
    return sum + (parseFloat(item.price) || 0)
  }, 0)

  const optionalTotal = visibleItems.reduce((sum, item) => {
    if (!item.price || !item.is_optional) return sum
    return sum + (parseFloat(item.price) || 0)
  }, 0)

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 860, margin: "0 auto", padding: "40px 48px 80px" }}>

        <Link href={`/admin/proposals/${params.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Back to proposal
        </Link>

        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 40 }}>
          Edit proposal
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

          <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Payment schedule">
              <select value={form.payment_schedule} onChange={e => setField("payment_schedule", e.target.value)} style={inputStyle}>
                <option value="50/50">50% deposit · 50% on completion</option>
                <option value="50/25/25">50% deposit · 25% midpoint · 25% completion</option>
                <option value="100">100% upfront</option>
                <option value="33/33/34">33% · 33% · 34% (three equal payments)</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setField("status", e.target.value)} style={inputStyle}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* Section: Overview */}
        <Section label="Overview">
          <Field label="Opening narrative">
            <textarea
              value={form.overview}
              onChange={e => setField("overview", e.target.value)}
              placeholder="Set the context for this proposal — the project background, your read on the opportunity, and how you're thinking about the scope."
              rows={6}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
            />
          </Field>
        </Section>

        {/* Section: Scope */}
        <Section label="Scope">
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {items.map((item, i) => {
              if (item._deleted) return null
              return (
                <div key={item.id ?? `new-${i}`} style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)", padding: "24px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4 }}>
                        {item.id ? "Existing item" : "New item"}
                      </span>
                      {item.is_required && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink)", border: "0.5px solid rgba(15,15,14,0.2)", padding: "2px 7px" }}>Required</span>}
                      {item.is_optional && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber)", border: "0.5px solid rgba(201,90,59,0.3)", padding: "2px 7px" }}>Optional</span>}
                      {item.is_recommended && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b5a042", border: "0.5px solid rgba(232,200,91,0.4)", padding: "2px 7px" }}>Recommended</span>}
                    </div>
                    {visibleItems.length > 1 && (
                      <button onClick={() => removeItem(i)} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.3, background: "none", border: "none", cursor: "pointer", color: "var(--ink)" }}>
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
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", fontSize: 11, opacity: 0.65, cursor: "pointer" }}>
                      <input type="checkbox" checked={item.is_ongoing} onChange={e => setItem(i, "is_ongoing", e.target.checked)} />
                      Ongoing (spans the full project)
                    </label>

                    <div style={{ display: "flex", gap: 24 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", fontSize: 11, opacity: 0.65, cursor: "pointer" }}>
                        <input type="checkbox" checked={item.is_required} onChange={e => setItem(i, "is_required", e.target.checked)} />
                        Required (client can't deselect)
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", fontSize: 11, opacity: 0.65, cursor: "pointer" }}>
                        <input type="checkbox" checked={item.is_recommended} onChange={e => setItem(i, "is_recommended", e.target.checked)} />
                        Recommended
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", fontSize: 11, opacity: 0.65, cursor: "pointer" }}>
                        <input type="checkbox" checked={item.is_optional} onChange={e => setItem(i, "is_optional", e.target.checked)} />
                        Optional add-on
                      </label>
                    </div>
                  </div>
                </div>
              )
            })}

            <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={addItem} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, background: "none", border: "0.5px solid rgba(15,15,14,0.2)", padding: "10px 20px", cursor: "pointer", color: "var(--ink)" }}>
                + Add item
              </button>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, opacity: 0.7 }}>Base estimate: <strong>${totalEstimate.toLocaleString()}</strong></div>
                {optionalTotal > 0 && <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, opacity: 0.45, marginTop: 2 }}>With add-ons: ${(totalEstimate + optionalTotal).toLocaleString()}</div>}
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
              placeholder="Your closing thought — why you're excited about the project, a personal note to the client, next steps."
              rows={5}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
            />
          </Field>
        </Section>

        {error && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--danger)", opacity: 0.8, marginBottom: 16 }}>{error}</div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, paddingTop: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving || saved || !form.client_id || !form.title}
            style={{
              ...btnStyle,
              background: saved ? "var(--sage)" : "var(--ink)",
              color: "var(--cream)",
              opacity: saving ? 0.4 : 1,
              transition: "all 0.3s",
            }}
          >
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={() => router.push(`/admin/proposals/${params.id}`)}
            style={{ ...btnStyle, background: "transparent", color: "var(--ink)", border: "0.5px solid rgba(15,15,14,0.2)", opacity: 0.65 }}
          >
            Cancel
          </button>
        </div>

      </main>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.4, marginBottom: 20, paddingBottom: 10, borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, marginBottom: 8 }}>{label}</div>
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
  color: "var(--ink)", outline: "none",
}

const btnStyle: React.CSSProperties = {
  padding: "12px 28px",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em",
  textTransform: "uppercase",
  cursor: "pointer", border: "none",
}
