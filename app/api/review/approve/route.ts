import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { trySendEmail } from "@/lib/resend"

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    const { data: session } = await (supabaseAdmin.from("review_sessions") as any)
      .select("*, clients(name, contact_name), projects(title)")
      .eq("id", sessionId).single()

    if (!session) {
      return NextResponse.json({ error: "Review session not found" }, { status: 404 })
    }

    await (supabaseAdmin.from("review_sessions") as any)
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", sessionId)

    const client = session?.clients as any
    const project = session?.projects as any

    await trySendEmail({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? "kacie@studiocinq.com",
      subject: `Site approved 🎉 — ${client?.name ?? "Client"}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 24px">${client?.contact_name ?? "A client"} approved the site</h2>
          <p style="font-size:13px;color:#6B6258">${project?.title ?? "Website review"}</p>
        </div>
      `,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[approve]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
