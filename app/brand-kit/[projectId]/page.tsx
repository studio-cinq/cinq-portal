import { createServerComponentClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import CinqLogo from "@/components/CinqLogo"
import SwatchCopyClient from "./SwatchCopyClient"

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" }
const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" }

const INK = "#1C1916"
const CREAM = "#F5F1EA"

function fmt(d: string | null | undefined) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function fileSize(bytes?: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function pickDarkFlag(name: string): boolean {
  const n = (name ?? "").toLowerCase()
  return n.includes("reverse") || n.includes("dark") || n.includes("white") || n.includes("inverse")
}

export default async function BrandKitPage({ params }: { params: { projectId: string } }) {
  const supabase = await createServerComponentClient()

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, scope, created_at, clients(name)")
    .eq("id", params.projectId).single()

  if (!project) return notFound()

  const [{ data: assetsRaw }, { data: colorsRaw }, { data: typefacesRaw }] = await Promise.all([
    supabase.from("brand_assets").select("*").eq("project_id", params.projectId).order("sort_order"),
    supabase.from("color_swatches").select("*").eq("project_id", params.projectId).order("sort_order"),
    supabase.from("typeface_entries").select("*").eq("project_id", params.projectId).order("sort_order"),
  ])

  const assets = (assetsRaw ?? []) as any[]
  const colors = (colorsRaw ?? []) as any[]
  const typefaces = (typefacesRaw ?? []) as any[]

  const logoAssets = assets.filter(a => a.category === "logo")
  const guideAssets = assets.filter(a => a.category === "guidelines")
  const otherAssets = assets.filter(a => !["logo", "guidelines"].includes(a.category))

  // ─── Group logo files by display name so different formats of the
  // same mark show as one tile with download chips ─────────────────
  type LogoGroup = {
    name: string                 // display name (the basename, kept as-uploaded)
    preview: any                 // the file used for the preview tile
    files: any[]                 // all files in this group, ordered for chips
    minSort: number              // smallest sort_order in the group (for ordering groups)
  }

  // Format preference for which file becomes the preview tile
  const PREVIEW_RANK: Record<string, number> = {
    svg: 0, png: 1, webp: 2, jpg: 3, jpeg: 3, pdf: 4,
  }
  // Format preference for the order of download chips beneath each tile
  const CHIP_RANK: Record<string, number> = {
    svg: 0, png: 1, jpg: 2, jpeg: 2, webp: 3, pdf: 4, eps: 5, ai: 6,
  }

  const logoGroupMap = new Map<string, LogoGroup>()
  for (const a of logoAssets) {
    // Normalize the basename for grouping (lowercase, collapse separators).
    // The displayed name preserves the original casing of the first file
    // we encounter for that group.
    const normKey = (a.name ?? "").toString().trim().toLowerCase().replace(/[\s_]+/g, "-")
    const existing = logoGroupMap.get(normKey)
    if (!existing) {
      logoGroupMap.set(normKey, {
        name: a.name ?? "Mark",
        preview: a,
        files: [a],
        minSort: a.sort_order ?? 0,
      })
    } else {
      existing.files.push(a)
      if ((a.sort_order ?? 0) < existing.minSort) existing.minSort = a.sort_order ?? 0
      // If this file ranks higher as a preview candidate, swap it in
      const incoming = PREVIEW_RANK[(a.file_type ?? "").toLowerCase()] ?? 99
      const current = PREVIEW_RANK[(existing.preview.file_type ?? "").toLowerCase()] ?? 99
      if (incoming < current) existing.preview = a
    }
  }

  const logoGroups: LogoGroup[] = Array.from(logoGroupMap.values())
    .map(g => ({
      ...g,
      files: [...g.files].sort((a, b) => {
        const ar = CHIP_RANK[(a.file_type ?? "").toLowerCase()] ?? 99
        const br = CHIP_RANK[(b.file_type ?? "").toLowerCase()] ?? 99
        if (ar !== br) return ar - br
        return (a.file_type ?? "").localeCompare(b.file_type ?? "")
      }),
    }))
    .sort((a, b) => a.minSort - b.minSort)

  const client = (project as any).clients
  const hasAnything = assets.length > 0 || colors.length > 0 || typefaces.length > 0

  return (
    <div style={{ background: CREAM, minHeight: "100vh" }}>

      {/* ─── Cover ─────────────────────────────────────────────── */}
      <section style={{
        background: INK, color: CREAM,
        padding: "clamp(60px, 12vh, 140px) clamp(28px, 6vw, 80px)",
        position: "relative", overflow: "hidden",
        minHeight: "70vh",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <CinqLogo width={28} color={CREAM} />
          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.4 }}>
            Brand Kit · {fmt((project as any).created_at)}
          </div>
        </div>

        <div style={{ marginTop: "auto", maxWidth: 780 }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.5, marginBottom: 18 }}>
            {client?.name ?? "Brand"}
          </div>
          <h1 style={{
            ...sans, margin: 0, fontWeight: 400,
            fontSize: "clamp(40px, 7vw, 80px)",
            letterSpacing: "-0.025em", lineHeight: 1.05, opacity: 0.96,
          }}>
            {project.title}
          </h1>
          <div style={{ ...serif, fontStyle: "italic", fontSize: 18, opacity: 0.55, marginTop: 22, maxWidth: 540, lineHeight: 1.55 }}>
            A working reference for the brand — marks, color, type, and the files that bring it to life.
          </div>
        </div>
      </section>

      {!hasAnything && (
        <div style={{ ...serif, fontStyle: "italic", fontSize: 18, opacity: 0.45, textAlign: "center", padding: "120px 28px" }}>
          This brand kit is being prepared. Files will appear here as the work is delivered.
        </div>
      )}

      {/* ─── Marks ─────────────────────────────────────────────── */}
      {logoGroups.length > 0 && (
        <section style={{ padding: "clamp(80px, 10vw, 140px) clamp(28px, 6vw, 80px)", maxWidth: 1200, margin: "0 auto" }}>
          <SectionHeader number="01" label="Marks" lede="The wordmark and supporting marks. Use these files exactly as supplied — do not recreate or modify." />

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "clamp(16px, 2vw, 24px)",
            marginTop: 56,
          }}>
            {logoGroups.map(group => {
              const dark = pickDarkFlag(group.name)
              const preview = group.preview
              return (
                <div key={group.name} style={{ display: "block" }}>
                  <a
                    href={preview.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    <div style={{
                      background: dark ? INK : "rgba(28,25,22,0.04)",
                      border: dark ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid rgba(28,25,22,0.08)",
                      aspectRatio: "4/3",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "clamp(20px, 3vw, 36px)",
                      transition: "background 0.2s",
                    }}>
                      {/(svg|png|jpg|jpeg|webp)$/i.test(preview.file_type ?? "") ? (
                        <img src={preview.file_url} alt={group.name} style={{ maxWidth: "60%", maxHeight: "70%", objectFit: "contain" }} />
                      ) : (
                        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", opacity: dark ? 0.6 : 0.4 }}>
                          {preview.file_type?.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </a>

                  {/* Title + per-format download chips */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ ...sans, fontSize: 13, opacity: 0.85, marginBottom: 8 }}>{group.name}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {group.files.map(f => (
                        <a
                          key={f.id}
                          href={f.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          style={{
                            ...mono,
                            fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                            opacity: 0.55, textDecoration: "none", color: "inherit",
                            border: "0.5px solid rgba(28,25,22,0.18)",
                            padding: "4px 8px",
                            display: "inline-flex", alignItems: "center", gap: 6,
                            transition: "opacity 0.15s, border-color 0.15s",
                          }}
                          className="bk-format-chip"
                          title={`Download ${f.file_type}${f.file_size_bytes ? ` · ${fileSize(f.file_size_bytes)}` : ""}`}
                        >
                          <span>{f.file_type}</span>
                          <span style={{ opacity: 0.5 }}>↓</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <style>{`
            .bk-format-chip:hover { opacity: 0.9 !important; border-color: rgba(28,25,22,0.4) !important; }
          `}</style>
        </section>
      )}

      {/* ─── Color ─────────────────────────────────────────────── */}
      {colors.length > 0 && (
        <section style={{ padding: "clamp(80px, 10vw, 140px) clamp(28px, 6vw, 80px)", maxWidth: 1200, margin: "0 auto", borderTop: "0.5px solid rgba(28,25,22,0.08)" }}>
          <SectionHeader number={logoGroups.length > 0 ? "02" : "01"} label="Colour" lede="Click any swatch to copy its hex value." />

          <SwatchCopyClient swatches={colors.map(c => ({ id: c.id, name: c.name, hex: c.hex }))} />
        </section>
      )}

      {/* ─── Type ──────────────────────────────────────────────── */}
      {typefaces.length > 0 && (
        <section style={{ padding: "clamp(80px, 10vw, 140px) clamp(28px, 6vw, 80px)", maxWidth: 1200, margin: "0 auto", borderTop: "0.5px solid rgba(28,25,22,0.08)" }}>
          <SectionHeader
            number={String((logoGroups.length > 0 ? 1 : 0) + (colors.length > 0 ? 1 : 0) + 1).padStart(2, "0")}
            label="Type"
            lede="The typefaces that carry the brand voice."
          />

          <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 48 }}>
            {typefaces.map((tf: any) => (
              <div key={tf.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px", gap: 32, alignItems: "baseline", borderTop: "0.5px solid rgba(28,25,22,0.08)", paddingTop: 32 }}
                className="bk-type-row">
                <div>
                  <div style={{ ...sans, fontSize: "clamp(40px, 5.5vw, 64px)", letterSpacing: "-0.02em", lineHeight: 1.05, opacity: 0.92, marginBottom: 14 }}>
                    {tf.name}
                  </div>
                  <div style={{ ...mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.45 }}>
                    {[tf.weight, tf.role].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {tf.file_url ? (
                    <a href={tf.file_url} target="_blank" rel="noopener noreferrer" download style={{
                      ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                      color: INK, opacity: 0.65, textDecoration: "none",
                      border: "0.5px solid rgba(28,25,22,0.2)", padding: "9px 14px",
                      display: "inline-block",
                    }}>
                      Download file ↓
                    </a>
                  ) : (
                    <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.35 }}>
                      Licensed font — see notes
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Guidelines + other files ──────────────────────────── */}
      {(guideAssets.length > 0 || otherAssets.length > 0) && (
        <section style={{ padding: "clamp(80px, 10vw, 140px) clamp(28px, 6vw, 80px)", maxWidth: 1200, margin: "0 auto", borderTop: "0.5px solid rgba(28,25,22,0.08)" }}>
          <SectionHeader
            number={String((logoGroups.length > 0 ? 1 : 0) + (colors.length > 0 ? 1 : 0) + (typefaces.length > 0 ? 1 : 0) + 1).padStart(2, "0")}
            label="Files"
            lede="Source files, guidelines, and supporting materials."
          />

          <div style={{ marginTop: 56, borderTop: "0.5px solid rgba(28,25,22,0.08)" }}>
            {[...guideAssets, ...otherAssets].map((a: any) => (
              <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer" download style={{
                display: "grid", gridTemplateColumns: "1fr 140px 90px", gap: 24, alignItems: "baseline",
                padding: "18px 0", borderBottom: "0.5px solid rgba(28,25,22,0.08)",
                textDecoration: "none", color: "inherit",
              }}>
                <div>
                  <div style={{ ...sans, fontSize: 15, opacity: 0.9 }}>{a.name}</div>
                  <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.42, marginTop: 3 }}>
                    {a.category}
                  </div>
                </div>
                <div style={{ ...mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}>
                  {a.file_type}{a.file_size_bytes ? ` · ${fileSize(a.file_size_bytes)}` : ""}
                </div>
                <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.55, textAlign: "right" }}>
                  Download ↓
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ─── Footer ────────────────────────────────────────────── */}
      <footer style={{ borderTop: "0.5px solid rgba(28,25,22,0.08)", padding: "60px clamp(28px, 6vw, 80px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.4 }}>
          Studio Cinq · Brand Kit · {client?.name ?? ""}
        </div>
        <CinqLogo width={22} />
      </footer>

      <style>{`
        @media (max-width: 720px) {
          .bk-type-row { grid-template-columns: 1fr !important; gap: 16px !important; }
          .bk-type-row > div:last-child { text-align: left !important; }
        }
      `}</style>
    </div>
  )
}

function SectionHeader({ number, label, lede }: { number: string; label: string; lede?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "60px minmax(0, 1fr)", gap: 24, alignItems: "baseline" }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.4 }}>
        {number}
      </div>
      <div>
        <div style={{ ...sans, fontSize: "clamp(28px, 3.5vw, 38px)", letterSpacing: "-0.015em", margin: 0, opacity: 0.93 }}>
          {label}
        </div>
        {lede && (
          <div style={{ ...serif, fontStyle: "italic", fontSize: 16, opacity: 0.55, lineHeight: 1.55, marginTop: 10, maxWidth: 540 }}>
            {lede}
          </div>
        )}
      </div>
    </div>
  )
}
