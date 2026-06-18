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

type Asset = { id: string; name: string; file_url: string; file_type: string; file_size_bytes?: number; category: string; sort_order: number; description?: string | null; usage?: string | null; primary_use?: string | null; color_id?: string | null; display_scale?: number | null; default_colorway_id?: string | null }
type Color = { id: string; name: string; hex: string; sort_order: number; rgb?: string | null; usage_note?: string | null; cmyk?: string | null; pms?: string | null; tier?: string | null }
type Specimen = { label: string; size: number; sample: string; tracking?: string; leading?: string; caps?: boolean }
type Typeface = { id: string; name: string; weight?: string | null; role?: string | null; file_url?: string | null; otf_url?: string | null; ttf_url?: string | null; sort_order: number; sample_text?: string | null; weights_note?: string | null; specimens?: Specimen[] | null }
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
  /**
   * Pull a swatch name out of the filename if present. Matches `iron`,
   * `-iron-`, `_iron_`, ` iron `, etc. — anywhere a color name appears
   * as its own token. Strips the matched token (and adjacent separators)
   * from the returned name so groups still merge by base mark name.
   */
  function detectColorway(filename: string, palette: Color[]): { color_id: string | null; cleanName: string } {
    const base = filename.replace(/\.[^.]+$/, "")
    for (const c of palette) {
      const re = new RegExp(`(^|[-_\\s.])${c.name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?=$|[-_\\s.])`, "i")
      if (re.test(base)) {
        const cleanName = base.replace(re, "$1").replace(/[-_\s.]{2,}/g, "-").replace(/^[-_\s.]+|[-_\s.]+$/g, "").trim()
        return { color_id: c.id, cleanName: cleanName || base }
      }
    }
    return { color_id: null, cleanName: base }
  }

  async function uploadAssets(files: FileList, category: string) {
    let uploaded = 0
    let tagged = 0
    const startOrder = assets.length
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split(".").pop() ?? "bin"
      const path = `${projectId}/${Date.now()}-${i}.${ext}`
      const { error: uploadErr } = await supabase.storage.from("brand-assets").upload(path, file)
      if (uploadErr) { console.error("[upload]", uploadErr); showToast("Upload failed"); continue }
      const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path)

      // Auto-detect colorway for logo uploads so per-color files tag themselves.
      const { color_id, cleanName } =
        category === "logo" ? detectColorway(file.name, colors) : { color_id: null, cleanName: file.name.replace(/\.[^.]+$/, "") }

      const { data: asset } = await supabase.from("brand_assets").insert({
        project_id: projectId,
        name: cleanName,
        file_url: urlData.publicUrl,
        file_type: ext.toUpperCase(),
        file_size_bytes: file.size,
        category,
        sort_order: startOrder + i,
        color_id,
      } as any).select().single()
      if (asset) { setAssets(prev => [...prev, asset as Asset]); uploaded++; if (color_id) tagged++ }
    }
    if (uploaded > 0) {
      showToast(`${uploaded} file${uploaded > 1 ? "s" : ""} added${tagged > 0 ? ` · ${tagged} auto-tagged by colorway` : ""}`)
    }
  }

  async function patchAsset(id: string, patch: Partial<Asset>) {
    const target = assets.find(a => a.id === id)

    // Renaming a logo asset propagates to all files that shared its old name,
    // so every per-color file in a mark group keeps grouping together.
    if ("name" in patch && patch.name !== undefined && target?.category === "logo" && target.name !== patch.name) {
      const siblings = assets.filter(a => a.category === "logo" && a.name === target.name)
      if (siblings.length > 1) {
        const newName = patch.name
        const ids = siblings.map(a => a.id)
        await supabase.from("brand_assets").update({ ...patch, name: newName }).in("id", ids)
        setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, ...patch, name: newName } : a))
        showToast(`Renamed ${siblings.length} files`)
        return
      }
    }

    // Default-colorway is a mark-level property — propagate across all siblings
    // sharing this asset's name (i.e. the mark group).
    if ("default_colorway_id" in patch && target?.category === "logo") {
      const siblings = assets.filter(a => a.category === "logo" && a.name === target.name)
      if (siblings.length > 1) {
        const ids = siblings.map(a => a.id)
        await supabase.from("brand_assets").update(patch).in("id", ids)
        setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, ...patch } : a))
        return
      }
    }

    await supabase.from("brand_assets").update(patch).eq("id", id)
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  async function deleteAsset(id: string) {
    const target = assets.find(a => a.id === id)
    const label = target ? `${target.name}.${target.file_type?.toLowerCase()}` : "this file"
    if (!confirm(`Remove "${label}" from the brand kit?`)) return
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
    showToast("Color added")
  }

  async function patchColor(id: string, patch: Partial<Color>) {
    await supabase.from("color_swatches").update(patch).eq("id", id)
    setColors(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  async function deleteColor(id: string) {
    const target = colors.find(c => c.id === id)
    if (!confirm(`Remove "${target?.name || "this swatch"}" from the palette?`)) return
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

  // Attach (or replace) a font file on an existing typeface row.
  // `column` lets us target file_url (web/WOFF2), otf_url, or ttf_url.
  async function attachFontToTypeface(id: string, file: File, column: "file_url" | "otf_url" | "ttf_url" = "file_url") {
    const url = await uploadFontFile(file)
    if (!url) return
    await supabase.from("typeface_entries").update({ [column]: url }).eq("id", id)
    setTypefaces(prev => prev.map(t => t.id === id ? { ...t, [column]: url } : t))
    showToast("Font file uploaded ✓")
  }

  // Unpacks a font foundry zip (web/, desktop/, readme.txt) and routes the
  // first .woff2, .otf, and .ttf inside into the corresponding URL columns.
  // Skips formats already represented; the user can clear+re-run to swap.
  async function attachFontZipToTypeface(id: string, zipFile: File) {
    const JSZip = (await import("jszip")).default
    let zip: any
    try {
      zip = await JSZip.loadAsync(zipFile)
    } catch (err) {
      console.error("[font zip parse]", err)
      showToast("Couldn't read that zip")
      return
    }

    type Slot = "file_url" | "otf_url" | "ttf_url"
    const want: Record<Slot, RegExp> = {
      file_url: /\.woff2$/i,
      otf_url: /\.otf$/i,
      ttf_url: /\.ttf$/i,
    }

    // Sort entries so "regular" / "normal" variants land first when a family
    // ships every weight in one zip.
    const entries = Object.values(zip.files as Record<string, any>)
      .filter((f: any) => !f.dir)
      .sort((a: any, b: any) => {
        const score = (name: string) => /regular|normal|book(?!plate)/i.test(name) ? 0 : 1
        return score(a.name) - score(b.name) || a.name.localeCompare(b.name)
      })

    const picked: Partial<Record<Slot, { name: string; url: string }>> = {}
    for (const slot of Object.keys(want) as Slot[]) {
      const match = entries.find((f: any) => want[slot].test(f.name) && !/__MACOSX/i.test(f.name))
      if (!match) continue
      const blob = await match.async("blob")
      const innerName = match.name.split("/").pop() || match.name
      const synthetic = new File([blob], innerName, { type: blob.type || "application/octet-stream" })
      const url = await uploadFontFile(synthetic)
      if (!url) continue
      picked[slot] = { name: innerName, url }
    }

    const patch: any = {}
    for (const [slot, v] of Object.entries(picked)) if (v) patch[slot] = v.url

    if (Object.keys(patch).length === 0) {
      showToast("No .woff2 / .otf / .ttf files found in that zip")
      return
    }

    await supabase.from("typeface_entries").update(patch).eq("id", id)
    setTypefaces(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    const slotLabels: Record<string, string> = { file_url: "Web", otf_url: "OTF", ttf_url: "TTF" }
    showToast(`Loaded ${Object.keys(patch).map(k => slotLabels[k]).join(" · ")} from zip ✓`)
  }

  async function clearFontFromTypeface(id: string, column: "file_url" | "otf_url" | "ttf_url" = "file_url") {
    await supabase.from("typeface_entries").update({ [column]: null }).eq("id", id)
    setTypefaces(prev => prev.map(t => t.id === id ? { ...t, [column]: null } : t))
    showToast("Font file cleared")
  }

  async function patchTypeface(id: string, patch: Partial<Typeface>) {
    await supabase.from("typeface_entries").update(patch).eq("id", id)
    setTypefaces(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  async function deleteTypeface(id: string) {
    const target = typefaces.find(t => t.id === id)
    if (!confirm(`Remove "${target?.name || "this typeface"}" from the type section?`)) return
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
              Edit the cover, marks, color, type, and rules for {project.title}. Saved changes appear on the client&apos;s brand kit page.
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

          {/* ─── Color ────────────────────────────────────────── */}
          <section>
            <SectionHead label="Color" count={colors.length} hint="Hex swatches with optional usage notes. Contrast pairings are auto-computed on the client page." />
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
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "60px 1fr 50px", gap: 12, alignItems: "flex-start", padding: "12px 14px", background: "rgba(255,255,255,0.35)", border: "0.5px solid rgba(15,15,14,0.08)" }}>
                    <div style={{ background: c.hex, height: 60, border: "0.5px solid rgba(15,15,14,0.1)" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr 0.9fr", gap: 10 }}>
                        <input defaultValue={c.name} onBlur={e => patchColor(c.id, { name: e.target.value })} placeholder="Name" style={input} />
                        <input defaultValue={c.hex.toUpperCase()} onBlur={e => patchColor(c.id, { hex: e.target.value, rgb: hexToRgb(e.target.value) })} placeholder="#HEX" style={{ ...input, ...mono, letterSpacing: "0.04em" }} />
                        <select defaultValue={c.tier ?? ""} onChange={e => patchColor(c.id, { tier: e.target.value || null })} style={{ ...input, cursor: "pointer", padding: "6px 0" }}>
                          <option value="">Tier (none)</option>
                          <option value="Primary">Primary</option>
                          <option value="Secondary">Secondary</option>
                          <option value="Neutral">Neutral</option>
                          <option value="Accent">Accent</option>
                        </select>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 10 }}>
                        <input defaultValue={c.cmyk ?? ""} onBlur={e => patchColor(c.id, { cmyk: e.target.value || null })} placeholder="CMYK (0 / 39 / 80 / 27)" style={{ ...input, ...mono, fontSize: 12 }} />
                        <input defaultValue={c.pms ?? ""} onBlur={e => patchColor(c.id, { pms: e.target.value || null })} placeholder="PMS (153 C)" style={{ ...input, ...mono, fontSize: 12 }} />
                        <input defaultValue={c.usage_note ?? ""} onBlur={e => patchColor(c.id, { usage_note: e.target.value || null })} placeholder="Usage note (Primary canvas / backgrounds)" style={input} />
                      </div>
                    </div>
                    <button onClick={() => deleteColor(c.id)} style={{ ...mono, fontSize: 10, background: "none", border: "none", color: "var(--ink)", opacity: 0.4, cursor: "pointer", padding: 0, alignSelf: "flex-start" }} aria-label="Remove">✕</button>
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
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid rgba(15,15,14,0.06)" }}>
                      <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span>
                          Font files <span style={{ opacity: 0.7 }}>· Web renders the specimen; OTF / TTF are extra download formats for the client</span>
                        </span>
                        <label style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85, cursor: "pointer", border: "0.5px solid rgba(15,15,14,0.25)", padding: "4px 9px", flexShrink: 0 }}>
                          Upload zip ↑
                          <input
                            type="file"
                            accept=".zip,application/zip,application/x-zip-compressed"
                            onChange={e => { const f = e.target.files?.[0]; if (f) attachFontZipToTypeface(tf.id, f); e.target.value = "" }}
                            style={{ display: "none" }}
                          />
                        </label>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                        {([
                          { column: "file_url" as const, label: "Web (WOFF2)", accept: ".woff,.woff2", url: tf.file_url },
                          { column: "otf_url" as const, label: "OTF", accept: ".otf", url: tf.otf_url },
                          { column: "ttf_url" as const, label: "TTF", accept: ".ttf", url: tf.ttf_url },
                        ]).map(slot => (
                          <div key={slot.column} style={{ border: "0.5px solid rgba(15,15,14,0.12)", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.65 }}>
                              {slot.label}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <label style={{ ...mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.85, cursor: "pointer", border: "0.5px solid rgba(15,15,14,0.2)", padding: "4px 8px" }}>
                                {slot.url ? "Replace ↑" : "Upload ↑"}
                                <input
                                  type="file"
                                  accept={slot.accept}
                                  onChange={e => { const f = e.target.files?.[0]; if (f) attachFontToTypeface(tf.id, f, slot.column); e.target.value = "" }}
                                  style={{ display: "none" }}
                                />
                              </label>
                              {slot.url ? (
                                <>
                                  <span style={{ ...mono, fontSize: 9, color: "var(--sage)", opacity: 0.9 }}>
                                    ✓
                                  </span>
                                  <button onClick={() => clearFontFromTypeface(tf.id, slot.column)} style={{ ...mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "none", color: "var(--ink)", opacity: 0.4, cursor: "pointer", marginLeft: "auto" }}>
                                    Clear
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 11, opacity: 0.45 }}>
                                  optional
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <SpecimenEditor
                      typeface={tf}
                      onChange={specimens => patchTypeface(tf.id, { specimens })}
                    />
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
              Cover, section intros, and misuse rules save together. Files, colors, and typefaces save individually as you edit them.
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px", gap: 10, alignItems: "baseline", marginBottom: 12 }}>
          <input
            defaultValue={asset.name}
            onBlur={e => onPatch({ name: e.target.value })}
            placeholder="Name"
            style={{ ...input, ...sans, fontSize: 18, letterSpacing: "-0.01em", padding: "10px 0" }}
          />
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", opacity: 0.5 }}>{asset.file_type}</div>
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.08em", opacity: 0.5 }}>{fileSize(asset.file_size_bytes)}</div>
        </div>
        <textarea
          defaultValue={asset.description ?? ""}
          onBlur={e => onPatch({ description: e.target.value || null })}
          placeholder="Description (e.g. The default brand signature. Single word, no space.)"
          rows={2}
          style={{ ...input, ...sans, fontSize: 14, resize: "vertical", lineHeight: 1.6, marginBottom: 10 }}
        />
        {colorways ? (
          <>
            <textarea
              defaultValue={asset.primary_use ?? asset.usage ?? ""}
              onBlur={e => onPatch({ primary_use: e.target.value || null })}
              placeholder="Primary use (e.g. Used in all main signage, headers, and external print collateral.)"
              rows={2}
              style={{ ...input, ...sans, fontSize: 14, resize: "vertical", lineHeight: 1.6, marginBottom: 12 }}
            />
            {colorways.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 6 }}>
                      Colorway
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
                  <div>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 6 }}>
                      Stage size
                    </div>
                    <input
                      type="number"
                      step="0.05" min="0.2" max="1.5"
                      defaultValue={asset.display_scale ?? ""}
                      onBlur={e => {
                        const v = e.target.value.trim()
                        const n = v === "" ? null : parseFloat(v)
                        onPatch({ display_scale: (n != null && Number.isFinite(n) && n > 0) ? n : null })
                      }}
                      placeholder="1.0"
                      style={{ ...input, ...mono, fontSize: 12, padding: "6px 8px", textAlign: "right" }}
                      title="Scale of the mark inside its stage. 1 = default. Try 0.6 for chunky marks."
                    />
                  </div>
                </div>
                <div>
                  <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 6 }}>
                    Default colorway <span style={{ opacity: 0.6 }}>· mark-level, shared across all files</span>
                  </div>
                  <select
                    value={asset.default_colorway_id ?? ""}
                    onChange={e => onPatch({ default_colorway_id: e.target.value || null })}
                    style={{ ...input, cursor: "pointer", padding: "6px 8px" }}
                  >
                    <option value="">— First in palette</option>
                    {colorways.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
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

function SpecimenEditor({ typeface, onChange }: { typeface: Typeface; onChange: (specimens: Specimen[]) => void }) {
  const list: Specimen[] = Array.isArray(typeface.specimens) ? typeface.specimens : []
  function update(i: number, patch: Partial<Specimen>) {
    const next = list.map((s, idx) => idx === i ? { ...s, ...patch } : s)
    onChange(next)
  }
  function add() {
    const lastSize = list.length > 0 ? list[list.length - 1].size : 56
    onChange([...list, { label: "New row", size: Math.max(12, lastSize - 8), sample: typeface.name || "Sample text" }])
  }
  function remove(i: number) {
    onChange(list.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid rgba(15,15,14,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5 }}>
          Specimens <span style={{ opacity: 0.7 }}>· each row shows the typeface at a real size + sample</span>
        </div>
        <button onClick={add} style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", background: "transparent", border: "0.5px solid rgba(15,15,14,0.25)", color: "var(--ink)", padding: "4px 8px", cursor: "pointer" }}>+ Add row</button>
      </div>
      {list.length === 0 && (
        <div style={{ ...sans, fontStyle: "italic", fontSize: 12, color: "rgba(15,15,14,0.45)" }}>
          Leave blank for a sensible default scale, or add rows to spec your own.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 60px 1fr 80px 80px 50px 70px", gap: 8, alignItems: "center", padding: "6px 0" }}>
            <input
              value={s.label}
              onChange={e => update(i, { label: e.target.value })}
              placeholder="Label"
              style={{ ...input, ...mono, fontSize: 11, padding: "4px 0" }}
            />
            <input
              type="number"
              value={s.size}
              onChange={e => update(i, { size: parseInt(e.target.value) || 0 })}
              placeholder="px"
              style={{ ...input, ...mono, fontSize: 11, padding: "4px 0", textAlign: "right" }}
            />
            <input
              value={s.sample}
              onChange={e => update(i, { sample: e.target.value })}
              placeholder="Sample text"
              style={{ ...input, fontSize: 13, padding: "4px 0" }}
            />
            <input
              value={s.tracking ?? ""}
              onChange={e => update(i, { tracking: e.target.value || undefined })}
              placeholder="tracking"
              style={{ ...input, ...mono, fontSize: 11, padding: "4px 0" }}
            />
            <input
              value={s.leading ?? ""}
              onChange={e => update(i, { leading: e.target.value || undefined })}
              placeholder="leading"
              style={{ ...input, ...mono, fontSize: 11, padding: "4px 0" }}
            />
            <label style={{ ...mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="checkbox" checked={!!s.caps} onChange={e => update(i, { caps: e.target.checked })} />
              caps
            </label>
            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
              <button onClick={() => move(i, -1)} style={{ ...mono, fontSize: 10, background: "none", border: "none", color: "var(--ink)", opacity: 0.45, cursor: "pointer" }} aria-label="Up">↑</button>
              <button onClick={() => move(i, 1)} style={{ ...mono, fontSize: 10, background: "none", border: "none", color: "var(--ink)", opacity: 0.45, cursor: "pointer" }} aria-label="Down">↓</button>
              <button onClick={() => remove(i)} style={{ ...mono, fontSize: 10, background: "none", border: "none", color: "var(--ink)", opacity: 0.4, cursor: "pointer" }} aria-label="Remove">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
