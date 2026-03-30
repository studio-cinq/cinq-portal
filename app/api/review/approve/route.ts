import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendReviewApprovedEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })

    // Get session with relations
    const { data: session } = await (supabaseAdmin.from("review_sessions") as any)
      .select("*, clients(name, contact_name), projects(title)")
      .eq("id", sessionId)
      .single()

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

    // Update session
    await (supabaseAdmin.from("review_sessions") as any)
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", sessionId)

    // Notify admin
    await sendReviewApprovedEmail({
      sessionId,
      projectTitle: session.projects?.title ?? "Unknown",
      clientName: session.clients?.name ?? "Client",
      contactName: session.clients?.contact_name ?? "Client",
      totalRounds: session.current_round,
    }).catch(console.error)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[review/approve]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
