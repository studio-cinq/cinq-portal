import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { projectId, messageBody, senderEmail } = await req.json()
    if (!projectId || !messageBody) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const { data: project } = await (supabaseAdmin.from("projects") as any)
      .select("title, client_id, clients(name, contact_name)")
      .eq("id", projectId)
      .single()

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const client = project.clients as any
    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com"
    const clientUrl = `${portalUrl}/admin/clients/${project.client_id}`

    await resend.emails.send({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? "kacie@studiocinq.com",
      subject: `New message from ${client?.contact_name ?? "a client"} — ${project.title}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 24px">${client?.contact_name ?? "A client"} sent you a message</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5;width:100px">Client</td><td style="padding:8px 0;border-bottom:1px solid #eee">${client?.name ?? "—"}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5">Project</td><td style="padding:8px 0;border-bottom:1px solid #eee">${project.title}</td></tr>
          </table>
          <div style="background:#F0EBE3;border:0.5px solid #DDD6CC;padding:16px 20px;margin-bottom:24px;font-size:14px;line-height:1.7;font-style:italic;color:#2C2820">
            "${messageBody.length > 300 ? messageBody.slice(0, 300) + "…" : messageBody}"
          </div>
          <a href="${clientUrl}" style="display:inline-block;background:#1C1916;color:#F6F4EF;padding:10px 22px;font-family:monospace;font-size:12px;text-decoration:none;letter-spacing:0.06em">View & reply →</a>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[notify/client-message]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
