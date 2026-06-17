import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { trySendEmail } from "@/lib/resend"

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com"
const STUDIO_EMAIL = "kacie@studiocinq.com"

export async function POST(req: Request) {
  try {
    const { planId, isReturnView } = await req.json()
    if (!planId) return NextResponse.json({ ok: true })

    const { data: plan } = await (supabaseAdmin.from("plans") as any)
      .select("title, clients(name, contact_name)")
      .eq("id", planId).single()

    if (!plan) return NextResponse.json({ ok: true })

    const client = plan.clients as any
    const planUrl = `${PORTAL_URL}/admin/plans/${planId}/edit`
    const heading = isReturnView
      ? `${client?.contact_name ?? "A client"} is looking at the direction plan again`
      : `${client?.contact_name ?? "A client"} opened the direction plan`
    const subject = isReturnView
      ? `Direction plan revisited — ${client?.name ?? "Client"}`
      : `Direction plan opened — ${client?.name ?? "Client"}`

    await trySendEmail({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? STUDIO_EMAIL,
      subject,
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 16px">${heading}</h2>
          <p style="font-size:14px;opacity:0.75">${plan.title}</p>
          <p style="margin-top:24px"><a href="${planUrl}" style="color:#1C1916">Open in admin →</a></p>
        </div>
      `,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[notify/plan-viewed]", err)
    return NextResponse.json({ ok: true })
  }
}
