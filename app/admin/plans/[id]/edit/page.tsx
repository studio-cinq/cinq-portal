"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import PortalNav from "@/components/portal/Nav"

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" }
const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" }

const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "transparent", border: "none",
  borderBottom: "0.5px solid rgba(15,15,14,0.18)",
  padding: "8px 0",
  ...sans, fontSize: 13.5, color: "var(--ink)", outline: "none",
}

const inputBox: React.CSSProperties = {
  ...input,
  border: "0.5px solid rgba(15,15,14,0.15)",
  padding: "10px 12px",
}

const labelStyle: React.CSSProperties = {
  ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
  opacity: 0.6, marginBottom: 6, display: "block",
}

const sectionLabel: React.CSSProperties = {
  ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase",
  opacity: 0.55, marginBottom: 14,
}

const addBtn: React.CSSProperties = {
  ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
  background: "transparent", border: "0.5px solid rgba(15,15,14,0.22)",
  padding: "8px 12px", cursor: "pointer", color: "var(--ink)", opacity: 0.7,
}

type Plan = {
  id: string
  client_id: string
  title: string
  subtitle?: string | null
  eyebrow?: string | null
  prepared_for?: string | null
  prepared_date?: string | null
  tagline?: string | null
  cover_image_url?: string | null
  footer_pills?: string[] | null
  idea_eyebrow?: string | null
  idea_body?: string | null
  status: string
  last_sent_at?: string | null
}

type Section = { id: string; plan_id: string; sort_order: number; number_label?: string | null; title: string; lede?: string | null; aside?: string | null }
type Priority = "now" | "next" | "later" | null
type Item = { id: string; section_id: string; sort_order: number; title: string; description?: string | null; estimate_cents?: number | null; estimate_note?: string | null; priority?: Priority }

export default function EditPlanPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [itemsBySection, setItemsBySection] = useState<Map<string, Item[]>>(new Map())
  const [pillInput, setPillInput] = useState("")
  const [savingMeta, setSavingMeta] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [p, s] = await Promise.all([
        supabase.from("plans").select("*, clients(name, contact_name)").eq("id", params.id).single(),
        supabase.from("plan_sections").select("*").eq("plan_id", params.id).order("sort_order"),
      ])
      if (cancelled) return
      const planData = (p.data ?? null) as any
      const secs = (s.data ?? []) as Section[]
      setPlan(planData)
      setSections(secs)

      if (secs.length > 0) {
        const { data: itemsRaw } = await supabase.from("plan_items").select("*").in("section_id", secs.map(x => x.id)).order("sort_order")
        const map = new Map<string, Item[]>()
        for (const it of (itemsRaw ?? []) as Item[]) {
          const arr = map.get(it.section_id) ?? []
          arr.push(it)
          map.set(it.section_id, arr)
        }
        setItemsBySection(map)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [params.id])

  function patchPlanLocal(patch: Partial<Plan>) {
    setPlan(p => p ? { ...p, ...patch } : p)
  }

  async function saveMeta() {
    if (!plan) return
    setSavingMeta(true)
    const payload = {
      title: plan.title?.trim(),
      subtitle: plan.subtitle?.trim() || null,
      eyebrow: plan.eyebrow?.trim() || null,
      prepared_for: plan.prepared_for?.trim() || null,
      prepared_date: plan.prepared_date?.trim() || null,
      tagline: plan.tagline?.trim() || null,
      cover_image_url: plan.cover_image_url || null,
      footer_pills: plan.footer_pills ?? [],
      idea_eyebrow: plan.idea_eyebrow?.trim() || "The Idea",
      idea_body: plan.idea_body?.trim() || null,
    }
    await supabase.from("plans").update(payload).eq("id", plan.id)
    setSavingMeta(false)
    showToast("Cover saved")
  }

  function addPill() {
    if (!pillInput.trim() || !plan) return
    const next = [...(plan.footer_pills ?? []), pillInput.trim()]
    patchPlanLocal({ footer_pills: next })
    setPillInput("")
  }
  function removePill(i: number) {
    if (!plan) return
    const next = (plan.footer_pills ?? []).filter((_, idx) => idx !== i)
    patchPlanLocal({ footer_pills: next })
  }

  async function uploadCover(file: File) {
    if (!plan) return
    const ext = file.name.split(".").pop() ?? "bin"
    const path = `${plan.id}/cover-${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from("plan-covers").upload(path, file)
    if (uploadErr) { showToast("Upload failed"); return }
    const { data: urlData } = supabase.storage.from("plan-covers").getPublicUrl(path)
    patchPlanLocal({ cover_image_url: urlData.publicUrl })
    showToast("Cover image set — remember to save")
  }

  // ─── Sections ───────────────────────────────────────────────
  async function addSection() {
    if (!plan) return
    const nextOrder = sections.length
    const numLabel = String(nextOrder).padStart(2, "0")
    const { data } = await supabase.from("plan_sections").insert({
      plan_id: plan.id,
      sort_order: nextOrder,
      number_label: numLabel,
      title: "Untitled section",
    } as any).select().single()
    if (data) setSections(prev => [...prev, data as Section])
  }

  async function patchSection(id: string, patch: Partial<Section>) {
    await supabase.from("plan_sections").update(patch).eq("id", id)
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  async function deleteSection(id: string) {
    if (!confirm("Delete this section and all its items?")) return
    await supabase.from("plan_sections").delete().eq("id", id)
    setSections(prev => prev.filter(s => s.id !== id))
    setItemsBySection(prev => { const m = new Map(prev); m.delete(id); return m })
  }

  async function moveSection(id: string, dir: -1 | 1) {
    const idx = sections.findIndex(s => s.id === id)
    if (idx === -1) return
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sections.length) return
    const reordered = [...sections]
    const tmp = reordered[idx]
    reordered[idx] = reordered[swapIdx]
    reordered[swapIdx] = tmp
    setSections(reordered)
    // Persist sort_order
    await Promise.all(reordered.map((s, i) => supabase.from("plan_sections").update({ sort_order: i }).eq("id", s.id)))
  }

  // ─── Items ──────────────────────────────────────────────────
  async function addItem(sectionId: string) {
    const items = itemsBySection.get(sectionId) ?? []
    const { data } = await supabase.from("plan_items").insert({
      section_id: sectionId,
      sort_order: items.length,
      title: "Untitled item",
    } as any).select().single()
    if (data) {
      setItemsBySection(prev => {
        const m = new Map(prev)
        m.set(sectionId, [...items, data as Item])
        return m
      })
    }
  }

  async function patchItem(item: Item, patch: Partial<Item>) {
    await supabase.from("plan_items").update(patch).eq("id", item.id)
    setItemsBySection(prev => {
      const m = new Map(prev)
      const list = (m.get(item.section_id) ?? []).map(i => i.id === item.id ? { ...i, ...patch } : i)
      m.set(item.section_id, list)
      return m
    })
  }

  async function deleteItem(item: Item) {
    await supabase.from("plan_items").delete().eq("id", item.id)
    setItemsBySection(prev => {
      const m = new Map(prev)
      const list = (m.get(item.section_id) ?? []).filter(i => i.id !== item.id)
      m.set(item.section_id, list)
      return m
    })
  }

  async function moveItem(item: Item, dir: -1 | 1) {
    const list = itemsBySection.get(item.section_id) ?? []
    const idx = list.findIndex(i => i.id === item.id)
    if (idx === -1) return
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= list.length) return
    const reordered = [...list]
    const tmp = reordered[idx]
    reordered[idx] = reordered[swapIdx]
    reordered[swapIdx] = tmp
    setItemsBySection(prev => { const m = new Map(prev); m.set(item.section_id, reordered); return m })
    await Promise.all(reordered.map((i, n) => supabase.from("plan_items").update({ sort_order: n }).eq("id", i.id)))
  }

  // ─── Send / resend ──────────────────────────────────────────
  async function handleSend() {
    if (!plan) return
    setSending(true)
    try {
      const res = await fetch("/api/admin/send-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      })
      if (res.ok) {
        showToast("Email sent ✓")
        const j = await res.json().catch(() => ({}))
        if (j && plan.status === "draft") patchPlanLocal({ status: "sent" })
      } else {
        const j = await res.json().catch(() => ({}))
        showToast(j?.error ?? "Send failed")
      }
    } catch (err: any) {
      showToast(err?.message ?? "Send failed")
    }
    setSending(false)
  }

  if (loading) return (
    <>
      <PortalNav isAdmin />
      <div style={{ ...mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35, textAlign: "center", padding: "120px 28px" }}>Loading…</div>
    </>
  )
  if (!plan) return (
    <>
      <PortalNav isAdmin />
      <div style={{ ...serif, fontStyle: "italic", textAlign: "center", padding: "120px 28px", opacity: 0.5 }}>Plan not found.</div>
    </>
  )

  const clientName = (plan as any).clients?.name ?? ""

  return (
    <>
      <PortalNav isAdmin />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px clamp(24px, 4vw, 56px) 96px" }}>

        <div style={{ marginBottom: 20 }}>
          <Link href="/admin/plans" style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none" }}>
            ← Direction Plans
          </Link>
        </div>

        {/* Header */}
        <header style={{ marginBottom: 40, paddingBottom: 26, borderBottom: "0.5px solid rgba(15,15,14,0.1)", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 8 }}>
              {clientName} · Edit
            </div>
            <h1 style={{ ...sans, fontWeight: 400, fontSize: 30, letterSpacing: "-0.02em", margin: 0, opacity: 0.95 }}>
              {plan.title}
            </h1>
          </div>
          <button onClick={handleSend} disabled={sending} style={{
            ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
            background: plan.status === "draft" ? "var(--ink)" : "transparent",
            color: plan.status === "draft" ? "var(--cream)" : "var(--ink)",
            border: "0.5px solid rgba(15,15,14,0.25)",
            padding: "10px 18px", cursor: sending ? "default" : "pointer",
            opacity: sending ? 0.5 : 1,
          }}>
            {sending ? "Sending…" : plan.status === "draft" ? "Send to client" : "Resend email"}
          </button>
          <Link href={`/plan/${plan.id}`} target="_blank" style={{
            ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--ink)", opacity: 0.65, textDecoration: "none",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "10px 16px",
          }}>
            View client read ↗
          </Link>
        </header>

        {/* COVER + IDEA */}
        <div style={{ marginBottom: 56, padding: "26px 28px", background: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(15,15,14,0.1)" }}>
          <div style={sectionLabel}>Cover</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input type="text" value={plan.title ?? ""} onChange={e => patchPlanLocal({ title: e.target.value })} style={input} />
            </div>
            <div>
              <label style={labelStyle}>Subtitle <span style={{ opacity: 0.5 }}>(italic line under title)</span></label>
              <input type="text" value={plan.subtitle ?? ""} onChange={e => patchPlanLocal({ subtitle: e.target.value })} style={input} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Eyebrow (top-left)</label>
              <input type="text" placeholder="Studio Cinq" value={plan.eyebrow ?? ""} onChange={e => patchPlanLocal({ eyebrow: e.target.value })} style={input} />
            </div>
            <div>
              <label style={labelStyle}>Prepared for (top-right)</label>
              <input type="text" placeholder="HK Architects" value={plan.prepared_for ?? ""} onChange={e => patchPlanLocal({ prepared_for: e.target.value })} style={input} />
            </div>
            <div>
              <label style={labelStyle}>Date (top-right)</label>
              <input type="text" placeholder="June 2026" value={plan.prepared_date ?? ""} onChange={e => patchPlanLocal({ prepared_date: e.target.value })} style={input} />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Tagline <span style={{ opacity: 0.5 }}>(italic accent line under client name)</span></label>
            <input type="text" placeholder="A Working Building, Since 1930 · 5000 Rossville Boulevard, Chattanooga" value={plan.tagline ?? ""} onChange={e => patchPlanLocal({ tagline: e.target.value })} style={input} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Cover image <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <CoverImagePicker
              currentUrl={plan.cover_image_url ?? null}
              onUpload={uploadCover}
              onClear={() => patchPlanLocal({ cover_image_url: null })}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Footer pills <span style={{ opacity: 0.5 }}>(small uppercase tags at the cover bottom)</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {(plan.footer_pills ?? []).map((p, i) => (
                <span key={i} style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", background: "rgba(255,255,255,0.6)", border: "0.5px solid rgba(15,15,14,0.15)", padding: "4px 8px" }}>
                  {p}
                  <button onClick={() => removePill(i)} style={{ marginLeft: 8, background: "none", border: "none", color: "var(--ink)", opacity: 0.45, cursor: "pointer" }}>✕</button>
                </span>
              ))}
              <input value={pillInput} onChange={e => setPillInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPill() } }} placeholder="Add a pill (Enter)" style={{ ...input, width: 220, padding: "4px 0" }} />
            </div>
          </div>

          <div style={{ ...sectionLabel, marginTop: 30 }}>The Idea</div>
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "flex-start" }}>
            <div>
              <label style={labelStyle}>Eyebrow</label>
              <input type="text" placeholder="The Idea" value={plan.idea_eyebrow ?? ""} onChange={e => patchPlanLocal({ idea_eyebrow: e.target.value })} style={input} />
            </div>
            <div>
              <label style={labelStyle}>Body</label>
              <textarea value={plan.idea_body ?? ""} onChange={e => patchPlanLocal({ idea_body: e.target.value })} rows={5} placeholder="The narrative paragraph that opens the document. Where you set the why before getting into the what." style={{ ...input, lineHeight: 1.55, resize: "vertical" }} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <button onClick={saveMeta} disabled={savingMeta} style={{
              ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
              background: "var(--ink)", color: "var(--cream)",
              border: "none", padding: "10px 18px", cursor: savingMeta ? "default" : "pointer",
              opacity: savingMeta ? 0.5 : 1,
            }}>
              {savingMeta ? "Saving…" : "Save cover"}
            </button>
          </div>
        </div>

        {/* SECTIONS */}
        <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={sectionLabel}>Sections — {sections.length}</div>
          <button onClick={addSection} style={addBtn}>+ Section</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {sections.map((s, idx) => (
            <SectionCard
              key={s.id}
              section={s}
              items={itemsBySection.get(s.id) ?? []}
              first={idx === 0}
              last={idx === sections.length - 1}
              onPatch={p => patchSection(s.id, p)}
              onDelete={() => deleteSection(s.id)}
              onMove={dir => moveSection(s.id, dir)}
              onAddItem={() => addItem(s.id)}
              onPatchItem={(item, p) => patchItem(item, p)}
              onDeleteItem={item => deleteItem(item)}
              onMoveItem={(item, dir) => moveItem(item, dir)}
            />
          ))}
          {sections.length === 0 && (
            <div style={{ ...serif, fontStyle: "italic", fontSize: 15, opacity: 0.5, textAlign: "center", padding: "32px 0" }}>
              No sections yet. Add your first section to start the road map.
            </div>
          )}
        </div>

        {toast && (
          <div style={{
            position: "fixed", bottom: 24, right: 24,
            ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
            background: "var(--ink)", color: "var(--cream)",
            padding: "10px 16px",
            zIndex: 1000,
          }}>
            {toast}
          </div>
        )}
      </main>
    </>
  )
}

function SectionCard({ section, items, first, last, onPatch, onDelete, onMove, onAddItem, onPatchItem, onDeleteItem, onMoveItem }: {
  section: Section
  items: Item[]
  first: boolean
  last: boolean
  onPatch: (p: Partial<Section>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onAddItem: () => void
  onPatchItem: (item: Item, p: Partial<Item>) => void
  onDeleteItem: (item: Item) => void
  onMoveItem: (item: Item, dir: -1 | 1) => void
}) {
  return (
    <div style={{ background: "rgba(255,255,255,0.35)", border: "0.5px solid rgba(15,15,14,0.1)", padding: "22px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 90px", gap: 14, alignItems: "center", marginBottom: 14 }}>
        <input defaultValue={section.number_label ?? ""} onBlur={e => onPatch({ number_label: e.target.value })} placeholder="00" style={{ ...input, ...mono, textAlign: "center" }} />
        <input defaultValue={section.title} onBlur={e => onPatch({ title: e.target.value })} placeholder="Section title" style={{ ...input, fontSize: 16 }} />
        <input defaultValue={section.aside ?? ""} onBlur={e => onPatch({ aside: e.target.value || null })} placeholder="Contents tagline (e.g. the shared kit)" style={input} />
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button onClick={() => onMove(-1)} disabled={first} style={moveBtn(first)} aria-label="Move up">↑</button>
          <button onClick={() => onMove(1)} disabled={last} style={moveBtn(last)} aria-label="Move down">↓</button>
          <button onClick={onDelete} style={{ ...mono, fontSize: 10, background: "none", border: "none", color: "var(--ink)", opacity: 0.35, cursor: "pointer", padding: "0 4px" }}>✕</button>
        </div>
      </div>
      <input defaultValue={section.lede ?? ""} onBlur={e => onPatch({ lede: e.target.value || null })} placeholder="Italic lede (one-line note that sits under the section title)" style={{ ...input, ...serif, fontStyle: "italic", marginBottom: 18 }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.55 }}>Items · {items.length}</div>
        <button onClick={onAddItem} style={addBtn}>+ Item</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it, idx) => (
          <ItemRow
            key={it.id}
            item={it}
            first={idx === 0}
            last={idx === items.length - 1}
            onPatch={p => onPatchItem(it, p)}
            onDelete={() => onDeleteItem(it)}
            onMove={dir => onMoveItem(it, dir)}
          />
        ))}
        {items.length === 0 && (
          <div style={{ ...sans, fontSize: 13, opacity: 0.45, padding: "8px 0", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
            No items yet.
          </div>
        )}
      </div>
    </div>
  )
}

function ItemRow({ item, first, last, onPatch, onDelete, onMove }: {
  item: Item; first: boolean; last: boolean
  onPatch: (p: Partial<Item>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const [estDollars, setEstDollars] = useState(item.estimate_cents != null ? String(item.estimate_cents / 100) : "")
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.9fr 100px 95px 92px 84px", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "0.5px solid rgba(15,15,14,0.06)" }}>
      <input defaultValue={item.title} onBlur={e => onPatch({ title: e.target.value })} placeholder="Item title" style={input} />
      <input defaultValue={item.description ?? ""} onBlur={e => onPatch({ description: e.target.value || null })} placeholder="— short description after an em-dash" style={input} />
      <input
        type="number"
        value={estDollars}
        onChange={e => setEstDollars(e.target.value)}
        onBlur={e => {
          const v = e.target.value.trim()
          const cents = v === "" ? null : Math.round(parseFloat(v) * 100)
          onPatch({ estimate_cents: Number.isFinite(cents as number) ? cents : null })
        }}
        placeholder="Est. $"
        style={{ ...input, ...mono, textAlign: "right" }}
      />
      <input
        defaultValue={item.estimate_note ?? ""}
        onBlur={e => onPatch({ estimate_note: e.target.value || null })}
        placeholder="(if no $)"
        style={{ ...input, ...mono, fontSize: 11, opacity: 0.85 }}
      />
      <PriorityCycler value={item.priority ?? null} onChange={p => onPatch({ priority: p })} />
      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button onClick={() => onMove(-1)} disabled={first} style={moveBtn(first)} aria-label="Up">↑</button>
        <button onClick={() => onMove(1)} disabled={last} style={moveBtn(last)} aria-label="Down">↓</button>
        <button onClick={onDelete} style={{ ...mono, fontSize: 10, background: "none", border: "none", color: "var(--ink)", opacity: 0.35, cursor: "pointer", padding: "0 4px" }}>✕</button>
      </div>
    </div>
  )
}

function CoverImagePicker({ currentUrl, onUpload, onClear }: { currentUrl: string | null; onUpload: (f: File) => void; onClear: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {currentUrl && (
        <img src={currentUrl} alt="cover" style={{ width: 70, height: 50, objectFit: "contain", background: "rgba(28,25,22,0.04)", border: "0.5px solid rgba(15,15,14,0.1)" }} />
      )}
      <button onClick={() => ref.current?.click()} style={addBtn}>
        {currentUrl ? "Replace image" : "Upload image"}
      </button>
      {currentUrl && (
        <button onClick={onClear} style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", background: "none", border: "none", color: "var(--ink)", opacity: 0.45, cursor: "pointer" }}>
          Clear
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = "" }} />
    </div>
  )
}

const PRIORITY_LABELS: Record<"now" | "next" | "later", string> = { now: "In Motion", next: "On Deck", later: "Parked" }

function PriorityCycler({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  const next: Record<string, Priority> = { "null": "now", "now": "next", "next": "later", "later": null }
  const label = value ? PRIORITY_LABELS[value] : "—"
  const opacity = value === "now" ? 1 : value === "next" ? 0.7 : value === "later" ? 0.4 : 0.3
  return (
    <button
      type="button"
      onClick={() => onChange(next[value ?? "null"])}
      title="Cycle priority: In Motion → On Deck → Parked → none"
      style={{
        ...mono, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
        padding: "5px 6px",
        background: value ? "rgba(28,25,22,0.04)" : "transparent",
        border: "0.5px solid rgba(28,25,22,0.18)",
        color: "var(--ink)", opacity,
        cursor: "pointer", textAlign: "center",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  )
}

function moveBtn(disabled: boolean): React.CSSProperties {
  return {
    ...mono, fontSize: 11,
    background: "transparent", border: "0.5px solid rgba(15,15,14,0.15)",
    padding: "2px 8px", cursor: disabled ? "default" : "pointer",
    color: "var(--ink)", opacity: disabled ? 0.2 : 0.55,
  }
}
