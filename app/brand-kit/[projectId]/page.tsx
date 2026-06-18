import { createServerComponentClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import CinqLogo from "@/components/CinqLogo"
import SwatchCopyClient from "./SwatchCopyClient"
import MarkSpreadClient from "./MarkSpreadClient"
import TrackBrandKitView from "./TrackBrandKitView"

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" }
const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" }
const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" }

const INK = "#1C1916"
const CREAM = "#F5F1EA"
const PAPER = "#FBF7EE"
const LINE = "rgba(28,25,22,0.1)"
const MUTED = "rgba(28,25,22,0.55)"
const SOFT = "rgba(28,25,22,0.35)"

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

function fmtMonth(d: string | null | undefined) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

// Auto-derive RGB triplet from a hex string. Falls back to the stored value
// (if any) when the hex is unparseable.
function hexToRgbTriplet(hex: string, fallback?: string | null): string {
  const h = (hex ?? "").replace("#", "").trim()
  if (h.length !== 6) return fallback ?? ""
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return fallback ?? ""
  return `${r}, ${g}, ${b}`
}

// Compute the WCAG 2.1 relative luminance for a hex color.
function relativeLuminance(hex: string): number {
  const h = (hex ?? "").replace("#", "").trim()
  if (h.length !== 6) return 0
  const toLin = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  const r = toLin(parseInt(h.slice(0, 2), 16))
  const g = toLin(parseInt(h.slice(2, 4), 16))
  const b = toLin(parseInt(h.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

function contrastRating(ratio: number): "AAA" | "AA" | "AA Large" | "Fail" {
  if (ratio >= 7) return "AAA"
  if (ratio >= 4.5) return "AA"
  if (ratio >= 3) return "AA Large"
  return "Fail"
}

function isLight(hex: string): boolean {
  return relativeLuminance(hex) > 0.55
}

export default async function BrandKitPage({
  params,
  searchParams,
}: {
  params: { projectId: string }
  searchParams?: { print?: string }
}) {
  const supabase = await createServerComponentClient()
  const isPrint = searchParams?.print === "1"

  // The route param can be either the project UUID or a slug — try both so old
  // UUID links keep working alongside the pretty /brand-kit/loom-house form.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.projectId)
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, scope, created_at, slug, clients(name)")
    .eq(isUuid ? "id" : "slug", params.projectId)
    .maybeSingle()

  if (!project) return notFound()
  const projectId = (project as any).id

  const [{ data: kitRaw }, { data: assetsRaw }, { data: colorsRaw }, { data: typefacesRaw }] = await Promise.all([
    supabase.from("brand_kits").select("*").eq("project_id", projectId).maybeSingle(),
    supabase.from("brand_assets").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("color_swatches").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("typeface_entries").select("*").eq("project_id", projectId).order("sort_order"),
  ])

  const kit = (kitRaw ?? {}) as any
  const assets = (assetsRaw ?? []) as any[]
  const colors = (colorsRaw ?? []) as any[]
  const typefaces = (typefacesRaw ?? []) as any[]

  const logoAssets = assets.filter(a => a.category === "logo")
  const guideAssets = assets.filter(a => a.category === "guidelines")
  const otherAssets = assets.filter(a => !["logo", "guidelines"].includes(a.category))

  // Group logos by basename so 5 formats of the same mark = 1 spread w/ chips
  type LogoGroup = {
    name: string
    description: string | null
    usage: string | null
    primary_use: string | null
    colorwayIds: string[]
    preview: any
    files: any[]
    minSort: number
    displayScale: number
    defaultColorwayId: string | null
  }
  const PREVIEW_RANK: Record<string, number> = { svg: 0, png: 1, webp: 2, jpg: 3, jpeg: 3, pdf: 4 }
  const CHIP_RANK: Record<string, number> = { svg: 0, png: 1, jpg: 2, jpeg: 2, webp: 3, pdf: 4, eps: 5, ai: 6 }
  const groupMap = new Map<string, LogoGroup>()
  for (const a of logoAssets) {
    const key = (a.name ?? "").toString().trim().toLowerCase().replace(/[\s_]+/g, "-")
    const existing = groupMap.get(key)
    if (!existing) {
      groupMap.set(key, {
        name: a.name ?? "Mark",
        description: a.description ?? null,
        usage: a.usage ?? null,
        primary_use: a.primary_use ?? null,
        colorwayIds: [],
        preview: a,
        files: [a],
        minSort: a.sort_order ?? 0,
        displayScale: 1,
        defaultColorwayId: null,
      })
    } else {
      existing.files.push(a)
      if ((a.sort_order ?? 0) < existing.minSort) existing.minSort = a.sort_order ?? 0
      if (!existing.description && a.description) existing.description = a.description
      if (!existing.usage && a.usage) existing.usage = a.usage
      if (!existing.primary_use && a.primary_use) existing.primary_use = a.primary_use
      const incoming = PREVIEW_RANK[(a.file_type ?? "").toLowerCase()] ?? 99
      const current = PREVIEW_RANK[(existing.preview.file_type ?? "").toLowerCase()] ?? 99
      if (incoming < current) existing.preview = a
    }
  }
  const logoGroups: LogoGroup[] = Array.from(groupMap.values())
    .map(g => {
      // Derive colorways from each member file's color_id tag.
      const colorIds = new Set<string>()
      for (const f of g.files) {
        if (f.color_id) colorIds.add(f.color_id)
      }
      // Pick the smallest non-default display_scale present on any file in the
      // group — set it once on any sibling and the spread shrinks for the whole mark.
      const scales = g.files
        .map(f => typeof f.display_scale === "number" ? f.display_scale : null)
        .filter((v): v is number => v != null && v > 0)
      const displayScale = scales.length ? Math.min(...scales) : 1
      // Per-mark default colorway: take the first non-null value across the group.
      const defaultColorwayId = g.files
        .map(f => f.default_colorway_id as string | null | undefined)
        .find(v => v != null) ?? null
      return {
        ...g,
        colorwayIds: Array.from(colorIds),
        displayScale,
        defaultColorwayId,
        files: [...g.files].sort((a, b) => {
          const ar = CHIP_RANK[(a.file_type ?? "").toLowerCase()] ?? 99
          const br = CHIP_RANK[(b.file_type ?? "").toLowerCase()] ?? 99
          if (ar !== br) return ar - br
          return (a.file_type ?? "").localeCompare(b.file_type ?? "")
        }),
      }
    })
    .sort((a, b) => a.minSort - b.minSort)

  // Auto-build contrast matrix for swatches with valid hex
  const validColors = colors.filter(c => typeof c.hex === "string" && /^#?[0-9a-f]{6}$/i.test(c.hex.trim()))

  // Lightest & darkest palette swatches drive the mark spread backgrounds + captions.
  const swatchesByLuma = [...validColors].sort((a, b) => relativeLuminance(a.hex) - relativeLuminance(b.hex))
  const darkestSwatch = swatchesByLuma[0] ?? null
  const lightestSwatch = swatchesByLuma[swatchesByLuma.length - 1] ?? null
  const contrastPairs: { fg: any; bg: any; ratio: number; rating: string }[] = []
  for (const fg of validColors) {
    for (const bg of validColors) {
      if (fg.id === bg.id) continue
      const ratio = contrastRatio(fg.hex, bg.hex)
      if (ratio >= 3) {
        contrastPairs.push({ fg, bg, ratio, rating: contrastRating(ratio) })
      }
    }
  }
  // De-dup symmetric pairs (Ink-on-Oatmeal == Oatmeal-on-Ink). Show each pair once,
  // keeping the version with the darker text on the lighter background (conventional reading direction).
  const contrastSeen = new Set<string>()
  const dedupedContrast = contrastPairs
    .filter(p => {
      const key = [p.fg.id, p.bg.id].sort().join("|")
      if (contrastSeen.has(key)) return false
      contrastSeen.add(key)
      const fgLum = relativeLuminance(p.fg.hex)
      const bgLum = relativeLuminance(p.bg.hex)
      // Keep darker-on-lighter
      return fgLum < bgLum
    })
    .sort((a, b) => b.ratio - a.ratio)

  const client = (project as any).clients
  const hasAnything = assets.length > 0 || colors.length > 0 || typefaces.length > 0

  // Section numbering (only number sections that exist)
  let n = 0
  const num = () => String(++n).padStart(2, "0")
  const marksNum = logoGroups.length > 0 ? num() : null
  const colorNum = colors.length > 0 ? num() : null
  const typeNum = typefaces.length > 0 ? num() : null
  const inventoryNum = (guideAssets.length > 0 || otherAssets.length > 0) ? num() : null
  const misuseRules = Array.isArray(kit?.misuse_rules) ? kit.misuse_rules as any[] : []
  const misuseNum = misuseRules.length > 0 ? num() : null

  const eyebrow = kit?.eyebrow || "Brand Identity"
  const lede = kit?.lede || project.scope || "A working reference for the brand — marks, color, type, and the files that bring it to life."
  const metaLines: string[] = Array.isArray(kit?.meta_lines) ? kit.meta_lines : []

  return (
    <div style={{ background: CREAM, minHeight: "100vh" }}>

      {!isPrint && <TrackBrandKitView projectId={projectId} alreadyViewed={!!kit?.viewed_at} />}

      {isPrint && (
        <style>{`
          /* PDF render mode — hide interactive affordances and tighten
             vertical rhythm so each section reads as a printed page. */
          [data-print-hide="true"] { display: none !important; }
          a[download], button { cursor: default !important; }
          section { page-break-inside: avoid; break-inside: avoid; }
          .bk-mark-spread > * { page-break-inside: avoid; break-inside: avoid; }
          html, body { background: #F5F1EA !important; }
        `}</style>
      )}

      {/* ─── Cover ─────────────────────────────────────────────── */}
      <section style={{
        background: INK, color: CREAM,
        padding: "clamp(40px, 6vw, 80px) clamp(28px, 6vw, 80px)",
        position: "relative", overflow: "hidden",
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <CinqLogo width={28} color={CREAM} />
          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.4 }}>
            {kit?.kit_header?.trim() || `Brand Kit · ${fmtMonth((project as any).created_at)}`}
            {kit?.version && <span style={{ marginLeft: 14, opacity: 0.7 }}>{kit.version}</span>}
          </div>
        </div>

        <div style={{ marginTop: "auto", maxWidth: 820 }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(245,241,234,0.55)", marginBottom: 18 }}>
            {eyebrow}
          </div>
          <h1 style={{
            ...sans, margin: 0, fontWeight: 400,
            fontSize: "clamp(40px, 7vw, 80px)",
            letterSpacing: "-0.025em", lineHeight: 1.05, opacity: 0.97,
          }}>
            {client?.name ?? project.title}
          </h1>
          {lede && (
            <div style={{ ...serif, fontStyle: "italic", fontSize: "clamp(18px, 2vw, 22px)", opacity: 0.65, marginTop: 24, maxWidth: 640, lineHeight: 1.5 }}>
              {lede}
            </div>
          )}
          {metaLines.length > 0 && (
            <div style={{ marginTop: 36, display: "flex", flexWrap: "wrap", gap: 28 }}>
              {metaLines.map((line, i) => (
                <span key={i} style={{ ...mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(245,241,234,0.45)" }}>
                  {line}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {!hasAnything && (
        <div style={{ ...serif, fontStyle: "italic", fontSize: 18, opacity: 0.45, textAlign: "center", padding: "120px 28px" }}>
          This brand kit is being prepared. Files will appear here as the work is delivered.
        </div>
      )}

      {/* ─── Marks ─────────────────────────────────────────────── */}
      {logoGroups.length > 0 && (
        <section style={{ padding: "clamp(80px, 10vw, 140px) clamp(28px, 6vw, 80px) clamp(40px, 5vw, 80px)", maxWidth: 1200, margin: "0 auto", borderTop: `0.5px solid ${LINE}` }}>
          <SectionHeader number={marksNum!} label="Marks" lede={kit?.marks_intro ?? "The wordmark and supporting marks. Use these files exactly as supplied — do not recreate or modify."} />
        </section>
      )}

      {/* Each mark gets its own page-style spread — left text column, right
          two-stage stage (mark on light + mark on dark) */}
      {logoGroups.map((group, idx) => {
        const groupColorIds = new Set(group.colorwayIds)
        // Preserve the project's swatch sort order so pills always read in palette sequence.
        const colorways = colors.filter(c => groupColorIds.has(c.id))

        return (
          <section
            key={group.name}
            style={{
              padding: "clamp(40px, 6vw, 80px) clamp(28px, 6vw, 80px) clamp(60px, 8vw, 100px)",
              maxWidth: 1200, margin: "0 auto",
              borderTop: `0.5px solid ${LINE}`,
            }}
          >
            {/* Running header: number · mark name */}
            <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.5, marginBottom: 32, display: "flex", gap: 36 }}>
              <span>{String(idx + 1).padStart(2, "0")}</span>
              <span style={{ opacity: 0.85 }}>{(group.name ?? "").toUpperCase()}</span>
            </div>

            <MarkSpreadClient
              projectId={projectId}
              markName={group.name}
              description={group.description}
              primaryUse={group.primary_use}
              colorways={colorways.map((c: any) => ({ id: c.id, name: c.name, hex: c.hex }))}
              files={group.files.map((f: any) => ({
                id: f.id,
                file_url: f.file_url,
                file_type: f.file_type,
                file_size_bytes: f.file_size_bytes,
                color_id: f.color_id ?? null,
              }))}
              defaultColorwayId={group.defaultColorwayId}
              displayScale={group.displayScale}
            />
          </section>
        )
      })}
      <style>{`
        .bk-format-chip:hover { opacity: 0.95 !important; border-color: rgba(28,25,22,0.4) !important; }
        @media (max-width: 720px) {
          .bk-mark-spread { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ─── Color ────────────────────────────────────────────── */}
      {colors.length > 0 && (
        <section style={{ padding: "clamp(80px, 10vw, 140px) clamp(28px, 6vw, 80px)", maxWidth: 1100, margin: "0 auto", borderTop: `0.5px solid ${LINE}` }}>
          <SectionHeader number={colorNum!} label="Color" lede={kit?.color_intro ?? "Click any swatch to copy its hex value."} />

          <SwatchCopyClient
            panelColor={lightestSwatch?.hex}
            swatches={colors.map(c => ({
              id: c.id,
              name: c.name,
              hex: c.hex,
              rgb: c.rgb || hexToRgbTriplet(c.hex, null),
              cmyk: (c as any).cmyk ?? null,
              pms: (c as any).pms ?? null,
              tier: (c as any).tier ?? null,
              usage_note: c.usage_note,
            }))}
          />

          {dedupedContrast.length > 0 && (
            <div style={{ marginTop: 64 }}>
              <div style={{ ...mono, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.55, marginBottom: 18 }}>
                Contrast — WCAG 2.1
              </div>
              <div style={{ background: PAPER, border: `0.5px solid ${LINE}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Foreground", "Background", "Ratio", "Rating"].map(h => (
                        <th key={h} style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "left", padding: "12px 16px", borderBottom: `0.5px solid ${LINE}`, color: MUTED, fontWeight: 500 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dedupedContrast.map((p, i) => (
                      <tr key={i}>
                        <td style={{ padding: "12px 16px", borderBottom: i === dedupedContrast.length - 1 ? "none" : `0.5px solid ${LINE}` }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "inline-block", width: 14, height: 14, background: p.fg.hex, border: `0.5px solid ${LINE}` }} />
                            <span style={{ ...sans, opacity: 0.85 }}>{p.fg.name}</span>
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: i === dedupedContrast.length - 1 ? "none" : `0.5px solid ${LINE}` }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "inline-block", width: 14, height: 14, background: p.bg.hex, border: `0.5px solid ${LINE}` }} />
                            <span style={{ ...sans, opacity: 0.85 }}>{p.bg.name}</span>
                          </span>
                        </td>
                        <td style={{ ...mono, padding: "12px 16px", opacity: 0.85, borderBottom: i === dedupedContrast.length - 1 ? "none" : `0.5px solid ${LINE}` }}>
                          {p.ratio.toFixed(2)}:1
                        </td>
                        <td style={{ ...mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", padding: "12px 16px", color: p.rating === "AAA" ? "var(--sage)" : p.rating === "AA" ? "var(--ink)" : p.rating === "AA Large" ? "var(--amber)" : "var(--danger)", borderBottom: i === dedupedContrast.length - 1 ? "none" : `0.5px solid ${LINE}` }}>
                          {p.rating}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ ...sans, fontSize: 12, color: MUTED, marginTop: 14, lineHeight: 1.6, maxWidth: 620 }}>
                AAA passes for body text at any size. AA passes for body text at normal size.
                AA Large passes only for ≥18pt or ≥14pt bold. Pairings below 3:1 not shown.
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── Type ──────────────────────────────────────────────── */}
      {typefaces.length > 0 && (
        <section style={{ padding: "clamp(80px, 10vw, 140px) clamp(28px, 6vw, 80px)", maxWidth: 1100, margin: "0 auto", borderTop: `0.5px solid ${LINE}` }}>
          <SectionHeader number={typeNum!} label="Type" lede={kit?.type_intro ?? "The typefaces that carry the brand voice."} />

          {/* Inline font-face for any uploaded font files so specimens render in-brand */}
          {typefaces.some(t => t.file_url) && (
            <style>{
              typefaces.filter(t => t.file_url).map(t => `
                @font-face {
                  font-family: "kit-${t.id}";
                  src: url("${t.file_url}");
                  font-display: swap;
                }
              `).join("")
            }</style>
          )}

          <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 80 }}>
            {typefaces.map((tf: any) => {
              const customFamily = tf.file_url ? `"kit-${tf.id}", ${tf.role?.toLowerCase().includes("serif") ? "Georgia, serif" : "system-ui, sans-serif"}` : undefined
              const fontStack = customFamily ?? (tf.role?.toLowerCase().includes("serif") ? "Georgia, 'Times New Roman', serif" : "system-ui, -apple-system, sans-serif")
              const specimens = buildSpecimens(tf, project as any)
              return (
                <div key={tf.id}>
                  {/* Header row: typeface name + meta + download chips */}
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 24, alignItems: "flex-end", borderTop: `0.5px solid ${LINE}`, paddingTop: 28, paddingBottom: 18 }}>
                    <div>
                      <div style={{ ...mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.55, marginBottom: 8 }}>
                        {[tf.weight, tf.role].filter(Boolean).join(" · ") || "Typeface"}
                      </div>
                      <div style={{ ...sans, fontSize: 20, opacity: 0.92, letterSpacing: "-0.005em" }}>
                        {tf.name}
                      </div>
                      {tf.weights_note && (
                        <div style={{ ...sans, fontSize: 13, color: MUTED, marginTop: 8, lineHeight: 1.55, maxWidth: 540 }}>
                          {tf.weights_note}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {(() => {
                        const formats: Array<{ label: string; url: string }> = []
                        if (tf.file_url) {
                          const ext = (tf.file_url.split(".").pop() ?? "").toLowerCase()
                          formats.push({ label: ext === "woff" || ext === "woff2" ? ext.toUpperCase() : "Web", url: tf.file_url })
                        }
                        if (tf.desktop_zip_url) formats.push({ label: "Desktop", url: tf.desktop_zip_url })
                        // Legacy fields — only surface if no desktop zip exists yet.
                        if (!tf.desktop_zip_url) {
                          if (tf.otf_url) formats.push({ label: "OTF", url: tf.otf_url })
                          if (tf.ttf_url) formats.push({ label: "TTF", url: tf.ttf_url })
                        }
                        if (formats.length === 0) {
                          return (
                            <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
                              Licensed — see kit
                            </div>
                          )
                        }
                        return (
                          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                            <div style={{ ...mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>
                              Download
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {formats.map(f => (
                                <a
                                  key={f.label}
                                  href={f.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  style={{
                                    ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                                    color: INK, opacity: 0.7, textDecoration: "none",
                                    border: `0.5px solid ${LINE}`, padding: "6px 10px",
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                  }}
                                >
                                  <span>{f.label}</span>
                                  <span style={{ opacity: 0.5 }}>↓</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Specimen rows: each role/size demonstrates the typeface */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {specimens.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) 180px",
                          gap: 32,
                          alignItems: "baseline",
                          borderBottom: `0.5px solid ${LINE}`,
                          padding: "28px 0 24px",
                        }}
                        className="bk-type-row"
                      >
                        <div style={{
                          fontFamily: fontStack,
                          fontSize: s.size,
                          letterSpacing: s.tracking ?? "-0.01em",
                          lineHeight: s.leading ?? 1.1,
                          opacity: 0.94,
                          color: INK,
                          textTransform: s.caps ? "uppercase" : "none",
                        }}>
                          {s.sample}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>
                            {s.label} · {typeof s.size === "number" ? `${s.size}px` : s.size}
                          </div>
                          {(s.tracking || s.leading || s.caps) && (
                            <div style={{ ...mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: SOFT, marginTop: 4 }}>
                              {[
                                s.tracking ? `tr ${s.tracking}` : null,
                                s.leading ? `ld ${s.leading}` : null,
                                s.caps ? "caps" : null,
                              ].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ─── Misuse rules ──────────────────────────────────────── */}
      {misuseRules.length > 0 && (
        <section style={{ padding: "clamp(80px, 10vw, 140px) clamp(28px, 6vw, 80px)", maxWidth: 1100, margin: "0 auto", borderTop: `0.5px solid ${LINE}` }}>
          <SectionHeader number={misuseNum!} label="Misuse — never" lede="Common mistakes to avoid when using the system." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginTop: 36 }}>
            {misuseRules.map((r: any, i: number) => (
              <div key={i} style={{ background: PAPER, border: `0.5px solid ${LINE}`, padding: "18px 20px" }}>
                <div style={{ ...sans, fontWeight: 600, fontSize: 13, color: "var(--danger)", marginBottom: 8 }}>
                  ✕ {r.tag}
                </div>
                <div style={{ ...sans, fontSize: 13, color: MUTED, lineHeight: 1.55 }}>
                  {r.note}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Asset inventory ───────────────────────────────────── */}
      {inventoryNum && (
        <section style={{ padding: "clamp(80px, 10vw, 140px) clamp(28px, 6vw, 80px)", maxWidth: 1100, margin: "0 auto", borderTop: `0.5px solid ${LINE}` }}>
          <SectionHeader number={inventoryNum} label="Files for download" lede="Guidelines and source files that ship with this kit." />

          <div style={{ marginTop: 40, borderTop: `0.5px solid ${LINE}` }}>
            {[...guideAssets, ...otherAssets].map((a: any) => (
              <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer" download style={{
                display: "grid", gridTemplateColumns: "1fr 140px 90px", gap: 24, alignItems: "baseline",
                padding: "18px 0", borderBottom: `0.5px solid ${LINE}`,
                textDecoration: "none", color: "inherit",
              }}>
                <div>
                  <div style={{ ...sans, fontSize: 15, opacity: 0.9 }}>{a.name}</div>
                  <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.42, marginTop: 4 }}>
                    {a.category}
                  </div>
                </div>
                <div style={{ ...mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.55 }}>
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
      <footer style={{ borderTop: `0.5px solid ${LINE}`, padding: "60px clamp(28px, 6vw, 80px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED }}>
          Studio Cinq · Brand Kit · {client?.name ?? ""}{kit?.version ? ` · ${kit.version}` : ""}
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
    <div>
      <div style={{ ...mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.5, marginBottom: 24 }}>
        {number}
      </div>
      <h2 style={{ ...sans, fontSize: "clamp(28px, 3.8vw, 40px)", letterSpacing: "-0.02em", margin: 0, opacity: 0.95, lineHeight: 1.1, fontWeight: 400 }}>
        {label}
      </h2>
      {lede && (
        <div style={{ ...sans, fontSize: 16, color: "rgba(28,25,22,0.7)", lineHeight: 1.6, marginTop: 16, maxWidth: 620 }}>
          {lede}
        </div>
      )}
    </div>
  )
}


type Specimen = {
  label: string
  size: number
  sample: string
  tracking?: string
  leading?: string
  caps?: boolean
}

/**
 * Returns the specimen rows to render under a typeface. Honors a saved
 * `specimens` JSONB array on the typeface_entries row; falls back to a
 * sensible 5-row default scale seeded with the client name + tagline.
 */
function buildSpecimens(tf: any, project: any): Specimen[] {
  const saved = Array.isArray(tf?.specimens) ? tf.specimens : null
  if (saved && saved.length > 0) {
    return saved
      .filter((s: any) => s && typeof s.sample === "string" && s.sample.trim() && typeof s.size === "number" && s.size > 0)
      .map((s: any) => ({
        label: String(s.label ?? "").trim() || "Sample",
        size: Number(s.size),
        sample: String(s.sample),
        tracking: s.tracking?.trim() || undefined,
        leading: s.leading?.trim() || undefined,
        caps: Boolean(s.caps),
      }))
  }

  const brand = project?.clients?.name ?? "Brand"
  const role = (tf?.role ?? "").toLowerCase()
  const isDisplay = role.includes("display") || role.includes("heading") || role.includes("serif") || (!role.includes("body") && !role.includes("mono"))

  if (isDisplay) {
    return [
      { label: "Display",  size: 80, sample: brand, tracking: "0", leading: ".95" },
      { label: "Headline", size: 56, sample: "A working building, since 1930." },
      { label: "Title",    size: 36, sample: "Shops, Studios & Working Space" },
      { label: "Subhead",  size: 24, sample: tf?.weight ? `${tf.weight} weight specimen` : "Supporting line" },
      { label: "Caption",  size: 13, sample: "5000 Rossville Boulevard · Chattanooga", tracking: ".14em", caps: true },
    ]
  }
  return [
    { label: "Subhead", size: 22, sample: "How the system reads in working copy." },
    { label: "Body",    size: 18, sample: "A 1930 working building on Rossville Boulevard — shops, studios, and working space, kept as it was found and put back to use.", leading: "1.5" },
    { label: "Small",   size: 14, sample: "Footnotes, fine print, captions under photos.", leading: "1.5" },
    { label: "Caption", size: 13, sample: "5000 Rossville Boulevard · Chattanooga, Tenn.", tracking: ".14em", caps: true },
  ]
}
