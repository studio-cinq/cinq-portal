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
      .update({ status: "revising", submitted_at: new Date().toISOString() })
      .eq("id", sessionId)

    const { count } = await (supabaseAdmin.from("review_annotations") as any)
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("round", session?.current_round ?? 1)

    const client = session?.clients as any
    const project = session?.projects as any

    await trySendEmail({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? "kacie@studiocinq.com",
      subject: `Review feedback submitted — ${client?.name ?? "Client"}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 24px">${client?.contact_name ?? "A client"} submitted review feedback</h2>
          <p style="font-size:14px;line-height:1.7;color:#2C2820">Round ${session?.current_round ?? 1} · ${count ?? 0} annotation${count !== 1 ? "s" : ""}</p>
          <p style="font-size:13px;color:#6B6258">${project?.title ?? "Website review"}</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/reviews/${sessionId}" style="display:inline-block;margin-top:16px;background:#1C1916;color:#F6F4EF;padding:10px 22px;font-family:monospace;font-size:12px;text-decoration:none;letter-spacing:0.06em">View feedback →</a>
        </div>
      `,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[submit-round]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
