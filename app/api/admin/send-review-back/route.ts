import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendReviewInviteEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const { sessionId, notes } = await req.json()
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })

    // Get session with relations
    const { data: session } = await (supabaseAdmin.from("review_sessions") as any)
      .select("*, clients(name, contact_name, contact_email), projects(title)")
      .eq("id", sessionId)
      .single()

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

    const newRound = session.current_round + 1

    // Update session: bump round, reset status
    await (supabaseAdmin.from("review_sessions") as any)
      .update({
        current_round: newRound,
        status: "in_review",
        submitted_at: null,
        viewed_at: null,
        notes: notes || session.notes,
      })
      .eq("id", sessionId)

    // Email client
    if (session.clients) {
      await sendReviewInviteEmail({
        sessionId,
        projectTitle: session.projects?.title ?? "Unknown",
        clientName: session.clients.name,
        contactName: session.clients.contact_name,
        contactEmail: session.clients.contact_email,
        siteUrl: session.site_url,
        round: newRound,
        notes,
      }).catch(console.error)
    }

    return NextResponse.json({ ok: true, newRound })
  } catch (err) {
    console.error("[admin/send-review-back]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
