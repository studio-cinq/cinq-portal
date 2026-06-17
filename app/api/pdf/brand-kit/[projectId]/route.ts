import { NextResponse } from "next/server"
import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"
import { supabaseAdmin } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com"

/**
 * Renders the brand kit page server-side via headless Chromium and returns
 * the result as a PDF download. Hits the public URL with ?print=1 so the
 * page hides interactive affordances.
 */
export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.projectId)
    const { data: project } = await (supabaseAdmin.from("projects") as any)
      .select("id, slug, clients(name)")
      .eq(isUuid ? "id" : "slug", params.projectId)
      .maybeSingle()
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const targetUrl = `${PORTAL_URL}/brand-kit/${(project as any).slug || (project as any).id}?print=1`

    const executablePath = process.env.CHROMIUM_PATH || await chromium.executablePath()
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 1800, deviceScaleFactor: 2 },
      executablePath,
      headless: chromium.headless as any,
    })

    const page = await browser.newPage()
    await page.emulateMediaType("screen")
    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 50000 })
    // Give custom @font-face uploads a beat to load before snapshotting type.
    await page.evaluate(() => (document as any).fonts?.ready?.catch?.(() => {}))
    await new Promise(r => setTimeout(r, 800))

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: false,
      format: "letter",
      margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
    })

    const safeName = ((project as any).clients?.name ?? "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-brand-kit.pdf"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("[pdf/brand-kit]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
