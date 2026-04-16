"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

const SECTION_TYPES = [
  { value: "cover", label: "Cover" },
  { value: "purpose", label: "Brand Purpose" },
  { value: "philosophy", label: "Philosophy" },
  { value: "moodboard", label: "Moodboard" },
  { value: "summary", label: "Summary" },
  { value: "next_steps", label: "Next Steps" },
] as const

const GRID_LAYOUTS = [
  { value: "tall-sides", label: "Tall sides", desc: "2 tall panels on sides, 2 smaller center" },
  { value: "tall-left", label: "Tall left", desc: "1 tall left, 4 smaller right" },
  { value: "tall-center", label: "Tall center", desc: "1 tall center, 4 corners" },
  { value: "grid-2x3", label: "Grid 2×3", desc: "Even 2 rows × 3 columns" },
  { value: "tall-left-bottom-span", label: "Tall left + span", desc: "1 tall left, 3 right with bottom span" },
]

type SectionType = typeof SECTION_TYPES[number]["value"]

interface FoundationSection {
  id?: string
  section_type: SectionType
  background: "dark" | "light"
  sort_order: number
  content: Record<string, any>
  _collapsed?: boolean
  _deleted?: boolean
}

function defaultContent(type: SectionType): Record<string, any> {
  switch (type) {
    case "cover": return { client_name: "", subtitle: "Brand Foundations", date: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }), version: "" }
    case "purpose": return { label: "Brand Purpose", statement: "" }
    case "philosophy": return { title: "", body: "", traits_title: "Core Brand Traits", traits: [], image_url: "" }
    case "moodboard": return { trait_name: "", descriptor: "", layout: "tall-left", images: [] }
    case "summary": return { closing_statement: "", recap_title: "", recap_body: "", closing_line: "" }
    case "next_steps": return { intro: "", steps: [{ title: "", bullets: [""] }] }
    default: return {}
  }
}

export default function EditFoundationPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [foundation, setFoundation] = useState<any>(null)
  const [sections, setSections] = useState<FoundationSection[]>([])
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  const [form, setForm] = useState({ title: "", status: "draft" })

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Client picker state
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [showClientPicker, setShowClientPicker] = useState<"reassign" | "duplicate" | null>(null)
  const [pickerBusy, setPickerBusy] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: f } = await supabase
        .from("brand_foundations")
        .select("*, clients(id, name, contact_name)")
        .eq("id", params.id)
        .single()

      if (!f) { setLoading(false); return }
      setFoundation(f)
      setForm({ title: f.title ?? "", status: f.status ?? "draft" })

      const { data: s } = await supabase
        .from("brand_foundation_sections")
        .select("*")
        .eq("foundation_id", params.id)
        .order("sort_order")

      setSections((s ?? []).map((sec: any) => ({ ...sec, _collapsed: true })))

      const { data: clientList } = await supabase
        .from("clients")
        .select("id, name")
        .order("name")
      setClients(clientList ?? [])

      setLoading(false)
    }
    load()
  }, [params.id])

  function setField(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function updateSection(index: number, updates: Partial<FoundationSection>) {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s))
  }

  function updateContent(index: number, key: string, value: any) {
    setSections(prev => prev.map((s, i) =>
      i === index ? { ...s, content: { ...s.content, [key]: value } } : s
    ))
  }

  function addSection(type: SectionType) {
    setSections(prev => [...prev, {
      section_type: type,
      background: type === "cover" || type === "purpose" || type === "philosophy" ? "dark" : "light",
      sort_order: prev.length,
      content: defaultContent(type),
    }])
  }

  function removeSection(index: number) {
    if (!confirm("Remove this section?")) return
    const section = sections[index]
    if (section.id) {
      // Mark existing DB section as deleted
      setSections(prev => prev.map((s, i) => i === index ? { ...s, _deleted: true } : s))
    } else {
      setSections(prev => prev.filter((_, i) => i !== index))
    }
  }

  function handleDragStart(index: number) { setDragIndex(index) }
  function handleDragOver(e: React.DragEvent, index: number) { e.preventDefault(); setDragOverIndex(index) }
  function handleDragEnd() { setDragIndex(null); setDragOverIndex(null) }
  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { handleDragEnd(); return }
    setSections(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next.map((s, i) => ({ ...s, sort_order: i }))
    })
    handleDragEnd()
  }

  async function uploadImage(file: File, sectionIndex: number, imageKey: string, imageIndex?: number) {
    const ext = file.name.split(".").pop()
    const path = `foundations/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from("brand-assets").upload(path, file)
    if (error) { alert("Upload failed: " + error.message); return }
    const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path)
    const url = urlData.publicUrl

    if (imageIndex !== undefined) {
      setSections(prev => prev.map((s, i) => {
        if (i !== sectionIndex) return s
        const images = [...(s.content.images ?? [])]
        images[imageIndex] = url
        return { ...s, content: { ...s.content, images } }
      }))
    } else {
      updateContent(sectionIndex, imageKey, url)
    }
  }

  async function handleSave(status?: string) {
    setSaving(true)
    const saveStatus = status ?? form.status

    // Update foundation metadata
    await supabase.from("brand_foundations").update({
      title: form.title,
      status: saveStatus,
    }).eq("id", params.id)

    // Delete removed sections
    const deletedIds = sections.filter(s => s._deleted && s.id).map(s => s.id!)
    if (deletedIds.length > 0) {
      await supabase.from("brand_foundation_sections").delete().in("id", deletedIds)
    }

    // Active sections (not deleted)
    const activeSections = sections.filter(s => !s._deleted)

    // Update existing sections
    for (const s of activeSections.filter(s => s.id)) {
      await supabase.from("brand_foundation_sections").update({
        section_type: s.section_type,
        background: s.background,
        sort_order: activeSections.indexOf(s),
        content: s.content,
      }).eq("id", s.id!)
    }

    // Insert new sections
    const newSections = activeSections.filter(s => !s.id)
    let inserted: any[] | null = null
    if (newSections.length > 0) {
      const rows = newSections.map((s) => ({
        foundation_id: params.id,
        section_type: s.section_type,
        background: s.background,
        sort_order: activeSections.indexOf(s),
        content: s.content,
      }))
      const { data } = await supabase.from("brand_foundation_sections").insert(rows).select()
      inserted = data
    }

    // Merge IDs back into state AND clean up deleted in a single pure updater.
    // Combining avoids double-setState timing issues, and declaring insertIdx
    // inside the updater keeps it pure under React Strict Mode (which may invoke
    // the updater twice to detect impurity).
    setSections(prev => {
      let insertIdx = 0
      return prev
        .filter(s => !s._deleted)
        .map(s => {
          if (s.id) return s
          const withId = { ...s, id: inserted?.[insertIdx]?.id }
          insertIdx++
          return withId
        })
    })

    setForm(f => ({ ...f, status: saveStatus }))
    setLastSaved(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }))
    setSaving(false)
  }

  /* ─── Reassign to a different client ─── */
  async function handleReassign(newClientId: string) {
    if (newClientId === foundation.client_id) { setShowClientPicker(null); return }
    const target = clients.find(c => c.id === newClientId)
    if (!target) return
    if (!confirm(`Move this foundation to "${target.name}"? It will no longer appear under ${foundation.clients?.name ?? "the current client"}.`)) return

    setPickerBusy(true)
    const { error } = await supabase
      .from("brand_foundations")
      .update({ client_id: newClientId })
      .eq("id", params.id)

    if (error) { alert("Move failed: " + error.message); setPickerBusy(false); return }

    // Refresh the in-memory foundation + client label
    setFoundation((prev: any) => ({ ...prev, client_id: newClientId, clients: { id: target.id, name: target.name } }))

    // Also update any cover section's client_name if it's blank or matches the old client name
    const oldClientName = foundation.clients?.name
    setSections(prev => prev.map(s => {
      if (s.section_type !== "cover") return s
      const current = s.content?.client_name ?? ""
      if (!current || current === oldClientName) {
        return { ...s, content: { ...s.content, client_name: target.name } }
      }
      return s
    }))

    setShowClientPicker(null)
    setPickerBusy(false)
    setLastSaved("Moved to " + target.name)
    setTimeout(() => setLastSaved(null), 3000)
  }

  /* ─── Duplicate to another client ─── */
  async function handleDuplicate(targetClientId: string) {
    const target = clients.find(c => c.id === targetClientId)
    if (!target) return

    setPickerBusy(true)

    // 1. Create new foundation row
    const { data: newFound, error: fErr } = await (supabase.from("brand_foundations") as any)
      .insert({
        client_id: targetClientId,
        title: `${form.title || "Untitled"} (Copy)`,
        status: "draft",
      })
      .select()
      .single()

    if (fErr || !newFound) { alert("Duplicate failed: " + (fErr?.message ?? "unknown")); setPickerBusy(false); return }

    // 2. Copy all active sections
    const sectionRows = sections
      .filter(s => !s._deleted)
      .map((s, i) => {
        // If cover, swap the client_name to the target client's name
        let content = s.content
        if (s.section_type === "cover") {
          content = { ...content, client_name: target.name }
        }
        return {
          foundation_id: newFound.id,
          section_type: s.section_type,
          background: s.background,
          sort_order: i,
          content,
        }
      })

    if (sectionRows.length > 0) {
      const { error: sErr } = await supabase.from("brand_foundation_sections").insert(sectionRows)
      if (sErr) { alert("Duplicate failed while copying sections: " + sErr.message); setPickerBusy(false); return }
    }

    setShowClientPicker(null)
    setPickerBusy(false)
    // Navigate to the new foundation's edit page
    router.push(`/admin/foundations/${newFound.id}/edit`)
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
        <PortalNav />
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 40px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", opacity: 0.4 }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (!foundation) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
        <PortalNav />
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 40px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", opacity: 0.4 }}>Not found</div>
        </div>
      </div>
    )
  }

  const activeSections = sections.filter(s => !s._deleted)
  const isApproved = foundation.status === "approved"

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <PortalNav />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 40px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Link href={`/admin/clients/${foundation.client_id}`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.4, textDecoration: "none" }}>
                ← {foundation.clients?.name ?? "Back"}
              </Link>
              <button
                onClick={() => setShowClientPicker("reassign")}
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: "0.5px solid rgba(15,15,14,0.15)", padding: "3px 8px", cursor: "pointer", color: "var(--ink)", opacity: 0.55 }}
                title="Move this foundation to a different client"
              >
                Move
              </button>
              <button
                onClick={() => setShowClientPicker("duplicate")}
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: "0.5px solid rgba(15,15,14,0.15)", padding: "3px 8px", cursor: "pointer", color: "var(--ink)", opacity: 0.55 }}
                title="Duplicate this foundation to another client"
              >
                Duplicate
              </button>
            </div>
            <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 400, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>
              {form.title || "Untitled"}
            </h1>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: isApproved ? "var(--sage)" : form.status === "in_review" ? "var(--amber)" : "rgba(15,15,14,0.35)",
              }}>
                {isApproved ? "Approved" : form.status === "in_review" ? "In review" : "Draft"}
              </span>
              {lastSaved && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.35 }}>
                  {lastSaved.startsWith("Moved") || lastSaved.startsWith("Link") ? lastSaved : `Saved ${lastSaved}`}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href={`/foundations/${params.id}`} target="_blank" style={{ ...btnSecondary, textDecoration: "none", display: "inline-block" }}>
              Preview ↗
            </Link>
            <button onClick={() => handleSave()} disabled={saving} style={btnSecondary}>
              {saving ? "Saving..." : "Save"}
            </button>
            {form.status === "draft" && (
              <button onClick={() => handleSave("in_review")} disabled={saving} style={btnPrimary}>
                Publish
              </button>
            )}
            <button onClick={async () => {
              const url = `${window.location.origin}/foundations/${params.id}`
              await navigator.clipboard.writeText(url)
              setLastSaved("Link copied!")
              setTimeout(() => setLastSaved(null), 2000)
            }} style={{ ...btnSecondary, padding: "10px 14px" }}>
              Copy link
            </button>
          </div>
        </div>

        {/* Approved banner */}
        {isApproved && (
          <div style={{
            background: "rgba(143,167,181,0.08)", border: "0.5px solid rgba(143,167,181,0.2)",
            padding: "12px 16px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.7 }}>
                Approved by {foundation.approved_by ?? "client"}
              </span>
              {foundation.approved_at && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.4, marginLeft: 12 }}>
                  {new Date(foundation.approved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
            {foundation.approval_note && (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.5, fontStyle: "italic" }}>
                &ldquo;{foundation.approval_note}&rdquo;
              </span>
            )}
          </div>
        )}

        {/* Title field */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Title</label>
          <input value={form.title} onChange={e => setField("title", e.target.value)} style={inputStyle} />
        </div>

        {/* Sections */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 16 }}>
            Sections ({activeSections.length})
          </div>

          {activeSections.map((section, idx) => {
            // Get the actual index in the full array (including deleted)
            const realIdx = sections.indexOf(section)
            return (
              <div
                key={section.id ?? `new-${idx}`}
                draggable
                onDragStart={() => handleDragStart(realIdx)}
                onDragOver={e => handleDragOver(e, realIdx)}
                onDragEnd={handleDragEnd}
                onDrop={() => handleDrop(realIdx)}
                style={{
                  border: dragOverIndex === realIdx ? "1px solid var(--amber)" : "0.5px solid rgba(15,15,14,0.1)",
                  background: dragIndex === realIdx ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)",
                  marginBottom: 8,
                  opacity: dragIndex === realIdx ? 0.5 : 1,
                  transition: "all 0.15s",
                }}
              >
                {/* Section header */}
                <div
                  style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "grab", userSelect: "none" }}
                  onClick={() => updateSection(realIdx, { _collapsed: !section._collapsed })}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.25, cursor: "grab" }}>⠿</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.7 }}>
                      {SECTION_TYPES.find(t => t.value === section.section_type)?.label ?? section.section_type}
                    </span>
                    {section.section_type === "moodboard" && section.content.trait_name && (
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.4 }}>
                        — {section.content.trait_name}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={e => { e.stopPropagation(); updateSection(realIdx, { background: section.background === "dark" ? "light" : "dark" }) }}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", background: section.background === "dark" ? "var(--ink)" : "rgba(255,255,255,0.6)", color: section.background === "dark" ? "var(--cream)" : "var(--ink)", border: "0.5px solid rgba(15,15,14,0.15)", padding: "3px 8px", cursor: "pointer", opacity: 0.7 }}>
                      {section.background}
                    </button>
                    <button onClick={e => { e.stopPropagation(); removeSection(realIdx) }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink)", opacity: 0.3, fontSize: 14, padding: "2px 4px" }}>✕</button>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.3 }}>{section._collapsed ? "▸" : "▾"}</span>
                  </div>
                </div>

                {/* Section content */}
                {!section._collapsed && (
                  <div style={{ padding: "0 16px 16px", borderTop: "0.5px solid rgba(15,15,14,0.06)" }}>
                    <SectionEditor section={section} index={realIdx} updateContent={updateContent} uploadImage={uploadImage} />
                  </div>
                )}
              </div>
            )
          })}

          {/* Add section */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {SECTION_TYPES.map(t => (
              <button key={t.value} onClick={() => addSection(t.value)} style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase",
                background: "none", border: "0.5px dashed rgba(15,15,14,0.2)", padding: "7px 12px",
                cursor: "pointer", color: "var(--ink)", opacity: 0.5,
              }}>
                + {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom save */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 24, borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
          <button onClick={() => handleSave()} disabled={saving} style={btnSecondary}>
            {saving ? "Saving..." : "Save"}
          </button>
          {form.status === "draft" && (
            <button onClick={() => handleSave("in_review")} disabled={saving} style={btnPrimary}>
              Publish
            </button>
          )}
        </div>
      </div>

      {/* Client picker modal (Move / Duplicate) */}
      {showClientPicker && (
        <div
          onClick={() => !pickerBusy && setShowClientPicker(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(15,15,14,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--cream)",
              border: "0.5px solid rgba(15,15,14,0.15)",
              maxWidth: 440, width: "100%", maxHeight: "80vh",
              display: "flex", flexDirection: "column",
              padding: 24,
            }}
          >
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, marginBottom: 6 }}>
                {showClientPicker === "reassign" ? "Move to client" : "Duplicate to client"}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.6, marginBottom: 16 }}>
                {showClientPicker === "reassign"
                  ? "Choose a different client to move this foundation under."
                  : "Creates a copy (with all sections + images) under the selected client as a new draft."}
              </div>
            </div>
            <div style={{ overflow: "auto", flex: 1, border: "0.5px solid rgba(15,15,14,0.1)" }}>
              {clients.length === 0 && (
                <div style={{ padding: 16, fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.4 }}>No clients found.</div>
              )}
              {clients.map(c => {
                const isCurrent = c.id === foundation.client_id
                const disabled = pickerBusy || (showClientPicker === "reassign" && isCurrent)
                return (
                  <button
                    key={c.id}
                    disabled={disabled}
                    onClick={() => showClientPicker === "reassign" ? handleReassign(c.id) : handleDuplicate(c.id)}
                    style={{
                      width: "100%", textAlign: "left",
                      fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                      background: "none", border: "none",
                      borderBottom: "0.5px solid rgba(15,15,14,0.06)",
                      padding: "12px 14px", cursor: disabled ? "default" : "pointer",
                      color: "var(--ink)", opacity: disabled ? 0.35 : 1,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                    onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = "rgba(15,15,14,0.04)" }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none" }}
                  >
                    <span>{c.name}</span>
                    {isCurrent && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4 }}>
                        Current
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => !pickerBusy && setShowClientPicker(null)} disabled={pickerBusy} style={btnSecondary}>
                {pickerBusy ? "Working..." : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


/* ═══════════════════════════════════════════
   SECTION EDITOR (shared with new page)
   ═══════════════════════════════════════════ */

function SectionEditor({ section, index, updateContent, uploadImage }: {
  section: FoundationSection; index: number
  updateContent: (i: number, key: string, value: any) => void
  uploadImage: (file: File, sectionIndex: number, imageKey: string, imageIndex?: number) => void
}) {
  const c = section.content

  switch (section.section_type) {
    case "cover":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 12 }}>
          <div>
            <label style={labelStyle}>Client name</label>
            <input value={c.client_name ?? ""} onChange={e => updateContent(index, "client_name", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Subtitle</label>
            <input value={c.subtitle ?? ""} onChange={e => updateContent(index, "subtitle", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input value={c.date ?? ""} onChange={e => updateContent(index, "date", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Version</label>
            <input value={c.version ?? ""} onChange={e => updateContent(index, "version", e.target.value)} style={inputStyle} placeholder="e.g. V1" />
          </div>
        </div>
      )

    case "purpose":
      return (
        <div style={{ paddingTop: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Section label</label>
            <input value={c.label ?? ""} onChange={e => updateContent(index, "label", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Purpose statement</label>
            <textarea value={c.statement ?? ""} onChange={e => updateContent(index, "statement", e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="Use *asterisks* for italic emphasis" />
          </div>
        </div>
      )

    case "philosophy":
      return (
        <div style={{ paddingTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input value={c.title ?? ""} onChange={e => updateContent(index, "title", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Traits heading</label>
              <input value={c.traits_title ?? ""} onChange={e => updateContent(index, "traits_title", e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Body</label>
            <textarea value={c.body ?? ""} onChange={e => updateContent(index, "body", e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Traits (one per line)</label>
            <textarea
              value={(c.traits ?? []).join("\n")}
              onChange={e => updateContent(index, "traits", e.target.value.split("\n"))}
              rows={4} style={{ ...inputStyle, resize: "vertical" }}
              placeholder={"Community & Lifestyle\nWarm & Inviting\nTimeless & Classic"}
            />
          </div>
          <div>
            <label style={labelStyle}>Image {c.image_url && <span style={{ opacity: 0.5, textTransform: "none", letterSpacing: 0 }}>— click to set focal point</span>}</label>
            {c.image_url ? (
              <div style={{ width: 200 }}>
                <FocalImage
                  src={c.image_url}
                  focal={c.image_focal}
                  onFocalChange={(f) => updateContent(index, "image_focal", f)}
                  onReplace={(file) => uploadImage(file, index, "image_url")}
                  aspectRatio="3/4"
                />
              </div>
            ) : (
              <label style={uploadBtnStyle}>
                Upload
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                  if (e.target.files?.[0]) uploadImage(e.target.files[0], index, "image_url")
                  e.target.value = ""
                }} />
              </label>
            )}
          </div>
        </div>
      )

    case "moodboard":
      return <MoodboardEditor content={c} index={index} updateContent={updateContent} uploadImage={uploadImage} />

    case "summary":
      return (
        <div style={{ paddingTop: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Closing statement</label>
            <textarea value={c.closing_statement ?? ""} onChange={e => updateContent(index, "closing_statement", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Main closing paragraph above the circle" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Recap title (in circle)</label>
              <input value={c.recap_title ?? ""} onChange={e => updateContent(index, "recap_title", e.target.value)} style={inputStyle} placeholder="e.g. Defining the Future" />
            </div>
            <div>
              <label style={labelStyle}>Recap body (in circle)</label>
              <textarea value={c.recap_body ?? ""} onChange={e => updateContent(index, "recap_body", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Short recap — keep it brief for the circle" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Closing line (italic, below thumbnails)</label>
            <input value={c.closing_line ?? ""} onChange={e => updateContent(index, "closing_line", e.target.value)} style={inputStyle} placeholder="From here, we move into refinement..." />
          </div>
        </div>
      )

    case "next_steps":
      return <NextStepsEditor content={c} index={index} updateContent={updateContent} />

    default:
      return <div style={{ padding: "12px 0", opacity: 0.4 }}>Unknown section type</div>
  }
}


/* ─── Focal point editor ─── */
/* Click the image to set the focal point; shown as a crosshair dot.
   Replace uses the small ↻ button in the corner. */

function FocalImage({
  src, focal, onFocalChange, onReplace, aspectRatio = "1",
}: {
  src: string
  focal?: { x?: number; y?: number } | null
  onFocalChange: (focal: { x: number; y: number }) => void
  onReplace: (file: File) => void
  aspectRatio?: string
}) {
  const x = typeof focal?.x === "number" ? focal.x : 50
  const y = typeof focal?.y === "number" ? focal.y : 50

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const py = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    onFocalChange({ x: Math.round(px), y: Math.round(py) })
  }

  return (
    <div
      onClick={handleClick}
      style={{
        position: "relative", width: "100%", aspectRatio,
        cursor: "crosshair", overflow: "hidden", borderRadius: 2,
      }}
      title="Click to set focal point"
    >
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${x}% ${y}%`, display: "block", pointerEvents: "none" }} />
      {/* Crosshair dot */}
      <div style={{
        position: "absolute", left: `${x}%`, top: `${y}%`,
        width: 14, height: 14, transform: "translate(-50%, -50%)",
        borderRadius: "50%", background: "rgba(255,255,255,0.95)",
        border: "2px solid rgba(15,15,14,0.85)", boxShadow: "0 0 0 1px rgba(255,255,255,0.6)",
        pointerEvents: "none",
      }} />
      {/* Replace button (top-right corner) */}
      <label
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute", top: 4, right: 4,
          width: 22, height: 22, borderRadius: "50%",
          background: "rgba(255,255,255,0.9)", border: "0.5px solid rgba(15,15,14,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink)",
        }}
        title="Replace image"
      >
        ↻
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
          if (e.target.files?.[0]) onReplace(e.target.files[0])
          e.target.value = ""
        }} />
      </label>
    </div>
  )
}


/* ─── Moodboard editor ─── */

function MoodboardEditor({ content, index, updateContent, uploadImage }: {
  content: any; index: number
  updateContent: (i: number, key: string, value: any) => void
  uploadImage: (file: File, sectionIndex: number, imageKey: string, imageIndex?: number) => void
}) {
  const images: string[] = content.images ?? []
  const layout = content.layout ?? "tall-left"

  const GRID_AREAS: Record<string, number> = {
    "tall-sides": 4, "tall-left": 5, "tall-center": 5, "grid-2x3": 6, "tall-left-bottom-span": 4,
  }
  const slotCount = GRID_AREAS[layout] ?? 5

  return (
    <div style={{ paddingTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Trait name</label>
          <input value={content.trait_name ?? ""} onChange={e => updateContent(index, "trait_name", e.target.value)} style={inputStyle} placeholder="e.g. Warm & Inviting" />
        </div>
        <div>
          <label style={labelStyle}>Descriptor</label>
          <input value={content.descriptor ?? ""} onChange={e => updateContent(index, "descriptor", e.target.value)} style={inputStyle} placeholder="Short italic description" />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Grid layout</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {GRID_LAYOUTS.map(l => (
            <button
              key={l.value}
              onClick={() => updateContent(index, "layout", l.value)}
              title={l.desc}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.06em",
                background: layout === l.value ? "var(--ink)" : "rgba(255,255,255,0.4)",
                color: layout === l.value ? "var(--cream)" : "var(--ink)",
                border: "0.5px solid rgba(15,15,14,0.15)", padding: "5px 10px",
                cursor: "pointer", textTransform: "uppercase",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle}>
          Images ({slotCount} slots) <span style={{ opacity: 0.5, textTransform: "none", letterSpacing: 0 }}>— click ★ to mark summary thumbnail</span>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(slotCount, 6)}, 1fr)`, gap: 8 }}>
          {Array.from({ length: slotCount }).map((_, i) => {
            const summaryIdx = typeof content.summary_image_index === "number" ? content.summary_image_index : 0
            const isSummary = images[i] && summaryIdx === i
            return (
              <div key={i} style={{ position: "relative" }}>
                {images[i] ? (
                  <>
                    <FocalImage
                      src={images[i]}
                      focal={(content.image_focals ?? [])[i]}
                      onFocalChange={(f) => {
                        const next = [...(content.image_focals ?? [])]
                        next[i] = f
                        updateContent(index, "image_focals", next)
                      }}
                      onReplace={(file) => uploadImage(file, index, "images", i)}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); updateContent(index, "summary_image_index", i) }}
                      title={isSummary ? "Summary thumbnail" : "Use as summary thumbnail"}
                      style={{
                        position: "absolute", top: 4, left: 4,
                        width: 22, height: 22, borderRadius: "50%",
                        background: isSummary ? "var(--ink)" : "rgba(255,255,255,0.9)",
                        color: isSummary ? "var(--cream)" : "var(--ink)",
                        border: "0.5px solid rgba(15,15,14,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", fontSize: 11, lineHeight: 1, padding: 0,
                        opacity: isSummary ? 1 : 0.85,
                      }}
                    >
                      ★
                    </button>
                  </>
                ) : (
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", aspectRatio: "1", background: "rgba(15,15,14,0.04)", border: "1px dashed rgba(15,15,14,0.12)", borderRadius: 2, cursor: "pointer" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.3 }}>{i + 1}</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                      if (e.target.files?.[0]) uploadImage(e.target.files[0], index, "images", i)
                      e.target.value = ""
                    }} />
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


/* ─── Next Steps editor ─── */

function NextStepsEditor({ content, index, updateContent }: {
  content: any; index: number
  updateContent: (i: number, key: string, value: any) => void
}) {
  const steps: { title: string; bullets: string[] }[] = content.steps ?? []

  function updateStep(stepIdx: number, field: string, value: any) {
    const next = steps.map((s, i) => i === stepIdx ? { ...s, [field]: value } : s)
    updateContent(index, "steps", next)
  }

  function addStep() {
    updateContent(index, "steps", [...steps, { title: "", bullets: [""] }])
  }

  function removeStep(stepIdx: number) {
    updateContent(index, "steps", steps.filter((_, i) => i !== stepIdx))
  }

  function addBullet(stepIdx: number) {
    const next = steps.map((s, i) => i === stepIdx ? { ...s, bullets: [...s.bullets, ""] } : s)
    updateContent(index, "steps", next)
  }

  function updateBullet(stepIdx: number, bulletIdx: number, value: string) {
    const next = steps.map((s, i) =>
      i === stepIdx ? { ...s, bullets: s.bullets.map((b, j) => j === bulletIdx ? value : b) } : s
    )
    updateContent(index, "steps", next)
  }

  function removeBullet(stepIdx: number, bulletIdx: number) {
    const next = steps.map((s, i) =>
      i === stepIdx ? { ...s, bullets: s.bullets.filter((_, j) => j !== bulletIdx) } : s
    )
    updateContent(index, "steps", next)
  }

  return (
    <div style={{ paddingTop: 12 }}>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Intro text</label>
        <textarea value={content.intro ?? ""} onChange={e => updateContent(index, "intro", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      {steps.map((step, si) => (
        <div key={si} style={{ border: "0.5px solid rgba(15,15,14,0.08)", padding: 12, marginBottom: 8, background: "rgba(255,255,255,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Step {si + 1}</label>
            {steps.length > 1 && (
              <button onClick={() => removeStep(si)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink)", opacity: 0.3, fontSize: 12 }}>✕</button>
            )}
          </div>
          <input value={step.title} onChange={e => updateStep(si, "title", e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} placeholder="Step title" />
          {step.bullets.map((bullet, bi) => (
            <div key={bi} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.3, paddingTop: 8 }}>▸</span>
              <input value={bullet} onChange={e => updateBullet(si, bi, e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Bullet point" />
              {step.bullets.length > 1 && (
                <button onClick={() => removeBullet(si, bi)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink)", opacity: 0.25, fontSize: 11 }}>✕</button>
              )}
            </div>
          ))}
          <button onClick={() => addBullet(si)} style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", color: "var(--ink)", opacity: 0.35, padding: "4px 0" }}>
            + Bullet
          </button>
        </div>
      ))}
      <button onClick={addStep} style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", background: "none", border: "0.5px dashed rgba(15,15,14,0.15)", cursor: "pointer", color: "var(--ink)", opacity: 0.45, padding: "8px 14px", width: "100%" }}>
        + Add Step
      </button>
    </div>
  )
}


/* ─── Styles ─── */

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
  letterSpacing: "0.12em", textTransform: "uppercase",
  opacity: 0.45, marginBottom: 6, display: "block",
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
  background: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(15,15,14,0.12)",
  padding: "9px 12px", color: "var(--ink)", outline: "none",
}

const uploadBtnStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
  letterSpacing: "0.1em", textTransform: "uppercase",
  border: "0.5px solid rgba(15,15,14,0.2)", padding: "7px 14px",
  cursor: "pointer", color: "var(--ink)", opacity: 0.5,
  display: "inline-block",
}

const btnPrimary: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
  letterSpacing: "0.12em", textTransform: "uppercase",
  background: "var(--ink)", color: "var(--cream)",
  border: "none", padding: "10px 20px", cursor: "pointer",
}

const btnSecondary: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
  letterSpacing: "0.12em", textTransform: "uppercase",
  background: "none", color: "var(--ink)",
  border: "0.5px solid rgba(15,15,14,0.2)", padding: "10px 20px", cursor: "pointer",
  opacity: 0.6,
}
