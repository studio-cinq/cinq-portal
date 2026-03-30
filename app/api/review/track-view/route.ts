import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ ok: true })

    // Check if already viewed
    const { data: session } = await (supabaseAdmin.from("review_sessions") as any)
      .select("id, viewed_at, site_url, project_id, client_id")
      .eq("id", sessionId)
      .single()

    if (!session || session.viewed_at) return NextResponse.json({ ok: true })

    // Mark as viewed
    await (supabaseAdmin.from("review_sessions") as any)
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", sessionId)

    // Notify admin
    const { data: client } = await (supabaseAdmin.from("clients") as any)
      .select("name, contact_name")
      .eq("id", session.client_id)
      .single()

    const { data: project } = await (supabaseAdmin.from("projects") as any)
      .select("title")
      .eq("id", session.project_id)
      .single()

    await resend.emails.send({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? "kacie@studiocinq.com",
      subject: `Review opened — ${client?.name ?? "Client"}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 24px">${client?.contact_name ?? "A client"} opened their website review</h2>
          <p style="font-size:14px;line-height:1.7;color:#2C2820">Project: ${project?.title ?? "Unknown"}</p>
          <p style="font-size:14px;line-height:1.7;color:#2C2820">Site: ${session.site_url}</p>
        </div>
      `,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[review/track-view]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
