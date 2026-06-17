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
  marginBottom: 18,
}

type Asset = { id: string; name: string; file_url: string; file_type: string; file_size_bytes?: number; category: string; sort_order: number }
type Color = { id: string; name: string; hex: string; sort_order: number }
type Typeface = { id: string; name: string; weight?: string | null; role?: string | null; file_url?: string | null; sort_order: number }

const CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: "logo",        label: "Marks",       hint: "Logo files — primary, reversed, monogram. SVG / PDF / PNG." },
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

export default function AdminProjectBrandKitPage({ params }: { params: { id: string } }) {
  const projectId = params.id
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [assets, setAssets] = useState<Asset[]>([])
  const [colors, setColors] = useState<Color[]>([])
  const [typefaces, setTypefaces] = useState<Typeface[]>([])

  const [colorForm, setColorForm] = useState({ name: "", hex: "#" })
  const [typeForm, setTypeForm] = useState({ name: "", weight: "", role: "" })
  const [typeFile, setTypeFile] = useState<File | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [proj, a, c, t] = await Promise.all([
        supabase.from("projects").select("id, title, clients(name)").eq("id", projectId).single(),
        supabase.from("brand_assets").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("color_swatches").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("typeface_entries").select("*").eq("project_id", projectId).order("sort_order"),
      ])
      if (cancelled) return
      setProject(proj.data)
      setAssets((a.data ?? []) as Asset[])
      setColors((c.data ?? []) as Color[])
      setTypefaces((t.data ?? []) as Typeface[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [projectId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  async function uploadAssets(files: FileList, category: string) {
    let uploaded = 0
    const startOrder = assets.length
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split(".").pop() ?? "bin"
      const path = `${projectId}/${Date.now()}-${i}.${ext}`
      const { error: uploadErr } = await supabase.storage.from("brand-assets").upload(path, file)
      if (uploadErr) { console.error("[upload]", uploadErr); showToast("Upload failed — check permissions"); continue }
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

  async function deleteAsset(id: string) {
    if (!confirm("Remove this file from the brand kit?")) return
    await supabase.from("brand_assets").delete().eq("id", id)
    setAssets(prev => prev.filter(a => a.id !== id))
    showToast("Removed")
  }

  async function addColor() {
    if (!colorForm.name.trim() || !colorForm.hex.trim() || colorForm.hex === "#") return
    const { data } = await supabase.from("color_swatches").insert({
      project_id: projectId,
      name: colorForm.name.trim(),
      hex: colorForm.hex.trim(),
      sort_order: colors.length,
    } as any).select().single()
    if (data) setColors(prev => [...prev, data as Color])
    setColorForm({ name: "", hex: "#" })
    showToast("Colour added")
  }

  async function deleteColor(id: string) {
    await supabase.from("color_swatches").delete().eq("id", id)
    setColors(prev => prev.filter(c => c.id !== id))
  }

  async function addTypeface() {
    if (!typeForm.name.trim()) return
    let file_url: string | null = null
    if (typeFile) {
      const ext = typeFile.name.split(".").pop() ?? "bin"
      const path = `${projectId}/fonts/${Date.now()}-${typeFile.name}`
      const { error: uploadErr } = await supabase.storage.from("brand-assets").upload(path, typeFile)
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path)
        file_url = urlData.publicUrl
      }
    }
    const { data } = await supabase.from("typeface_entries").insert({
      project_id: projectId,
      name: typeForm.name.trim(),
      weight: typeForm.weight.trim() || null,
      role: typeForm.role.trim() || null,
      file_url,
      sort_order: typefaces.length,
    } as any).select().single()
    if (data) setTypefaces(prev => [...prev, data as Typeface])
    setTypeForm({ name: "", weight: "", role: "" })
    setTypeFile(null)
    showToast("Typeface added")
  }

  async function deleteTypeface(id: string) {
    await supabase.from("typeface_entries").delete().eq("id", id)
    setTypefaces(prev => prev.filter(t => t.id !== id))
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
        <header style={{ marginBottom: 56, paddingBottom: 28, borderBottom: "0.5px solid rgba(15,15,14,0.1)", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 20 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 10 }}>
              {client?.name} · Manage
            </div>
            <h1 style={{ ...sans, fontWeight: 400, fontSize: 32, letterSpacing: "-0.02em", margin: 0, opacity: 0.95 }}>
              Brand kit
            </h1>
            <div style={{ ...serif, fontStyle: "italic", fontSize: 15, opacity: 0.55, marginTop: 10, lineHeight: 1.55 }}>
              Marks, colour, type, and files for {project.title}. Anything added here appears on the client&apos;s brand kit page.
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

        {/* Asset categories */}
        <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
          {CATEGORIES.map(cat => {
            const items = assets.filter(a => a.category === cat.key).sort((a, b) => a.sort_order - b.sort_order)
            return (
              <section key={cat.key}>
                <SectionHead label={cat.label} count={items.length} hint={cat.hint} />
                <UploadDropzone onFiles={files => uploadAssets(files, cat.key)} />
                {items.length > 0 && (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: cat.key === "logo" ? "repeat(auto-fill, minmax(180px, 1fr))" : "1fr",
                    gap: cat.key === "logo" ? 12 : 0,
                    marginTop: 18,
                  }}>
                    {items.map(asset => cat.key === "logo"
                      ? <LogoTile key={asset.id} asset={asset} onDelete={() => deleteAsset(asset.id)} />
                      : <FileRow key={asset.id} asset={asset} onDelete={() => deleteAsset(asset.id)} />
                    )}
                  </div>
                )}
              </section>
            )
          })}

          {/* Colours */}
          <section>
            <SectionHead label="Colour" count={colors.length} hint="Hex swatches that appear on the kit page. Click to copy on the client side." />
            <div style={{
              display: "grid", gridTemplateColumns: "minmax(0, 1fr) 140px 130px 50px",
              gap: 12, alignItems: "center",
              padding: "12px 14px",
              background: "rgba(255,255,255,0.4)",
              border: "0.5px solid rgba(15,15,14,0.1)",
            }}>
              <input
                type="text"
                value={colorForm.name}
                onChange={e => setColorForm({ ...colorForm, name: e.target.value })}
                placeholder="Name (e.g. Madder)"
                style={input}
              />
              <input
                type="text"
                value={colorForm.hex}
                onChange={e => setColorForm({ ...colorForm, hex: e.target.value })}
                placeholder="#000000"
                style={input}
              />
              <input
                type="color"
                value={colorForm.hex.length === 7 ? colorForm.hex : "#000000"}
                onChange={e => setColorForm({ ...colorForm, hex: e.target.value })}
                style={{ width: "100%", height: 30, border: "0.5px solid rgba(15,15,14,0.15)", cursor: "pointer", background: "transparent" }}
              />
              <button onClick={addColor} style={{
                ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                background: "transparent", border: "0.5px solid rgba(15,15,14,0.25)",
                padding: "8px 10px", cursor: "pointer", color: "var(--ink)", opacity: 0.7,
              }}>Add</button>
            </div>
            {colors.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 14 }}>
                {colors.map(c => (
                  <div key={c.id} style={{
                    background: c.hex,
                    color: isLight(c.hex) ? "rgba(28,25,22,0.85)" : "rgba(245,241,234,0.95)",
                    border: "0.5px solid rgba(15,15,14,0.1)",
                    padding: "14px 12px",
                    aspectRatio: "5/4",
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                    position: "relative",
                  }}>
                    <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.7 }}>{c.name}</div>
                    <div>
                      <div style={{ ...sans, fontSize: 14, letterSpacing: "-0.01em" }}>{c.hex.toUpperCase()}</div>
                    </div>
                    <button
                      onClick={() => deleteColor(c.id)}
                      aria-label="Remove"
                      style={{
                        position: "absolute", top: 6, right: 6,
                        ...mono, fontSize: 10,
                        background: "transparent", border: "none",
                        color: "inherit", opacity: 0.4, cursor: "pointer",
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Typefaces */}
          <section>
            <SectionHead label="Type" count={typefaces.length} hint="Typefaces with weights, roles, and (optionally) font files." />
            <div style={{
              display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 200px 80px",
              gap: 12, alignItems: "center",
              padding: "12px 14px",
              background: "rgba(255,255,255,0.4)",
              border: "0.5px solid rgba(15,15,14,0.1)",
            }} className="bk-type-add-grid">
              <input type="text" value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="Typeface name (e.g. PP Talisman)" style={input} />
              <input type="text" value={typeForm.weight} onChange={e => setTypeForm({ ...typeForm, weight: e.target.value })} placeholder="Weight (Bold)" style={input} />
              <input type="text" value={typeForm.role} onChange={e => setTypeForm({ ...typeForm, role: e.target.value })} placeholder="Role (Display)" style={input} />
              <label style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.6, cursor: "pointer", border: "0.5px solid rgba(15,15,14,0.18)", padding: "7px 10px", textAlign: "center" }}>
                {typeFile ? typeFile.name.slice(0, 18) + (typeFile.name.length > 18 ? "…" : "") : "Font file ↑"}
                <input type="file" onChange={e => setTypeFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} accept=".woff,.woff2,.otf,.ttf" />
              </label>
              <button onClick={addTypeface} style={{
                ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                background: "transparent", border: "0.5px solid rgba(15,15,14,0.25)",
                padding: "8px 10px", cursor: "pointer", color: "var(--ink)", opacity: 0.7,
              }}>Add</button>
            </div>

            {typefaces.length > 0 && (
              <div style={{ marginTop: 14, borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
                {typefaces.map(tf => (
                  <div key={tf.id} style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...sans, fontSize: 18, opacity: 0.9, letterSpacing: "-0.01em" }}>{tf.name}</div>
                      <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, marginTop: 3 }}>
                        {[tf.weight, tf.role].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    {tf.file_url && (
                      <a href={tf.file_url} target="_blank" rel="noopener noreferrer" style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none", color: "inherit" }}>
                        File ↓
                      </a>
                    )}
                    <button onClick={() => deleteTypeface(tf.id)} style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", background: "transparent", border: "none", color: "var(--ink)", opacity: 0.35, cursor: "pointer" }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Toast */}
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

function SectionHead({ label, count, hint }: { label: string; count: number; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={sectionLabel}>
        {label} {count > 0 && <span style={{ opacity: 0.7 }}>· {count}</span>}
      </div>
      {hint && (
        <div style={{ ...serif, fontStyle: "italic", fontSize: 13, opacity: 0.5, lineHeight: 1.55, maxWidth: 540 }}>{hint}</div>
      )}
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
        marginTop: 12, marginBottom: 4,
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

function LogoTile({ asset, onDelete }: { asset: Asset; onDelete: () => void }) {
  const dark = /reverse|dark|white|inverse/i.test(asset.name)
  const isImg = /^(svg|png|jpg|jpeg|webp|gif)$/i.test(asset.file_type)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}
      className="bk-logo-tile"
    >
      <a href={asset.file_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none" }}>
        <div style={{
          background: dark ? "#1C1916" : "rgba(28,25,22,0.04)",
          border: dark ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid rgba(28,25,22,0.08)",
          aspectRatio: "4/3",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 18,
        }}>
          {isImg ? (
            <img src={asset.file_url} alt={asset.name} style={{ maxWidth: "70%", maxHeight: "70%", objectFit: "contain" }} />
          ) : (
            <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: dark ? 0.6 : 0.45 }}>
              {asset.file_type}
            </div>
          )}
        </div>
      </a>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ ...sans, fontSize: 12, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</span>
        <button onClick={onDelete} style={{ ...mono, fontSize: 10, background: "transparent", border: "none", color: "var(--ink)", opacity: 0.35, cursor: "pointer", padding: 0 }}>✕</button>
      </div>
    </div>
  )
}

function FileRow({ asset, onDelete }: { asset: Asset; onDelete: () => void }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 100px 90px 60px",
      gap: 16, alignItems: "baseline", padding: "12px 0",
      borderBottom: "0.5px solid rgba(15,15,14,0.08)",
    }}>
      <a href={asset.file_url} target="_blank" rel="noopener noreferrer" style={{ ...sans, fontSize: 14, opacity: 0.9, textDecoration: "none", color: "inherit" }}>
        {asset.name}
      </a>
      <span style={{ ...mono, fontSize: 9, letterSpacing: "0.1em", opacity: 0.5 }}>{asset.file_type}</span>
      <span style={{ ...mono, fontSize: 9, letterSpacing: "0.08em", opacity: 0.5 }}>{fileSize(asset.file_size_bytes)}</span>
      <button onClick={onDelete} style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", background: "transparent", border: "none", color: "var(--ink)", opacity: 0.35, cursor: "pointer", textAlign: "right" }}>
        Remove
      </button>
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

function isLight(hex: string): boolean {
  const h = (hex ?? "").replace("#", "").trim()
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65
}
