import { NextResponse } from "next/server"
import JSZip from "jszip"
import { supabaseAdmin } from "@/lib/supabase-server"

/**
 * Streams a zip of every file tagged for the given (project, mark name,
 * colorway) — the mark spread's "Download all" button hits this.
 *
 * Public on purpose: the brand kit page itself is shareable without auth,
 * so the zip endpoint is too. The (projectId, markName, colorwayId) tuple
 * is the access token.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const projectId = url.searchParams.get("projectId") ?? ""
    const markName = url.searchParams.get("mark") ?? ""
    const colorwayId = url.searchParams.get("colorwayId") ?? ""
    if (!projectId || !markName || !colorwayId) {
      return NextResponse.json({ error: "Missing required params" }, { status: 400 })
    }

    // Pull files for this mark group, filtered to the chosen colorway
    // (plus source files where color_id is null — those ride along with every
    // colorway download, same as the format chip panel in the UI).
    const [{ data: files }, { data: colorway }, { data: project }] = await Promise.all([
      (supabaseAdmin.from("brand_assets") as any)
        .select("name, file_url, file_type, color_id")
        .eq("project_id", projectId)
        .eq("category", "logo")
        .eq("name", markName),
      (supabaseAdmin.from("color_swatches") as any)
        .select("name").eq("id", colorwayId).maybeSingle(),
      (supabaseAdmin.from("projects") as any)
        .select("slug, clients(name)").eq("id", projectId).maybeSingle(),
    ])

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files for this mark" }, { status: 404 })
    }

    // Mirror the public page's bundling logic: prefer the colorway-tagged
    // file per format, fall back to the source (color_id is null) file.
    const FORMAT_ORDER = ["svg", "png", "jpg", "jpeg", "webp", "pdf", "eps", "ai"]
    const byFormat = new Map<string, any>()
    for (const f of files as any[]) {
      const fmt = (f.file_type ?? "").toLowerCase()
      const isMatch = f.color_id === colorwayId
      const isGeneric = !f.color_id
      if (!isMatch && !isGeneric) continue
      const existing = byFormat.get(fmt)
      if (!existing || (existing.color_id == null && isMatch)) {
        byFormat.set(fmt, f)
      }
    }
    const bundle = Array.from(byFormat.values()).sort((a, b) => {
      const ai = FORMAT_ORDER.indexOf((a.file_type ?? "").toLowerCase())
      const bi = FORMAT_ORDER.indexOf((b.file_type ?? "").toLowerCase())
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    })

    if (bundle.length === 0) {
      return NextResponse.json({ error: "No files for this colorway" }, { status: 404 })
    }

    const zip = new JSZip()
    const clientName = (project as any)?.clients?.name ?? "brand"
    const colorName = (colorway as any)?.name ?? "colorway"
    const safe = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    const folder = `${safe(clientName)}-${safe(markName)}-${safe(colorName)}`

    await Promise.all(bundle.map(async (f: any) => {
      try {
        const res = await fetch(f.file_url)
        if (!res.ok) return
        const buf = Buffer.from(await res.arrayBuffer())
        const ext = (f.file_type ?? "").toLowerCase()
        zip.file(`${folder}/${safe(markName)}-${safe(colorName)}.${ext}`, buf)
      } catch (err) {
        console.error("[brand-kit/download] fetch fail", f.file_url, err)
      }
    }))

    const blob = await zip.generateAsync({ type: "nodebuffer" })
    return new NextResponse(blob as any, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${folder}.zip"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("[brand-kit/download]", err)
    return NextResponse.json({ error: "Zip failed" }, { status: 500 })
  }
}
