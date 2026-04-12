import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { trySendEmail } from "@/lib/resend"

export async function POST(req: Request) {
  try {
    const { foundationId, note } = await req.json()
    if (!foundationId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const { data: foundation } = await supabaseAdmin
      .from("brand_foundations")
      .select("id, title, clients(name, contact_name, contact_email)")
      .eq("id", foundationId)
      .single() as { data: any }

    if (!foundation) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const client = foundation.clients
    if (!client) return NextResponse.json({ error: "No client" }, { status: 404 })

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com"
    const approvedAt = new Date().toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      weekday: "long", month: "long", day: "numeric",
      year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
    })

    await trySendEmail({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? "kacie@studiocinq.com",
      subject: `Brand direction approved — ${client.name}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 24px">${client.contact_name} approved the brand direction</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px">
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5;width:120px">Project</td><td style="padding:8px 0;border-bottom:1px solid #eee">${foundation.title}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5">Client</td><td style="padding:8px 0;border-bottom:1px solid #eee">${client.name}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5">Approved</td><td style="padding:8px 0;border-bottom:1px solid #eee">${approvedAt}</td></tr>
            ${note ? `<tr><td style="padding:8px 0;opacity:0.5">Note</td><td style="padding:8px 0;font-style:italic">${note}</td></tr>` : ""}
          </table>
          <a href="${portalUrl}/admin/clients/${client.id ?? ""}" style="display:inline-block;background:#1C1916;color:#F6F4EF;padding:10px 22px;font-family:monospace;font-size:12px;text-decoration:none;letter-spacing:0.06em">View client →</a>
        </div>
      `,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[notify/foundations-approved]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
