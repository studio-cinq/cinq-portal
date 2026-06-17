"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import PortalNav from "@/components/portal/Nav"

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" }
const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" }

const sectionLabel: React.CSSProperties = {
  ...mono,
  fontSize: "var(--text-eyebrow)",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  opacity: 0.5,
  marginBottom: 14,
}

type Asset = { id: string; name: string; file_url: string; file_type: string; file_size_bytes?: number; category: string; sort_order: number; description?: string | null; usage?: string | null; primary_use?: string | null; available_color_ids?: string[] | null; color_id?: string | null }
type Color = { id: string; name: string; hex: string; sort_order: number; rgb?: string | null; usage_note?: string | null }
type Typeface = { id: string; name: string; weight?: string | null; role?: string | null; file_url?: string | null; sort_order: number; sample_text?: string | null; weights_note?: string | null }
type MisuseRule = { tag: string; note: string }
type Kit = {
  id?: string
  project_id?: string
  eyebrow?: string | null
  lede?: string | null
  meta_lines?: string[] | null
  version?: string | null
  kit_header?: string | null
  marks_intro?: string | null
  color_intro?: string | null
  type_intro?: string | null
  misuse_rules?: MisuseRule[] | null
}

const CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: "logo",        label: "Marks",       hint: "Logo files — primary, reversed, monogram. SVG / PDF / PNG. Group same logo across multiple formats by using the SAME filename." },
  { key: "guidelines",  label: "Guidelines",  hint: "Brand guideline PDFs, usage docs." },
  { key: "source",      label: "Source files", hint: "Editable source — AI, INDD, FIG, etc." },
  { key: "other",       label: "Other",       hint: "Anything else worth keeping with the kit." },
]

function fileSize(bytes?: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isLight(hex: string): boolean {
  const h = (hex ?? "").replace("#", "").trim()
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65
}

function hexToRgb(hex: string): string {
  const h = (hex ?? "").replace("#", "").trim()
  if (h.length !== 6) return ""
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

export default function AdminProjectBrandKitPage({ params }: { params: { id: string } }) {
  const projectId = params.id
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [savingKit, setSavingKit] = useState(false)

  const [assets, setAssets] = useState<Asset[]>([])
  const [colors, setColors] = useState<Color[]>([])
  const [typefaces, setTypefaces] = useState<Typeface[]>([])
  const [kit, setKit] = useState<Kit>({})

  const [colorForm, setColorForm] = useState({ name: "", hex: "#" })
  const [typeForm, setTypeForm] = useState({ name: "", weight: "", role: "" })
  const [typeFile, setTypeFile] = useState<File | null>(null)
  const [metaInput, setMetaInput] = useState("")
  const [misuseInput, setMisuseInput] = useState({ tag: "", note: "" })
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [proj, a, c, t, k] = await Promise.all([
        supabase.from("projects").select("id, title, clients(name)").eq("id", projectId).single(),
        supabase.from("brand_assets").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("color_swatches").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("typeface_entries").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("brand_kits").select("*").eq("project_id", projectId).maybeSingle(),
      ])
      if (cancelled) return
      setProject(proj.data)
      setAssets((a.data ?? []) as Asset[])
      setColors((c.data ?? []) as Color[])
      setTypefaces((t.data ?? []) as Typeface[])
      const kitData = (k.data ?? {}) as Kit
      // Migrate from legacy fields if any
      setKit({
        ...kitData,
        meta_lines: Array.isArray(kitData.meta_lines) ? kitData.meta_lines : [],
        misuse_rules: Array.isArray(kitData.misuse_rules) ? kitData.misuse_rules : [],
      })
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [projectId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  // ─── Kit-level save (cover + section intros + misuse) ─────────
  async function saveKit() {
    setSavingKit(true)
    const payload: any = {
      project_id: projectId,
      eyebrow: kit.eyebrow?.trim() || null,
      lede: kit.lede?.trim() || null,
      meta_lines: (kit.meta_lines ?? []).filter(Boolean),
      version: kit.version?.trim() || null,
      kit_header: kit.kit_header?.trim() || null,
      marks_intro: kit.marks_intro?.trim() || null,
      color_intro: kit.color_intro?.trim() || null,
      type_intro: kit.type_intro?.trim() || null,
      misuse_rules: kit.misuse_rules ?? [],
    }
    if (kit.id) {
      await supabase.from("brand_kits").update(payload).eq("id", kit.id)
    } else {
      const { data } = await supabase.from("brand_kits").insert(payload).select().single()
      if (data) setKit(k => ({ ...k, id: (data as any).id }))
    }
    setSavingKit(false)
    showToast("Kit saved")
  }

  // ─── Asset upload + per-asset field edits ─────────────────────
  async function uploadAssets(files: FileList, category: string) {
    let uploaded = 0
    const startOrder = assets.length
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split(".").pop() ?? "bin"
      const path = `${projectId}/${Date.now()}-${i}.${ext}`
      const { error: uploadErr } = await supabase.storage.from("brand-assets").upload(path, file)
      if (uploadErr) { console.error("[upload]", uploadErr); showToast("Upload failed"); continue }
      const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path)
      const { data: asset } = await supabase.from("brand_assets").insert({
        project_id: projectId,
        name: file.name.replace(/\.[^.]+$/, ""),
        file_url: urlData.publicUrl,
        file_type: ext.toUpperCase(),
        file_size_bytes: file.size,
        category,
        sort_order: startOrder + i,
      } as any).select().single()
      if (asset) { setAssets(prev => [...prev, asset as Asset]); uploaded++ }
    }
    if (uploaded > 0) showToast(`${uploaded} file${uploaded > 1 ? "s" : ""} added`)
  }

  async function patchAsset(id: string, patch: Partial<Asset>) {
    await supabase.from("brand_assets").update(patch).eq("id", id)
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  async function deleteAsset(id: string) {
    if (!confirm("Remove this file from the brand kit?")) return
    await supabase.from("brand_assets").delete().eq("id", id)
    setAssets(prev => prev.filter(a => a.id !== id))
    showToast("Removed")
  }

  // ─── Color CRUD ───────────────────────────────────────────────
  async function addColor() {
    if (!colorForm.name.trim() || !colorForm.hex.trim() || colorForm.hex === "#") return
    const { data } = await supabase.from("color_swatches").insert({
      project_id: projectId,
      name: colorForm.name.trim(),
      hex: colorForm.hex.trim(),
      rgb: hexToRgb(colorForm.hex.trim()),
      sort_order: colors.length,
    } as any).select().single()
    if (data) setColors(prev => [...prev, data as Color])
    setColorForm({ name: "", hex: "#" })
    showToast("Colour added")
  }

  async function patchColor(id: string, patch: Partial<Color>) {
    await supabase.from("color_swatches").update(patch).eq("id", id)
    setColors(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  async function deleteColor(id: string) {
    await supabase.from("color_swatches").delete().eq("id", id)
    setColors(prev => prev.filter(c => c.id !== id))
  }

  // ─── Typeface CRUD ────────────────────────────────────────────

  // Uploads a font file to the brand-assets bucket and returns the public URL.
  // Returns null + shows toast on failure so the caller knows.
  async function uploadFontFile(file: File): Promise<string | null> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const path = `${projectId}/fonts/${Date.now()}-${safeName}`
    const { error: uploadErr } = await supabase.storage.from("brand-assets").upload(path, file, {
      contentType: file.type || "application/octet-stream",
    })
    if (uploadErr) {
      console.error("[font upload]", uploadErr)
      showToast(`Font upload failed — ${uploadErr.message}`)
      return null
    }
    const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path)
    return urlData.publicUrl
  }

  async function addTypeface() {
    if (!typeForm.name.trim()) {
      showToast("Typeface name is required")
      return
    }
    let file_url: string | null = null
    if (typeFile) {
      file_url = await uploadFontFile(typeFile)
      if (!file_url) return // upload failure already toasted
    }
    const { data, error } = await supabase.from("typeface_entries").insert({
      project_id: projectId,
      name: typeForm.name.trim(),
      weight: typeForm.weight.trim() || null,
      role: typeForm.role.trim() || null,
      file_url,
      sort_order: typefaces.length,
    } as any).select().single()
    if (error || !data) {
      console.error("[typeface insert]", error)
      showToast(`Couldn't save typeface — ${error?.message ?? "unknown error"}`)
      return
    }
    setTypefaces(prev => [...prev, data as Typeface])
    setTypeForm({ name: "", weight: "", role: "" })
    setTypeFile(null)
    showToast(file_url ? "Typeface added with font file ✓" : "Typeface added")
  }

  // Attach (or replace) a font file on an existing typeface row
  async function attachFontToTypeface(id: string, file: File) {
    const url = await uploadFontFile(file)
    if (!url) return
    await supabase.from("typeface_entries").update({ file_url: url }).eq("id", id)
    setTypefaces(prev => prev.map(t => t.id === id ? { ...t, file_url: url } : t))
    showToast("Font file uploaded ✓")
  }

  async function clearFontFromTypeface(id: string) {
    await supabase.from("typeface_entries").update({ file_url: null }).eq("id", id)
    setTypefaces(prev => prev.map(t => t.id === id ? { ...t, file_url: null } : t))
    showToast("Font file cleared")
  }

  async function patchTypeface(id: string, patch: Partial<Typeface>) {
    await supabase.from("typeface_entries").update(patch).eq("id", id)
    setTypefaces(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  async function deleteTypeface(id: string) {
    await supabase.from("typeface_entries").delete().eq("id", id)
    setTypefaces(prev => prev.filter(t => t.id !== id))
  }

  // ─── Meta lines + misuse helpers ──────────────────────────────
  function addMetaLine() {
    if (!metaInput.trim()) return
    setKit(k => ({ ...k, meta_lines: [...(k.meta_lines ?? []), metaInput.trim()] }))
    setMetaInput("")
  }
  function removeMetaLine(i: number) {
    setKit(k => ({ ...k, meta_lines: (k.meta_lines ?? []).filter((_, idx) => idx !== i) }))
  }
  function addMisuse() {
    if (!misuseInput.tag.trim() || !misuseInput.note.trim()) return
    setKit(k => ({ ...k, misuse_rules: [...(k.misuse_rules ?? []), { tag: misuseInput.tag.trim(), note: misuseInput.note.trim() }] }))
    setMisuseInput({ tag: "", note: "" })
  }
  function removeMisuse(i: number) {
    setKit(k => ({ ...k, misuse_rules: (k.misuse_rules ?? []).filter((_, idx) => idx !== i) }))
  }

  if (loading) return (
    <>
      <PortalNav isAdmin />
      <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35, textAlign: "center", padding: "120px 28px" }}>
        Loading…
      </div>
    </>
  )

  if (!project) return (
    <>
      <PortalNav isAdmin />
      <div style={{ ...serif, fontStyle: "italic", textAlign: "center", padding: "120px 28px", opacity: 0.5 }}>
        Project not found.
      </div>
    </>
  )

  const client = project.clients

  return (
    <>
      <PortalNav isAdmin />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px clamp(24px, 4vw, 56px) 96px" }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: 20 }}>
          <Link href={`/admin/projects/${projectId}`} style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none" }}>
            ← {project.title}
          </Link>
        </div>

        {/* Header */}
        <header style={{ marginBottom: 48, paddingBottom: 28, borderBottom: "0.5px solid rgba(15,15,14,0.1)", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 20 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 10 }}>
              {client?.name} · Manage
            </div>
            <h1 style={{ ...sans, fontWeight: 400, fontSize: 32, letterSpacing: "-0.02em", margin: 0, opacity: 0.95 }}>
              Brand kit
            </h1>
            <div style={{ ...serif, fontStyle: "italic", fontSize: 15, opacity: 0.55, marginTop: 10, lineHeight: 1.55 }}>
              Edit the cover, marks, colour, type, and rules for {project.title}. Saved changes appear on the client&apos;s brand kit page.
            </div>
          </div>
          <Link href={`/brand-kit/${projectId}`} target="_blank" style={{
            ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--ink)", opacity: 0.65, textDecoration: "none",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "10px 16px",
          }}>
            View client kit ↗
          </Link>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>

          {/* ─── Cover narrative ───────────────────────────────── */}
          <section>
            <div style={{ ...sectionLabel }}>Cover</div>
            <div style={{ ...serif, fontStyle: "italic", fontSize: 13, opacity: 0.5, lineHeight: 1.55, marginTop: -10, marginBottom: 16, maxWidth: 580 }}>
              The eyebrow, lede, and meta lines shown at the top of the brand kit page.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
              <div>
                <FieldLabel label="Eyebrow" hint='e.g. "Brand Identity — Developer & Design Handoff"' />
                <input type="text" value={kit.eyebrow ?? ""} onChange={e => setKit(k => ({ ...k, eyebrow: e.target.value }))} placeholder="Brand Identity" style={input} />
              </div>
              <div>
                <FieldLabel label="Version" hint='e.g. "v1.0.0"' />
                <input type="text" value={kit.version ?? ""} onChange={e => setKit(k => ({ ...k, version: e.target.value }))} placeholder="v1" style={input} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <FieldLabel label="Top-right header" hint='Shown in the top-right of the cover. Leave blank to auto-generate as "Brand Kit · [project creation month]".' />
              <input type="text" value={kit.kit_header ?? ""} onChange={e => setKit(k => ({ ...k, kit_header: e.target.value }))} placeholder="Brand Kit · June 2026" style={input} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <FieldLabel label="Lede" hint="The italic paragraph under the title." />
              <textarea value={kit.lede ?? ""} onChange={e => setKit(k => ({ ...k, lede: e.target.value }))} rows={3} placeholder="A working reference for the brand — marks, color, type, and the files that bring it to life." style={{ ...input, resize: "vertical", lineHeight: 1.55 }} />
            </div>
            <div>
              <FieldLabel label="Meta lines" hint='Small uppercase labels under the lede. e.g. "Concept 01 · Architectural–Textile" / "Source: Brand Direction, May 2025"' />
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input type="text" value={metaInput} onChange={e => setMetaInput(e.target.value)} placeholder="One line at a time" style={input} />
                <button onClick={addMetaLine} style={addBtn}>Add</button>
              </div>
              {(kit.meta_lines ?? []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {(kit.meta_lines ?? []).map((line, i) => (
                    <span key={i} style={chip}>
                      <span>{line}</span>
                      <button onClick={() => removeMetaLine(i)} style={chipX} aria-label="Remove">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ─── Marks ─────────────────────────────────────────── */}
          <section>
            <SectionHead label="Marks" count={assets.filter(a => a.category === "logo").length} hint="Logos with optional descriptions and short usage notes. Files with the SAME name (e.g. wordmark.svg + wordmark.png) group into one tile with format chips." />
            <div style={{ marginBottom: 16 }}>
              <FieldLabel label="Section intro" hint="Paragraph above the mark grid on the client page." />
              <textarea value={kit.marks_intro ?? ""} onChange={e => setKit(k => ({ ...k, marks_intro: e.target.value }))} rows={2} placeholder="The wordmark and supporting marks. Use these files exactly as supplied..." style={{ ...input, resize: "vertical", lineHeight: 1.55 }} />
            </div>
            <UploadDropzone onFiles={files => uploadAssets(files, "logo")} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
              {assets.filter(a => a.category === "logo").map(a => (
                <AssetEditCard
                  key={a.id}
                  asset={a}
                  onPatch={patch => patchAsset(a.id, patch)}
                  onDelete={() => deleteAsset(a.id)}
                  showVisual
                  colorways={colors}
                />
              ))}
            </div>
          </section>

          {/* ─── Colour ────────────────────────────────────────── */}
          <section>
            <SectionHead label="Colour" count={colors.length} hint="Hex swatches with optional usage notes. Contrast pairings are auto-computed on the client page." />
            <div style={{ marginBottom: 16 }}>
              <FieldLabel label="Section intro" hint="Paragraph above the swatches." />
              <textarea value={kit.color_intro ?? ""} onChange={e => setKit(k => ({ ...k, color_intro: e.target.value }))} rows={2} placeholder="A three-color palette. The default canvas is..." style={{ ...input, resize: "vertical", lineHeight: 1.55 }} />
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "minmax(0, 1fr) 140px 130px 50px",
              gap: 12, alignItems: "center",
              padding: "12px 14px",
              background: "rgba(255,255,255,0.4)",
              border: "0.5px solid rgba(15,15,14,0.1)",
            }}>
              <input type="text" value={colorForm.name} onChange={e => setColorForm({ ...colorForm, name: e.target.value })} placeholder="Name (e.g. Oatmeal)" style={input} />
              <input type="text" value={colorForm.hex} onChange={e => setColorForm({ ...colorForm, hex: e.target.value })} placeholder="#EBE4D5" style={input} />
              <input type="color" value={colorForm.hex.length === 7 ? colorForm.hex : "#000000"} onChange={e => setColorForm({ ...colorForm, hex: e.target.value })} style={{ width: "100%", height: 30, border: "0.5px solid rgba(15,15,14,0.15)", cursor: "pointer", background: "transparent" }} />
              <button onClick={addColor} style={addBtn}>Add</button>
            </div>

            {colors.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                {colors.map(c => (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1.5fr 50px", gap: 10, alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.35)", border: "0.5px solid rgba(15,15,14,0.08)" }}>
                    <div style={{ background: c.hex, height: 40, border: "0.5px solid rgba(15,15,14,0.1)" }} />
                    <input defaultValue={c.name} onBlur={e => patchColor(c.id, { name: e.target.value })} placeholder="Name" style={input} />
                    <input defaultValue={c.hex.toUpperCase()} onBlur={e => patchColor(c.id, { hex: e.target.value, rgb: hexToRgb(e.target.value) })} placeholder="#HEX" style={{ ...input, ...mono, letterSpacing: "0.04em" }} />
                    <input defaultValue={c.usage_note ?? ""} onBlur={e => patchColor(c.id, { usage_note: e.target.value || null })} placeholder="Usage note (Primary canvas / backgrounds)" style={input} />
                    <button onClick={() => deleteColor(c.id)} style={{ ...mono, fontSize: 10, background: "none", border: "none", color: "var(--ink)", opacity: 0.4, cursor: "pointer", padding: 0 }} aria-label="Remove">✕</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Type ──────────────────────────────────────────── */}
          <section>
            <SectionHead label="Type" count={typefaces.length} hint="Typefaces with sample text and weight notes. If you upload a font file, the specimen on the client page renders in that typeface." />
            <div style={{ marginBottom: 16 }}>
              <FieldLabel label="Section intro" hint="Paragraph above the type specimens." />
              <textarea value={kit.type_intro ?? ""} onChange={e => setKit(k => ({ ...k, type_intro: e.target.value }))} rows={2} placeholder="Two families. The first is the workhorse — UI, body, labels..." style={{ ...input, resize: "vertical", lineHeight: 1.55 }} />
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 200px 80px",
              gap: 12, alignItems: "center",
              padding: "12px 14px",
              background: "rgba(255,255,255,0.4)",
              border: "0.5px solid rgba(15,15,14,0.1)",
            }}>
              <input type="text" value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="Typeface name (e.g. Stolzl)" style={input} />
              <input type="text" value={typeForm.weight} onChange={e => setTypeForm({ ...typeForm, weight: e.target.value })} placeholder="Weight (700)" style={input} />
              <input type="text" value={typeForm.role} onChange={e => setTypeForm({ ...typeForm, role: e.target.value })} placeholder="Role (Display)" style={input} />
              <label style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.6, cursor: "pointer", border: "0.5px solid rgba(15,15,14,0.18)", padding: "7px 10px", textAlign: "center" }}>
                {typeFile ? typeFile.name.slice(0, 18) + (typeFile.name.length > 18 ? "…" : "") : "Font file ↑"}
                <input type="file" onChange={e => setTypeFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} accept=".woff,.woff2,.otf,.ttf" />
              </label>
              <button onClick={addTypeface} style={addBtn}>Add</button>
            </div>

            {typefaces.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
                {typefaces.map(tf => (
                  <div key={tf.id} style={{ background: "rgba(255,255,255,0.35)", border: "0.5px solid rgba(15,15,14,0.08)", padding: "14px 16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 60px", gap: 10, alignItems: "center", marginBottom: 10 }}>
                      <input defaultValue={tf.name} onBlur={e => patchTypeface(tf.id, { name: e.target.value })} placeholder="Typeface name" style={input} />
                      <input defaultValue={tf.weight ?? ""} onBlur={e => patchTypeface(tf.id, { weight: e.target.value || null })} placeholder="Weight" style={input} />
                      <input defaultValue={tf.role ?? ""} onBlur={e => patchTypeface(tf.id, { role: e.target.value || null })} placeholder="Role" style={input} />
                      <button onClick={() => deleteTypeface(tf.id)} style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", background: "none", border: "none", color: "var(--ink)", opacity: 0.45, cursor: "pointer", textAlign: "right" }}>Remove</button>
                    </div>
                    <input defaultValue={tf.sample_text ?? ""} onBlur={e => patchTypeface(tf.id, { sample_text: e.target.value || null })} placeholder='Specimen sample text (e.g. "Shops, Studios & Flexible Space")' style={{ ...input, marginBottom: 8 }} />
                    <input defaultValue={tf.weights_note ?? ""} onBlur={e => patchTypeface(tf.id, { weights_note: e.target.value || null })} placeholder='Weights note (e.g. "Thin 100, Light 200, Book 300, Regular 400...")' style={input} />
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, paddingTop: 10, borderTop: "0.5px solid rgba(15,15,14,0.06)" }}>
                      <label style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.65, cursor: "pointer", border: "0.5px solid rgba(15,15,14,0.2)", padding: "6px 10px" }}>
                        {tf.file_url ? "Replace font file ↑" : "Upload font file ↑"}
                        <input
                          type="file"
                          accept=".woff,.woff2,.otf,.ttf"
                          onChange={e => { const f = e.target.files?.[0]; if (f) attachFontToTypeface(tf.id, f); e.target.value = "" }}
                          style={{ display: "none" }}
                        />
                      </label>
                      {tf.file_url ? (
                        <>
                          <span style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sage)", opacity: 0.85 }}>
                            Font attached ✓
                          </span>
                          <span style={{ flex: 1 }} />
                          <button onClick={() => clearFontFromTypeface(tf.id)} style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", background: "none", border: "none", color: "var(--ink)", opacity: 0.4, cursor: "pointer" }}>
                            Clear font
                          </button>
                        </>
                      ) : (
                        <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 12, opacity: 0.5 }}>
                          .woff2 / .otf / .ttf — leave blank if licensed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Guidelines + Source + Other ───────────────────── */}
          {CATEGORIES.filter(c => c.key !== "logo").map(cat => {
            const items = assets.filter(a => a.category === cat.key).sort((a, b) => a.sort_order - b.sort_order)
            return (
              <section key={cat.key}>
                <SectionHead label={cat.label} count={items.length} hint={cat.hint} />
                <UploadDropzone onFiles={files => uploadAssets(files, cat.key)} />
                {items.length > 0 && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                    {items.map(asset => (
                      <AssetEditCard
                        key={asset.id}
                        asset={asset}
                        onPatch={patch => patchAsset(asset.id, patch)}
                        onDelete={() => deleteAsset(asset.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}

          {/* ─── Misuse rules ──────────────────────────────────── */}
          <section>
            <SectionHead label="Misuse rules" count={(kit.misuse_rules ?? []).length} hint='Short "✕ Recolor / ✕ Distort / ✕ Add a space" entries that appear in their own section on the client page.' />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5fr 80px", gap: 10, alignItems: "center", padding: "12px 14px", background: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(15,15,14,0.1)" }}>
              <input type="text" value={misuseInput.tag} onChange={e => setMisuseInput({ ...misuseInput, tag: e.target.value })} placeholder='Short tag ("Recolor")' style={input} />
              <input type="text" value={misuseInput.note} onChange={e => setMisuseInput({ ...misuseInput, note: e.target.value })} placeholder="Short explanation" style={input} />
              <button onClick={addMisuse} style={addBtn}>Add</button>
            </div>
            {(kit.misuse_rules ?? []).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                {(kit.misuse_rules ?? []).map((r, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2.5fr 80px", gap: 10, alignItems: "center", padding: "8px 14px", background: "rgba(255,255,255,0.3)", border: "0.5px solid rgba(15,15,14,0.06)" }}>
                    <div style={{ ...sans, fontSize: 13, fontWeight: 500, color: "var(--danger)" }}>✕ {r.tag}</div>
                    <div style={{ ...sans, fontSize: 13, opacity: 0.7 }}>{r.note}</div>
                    <button onClick={() => removeMisuse(i)} style={{ ...mono, fontSize: 10, background: "none", border: "none", color: "var(--ink)", opacity: 0.4, cursor: "pointer", textAlign: "right" }}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Save button (kit-level fields) ────────────────── */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", paddingTop: 20, borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
            <button
              onClick={saveKit}
              disabled={savingKit}
              style={{
                ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase",
                background: "var(--ink)", color: "var(--cream)",
                border: "none", padding: "14px 28px",
                cursor: savingKit ? "default" : "pointer",
                opacity: savingKit ? 0.4 : 1,
              }}
            >
              {savingKit ? "Saving…" : "Save kit narrative"}
            </button>
            <div style={{ ...serif, fontStyle: "italic", fontSize: 13, opacity: 0.5, lineHeight: 1.5 }}>
              Cover, section intros, and misuse rules save together. Files, colours, and typefaces save individually as you edit them.
            </div>
          </div>
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

function AssetEditCard({ asset, onPatch, onDelete, showVisual = false, colorways }: { asset: Asset; onPatch: (patch: Partial<Asset>) => void; onDelete: () => void; showVisual?: boolean; colorways?: Color[] }) {
  const dark = /reverse|dark|white|inverse/i.test(asset.name)
  const isImg = /^(svg|png|jpg|jpeg|webp|gif)$/i.test(asset.file_type)
  const selected = new Set(asset.available_color_ids ?? [])
  function toggleColor(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    onPatch({ available_color_ids: Array.from(next) })
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: showVisual ? "160px 1fr 50px" : "1fr 50px", gap: 14, background: "rgba(255,255,255,0.35)", border: "0.5px solid rgba(15,15,14,0.08)", padding: 14 }}>
      {showVisual && (
        <a href={asset.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          <div style={{
            background: dark ? "#1C1916" : "rgba(28,25,22,0.04)",
            border: dark ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid rgba(28,25,22,0.08)",
            aspectRatio: "4/3",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 14,
          }}>
            {isImg ? (
              <img src={asset.file_url} alt={asset.name} style={{ maxWidth: "75%", maxHeight: "75%", objectFit: "contain" }} />
            ) : (
              <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: dark ? 0.6 : 0.45 }}>
                {asset.file_type}
              </div>
            )}
          </div>
        </a>
      )}
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <input defaultValue={asset.name} onBlur={e => onPatch({ name: e.target.value })} placeholder="Name" style={input} />
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", opacity: 0.5 }}>{asset.file_type}</div>
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.08em", opacity: 0.5 }}>{fileSize(asset.file_size_bytes)}</div>
        </div>
        <textarea defaultValue={asset.description ?? ""} onBlur={e => onPatch({ description: e.target.value || null })} placeholder="Description (e.g. The default brand signature. Single word, no space.)" rows={2} style={{ ...input, resize: "vertical", lineHeight: 1.5, marginBottom: 8 }} />
        {colorways ? (
          <>
            <textarea defaultValue={asset.primary_use ?? asset.usage ?? ""} onBlur={e => onPatch({ primary_use: e.target.value || null })} placeholder="Primary use (e.g. Used in all main signage, headers, and external print collateral.)" rows={2} style={{ ...input, resize: "vertical", lineHeight: 1.5, marginBottom: 10 }} />
            {colorways.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* THIS file's colorway — drives which colorway click surfaces it as a download */}
                <div>
                  <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 6 }}>
                    This file's colorway
                  </div>
                  <select
                    defaultValue={asset.color_id ?? ""}
                    onChange={e => onPatch({ color_id: e.target.value || null })}
                    style={{ ...input, cursor: "pointer", padding: "6px 8px" }}
                  >
                    <option value="">— Any / source file (shows under every colorway)</option>
                    {colorways.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Available in (display tag) — drives which colorway pills appear on the mark spread */}
                <div>
                  <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 6 }}>
                    Available in · tap to toggle
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {colorways.map(c => {
                      const on = selected.has(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleColor(c.id)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "5px 10px 5px 6px",
                            background: on ? "rgba(28,25,22,0.06)" : "transparent",
                            border: on ? "0.5px solid rgba(28,25,22,0.4)" : "0.5px solid rgba(28,25,22,0.15)",
                            cursor: "pointer",
                            ...mono, fontSize: 10, letterSpacing: "0.06em", color: "var(--ink)",
                            opacity: on ? 1 : 0.6,
                          }}
                        >
                          <span style={{ width: 12, height: 12, background: c.hex, border: "0.5px solid rgba(28,25,22,0.18)", display: "inline-block" }} />
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <input defaultValue={asset.usage ?? ""} onBlur={e => onPatch({ usage: e.target.value || null })} placeholder="Primary use (e.g. Web, signage, headers)" style={input} />
        )}
      </div>
      <button onClick={onDelete} style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", background: "transparent", border: "none", color: "var(--ink)", opacity: 0.4, cursor: "pointer", padding: 0, alignSelf: "flex-start" }}>
        Remove
      </button>
    </div>
  )
}

function SectionHead({ label, count, hint }: { label: string; count: number; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={sectionLabel}>
        {label} {count > 0 && <span style={{ opacity: 0.7 }}>· {count}</span>}
      </div>
      {hint && (
        <div style={{ ...serif, fontStyle: "italic", fontSize: 13, opacity: 0.5, lineHeight: 1.55, maxWidth: 600 }}>{hint}</div>
      )}
    </div>
  )
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.6 }}>{label}</div>
      {hint && <div style={{ ...serif, fontStyle: "italic", fontSize: 12, opacity: 0.45, marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function UploadDropzone({ onFiles }: { onFiles: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files) }}
      style={{
        padding: "16px 20px",
        background: dragOver ? "rgba(143,167,181,0.1)" : "rgba(255,255,255,0.32)",
        border: dragOver ? "1px dashed var(--sage)" : "0.5px dashed rgba(15,15,14,0.2)",
        cursor: "pointer", textAlign: "center",
        transition: "all 0.15s",
      }}
    >
      <span style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.55 }}>
        Drop files here or click to choose
      </span>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={e => { if (e.target.files) onFiles(e.target.files); e.target.value = "" }}
      />
    </div>
  )
}

const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "transparent",
  border: "none",
  borderBottom: "0.5px solid rgba(15,15,14,0.18)",
  padding: "8px 0",
  ...sans, fontSize: 13,
  color: "var(--ink)", outline: "none",
}

const addBtn: React.CSSProperties = {
  ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
  background: "transparent", border: "0.5px solid rgba(15,15,14,0.25)",
  padding: "8px 10px", cursor: "pointer", color: "var(--ink)", opacity: 0.7,
}

const chip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
  background: "rgba(255,255,255,0.5)", border: "0.5px solid rgba(15,15,14,0.15)",
  padding: "4px 8px", color: "var(--ink)", opacity: 0.85,
}

const chipX: React.CSSProperties = {
  background: "none", border: "none", color: "var(--ink)",
  opacity: 0.4, cursor: "pointer", padding: 0, fontSize: 11,
}
