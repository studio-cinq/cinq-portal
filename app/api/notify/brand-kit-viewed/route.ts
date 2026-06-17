import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { trySendEmail } from "@/lib/resend"

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com"
const STUDIO_EMAIL = "kacie@studiocinq.com"

export async function POST(req: Request) {
  try {
    const { projectId, isReturnView } = await req.json()
    if (!projectId) return NextResponse.json({ ok: true })

    const { data: project } = await (supabaseAdmin.from("projects") as any)
      .select("title, slug, clients(name, contact_name)")
      .eq("id", projectId).single()

    if (!project) return NextResponse.json({ ok: true })

    const client = project.clients as any
    const adminUrl = `${PORTAL_URL}/admin/projects/${projectId}/brand-kit`
    const heading = isReturnView
      ? `${client?.contact_name ?? "A client"} is looking at the brand kit again`
      : `${client?.contact_name ?? "A client"} opened the brand kit`
    const subject = isReturnView
      ? `Brand kit revisited — ${client?.name ?? "Client"}`
      : `Brand kit opened — ${client?.name ?? "Client"}`

    await trySendEmail({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? STUDIO_EMAIL,
      subject,
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 16px">${heading}</h2>
          <p style="font-size:14px;opacity:0.75">${project.title}</p>
          <p style="margin-top:24px"><a href="${adminUrl}" style="color:#1C1916">Open in admin →</a></p>
        </div>
      `,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[notify/brand-kit-viewed]", err)
    return NextResponse.json({ ok: true })
  }
}
