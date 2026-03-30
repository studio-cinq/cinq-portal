import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendReviewSubmittedEmail } from "@/lib/email"

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

    // Update session status
    await (supabaseAdmin.from("review_sessions") as any)
      .update({ status: "revising", submitted_at: new Date().toISOString() })
      .eq("id", sessionId)

    // Count annotations for this round
    const { count } = await (supabaseAdmin.from("review_annotations") as any)
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("round", session.current_round)

    // Notify admin
    await sendReviewSubmittedEmail({
      sessionId,
      projectTitle: session.projects?.title ?? "Unknown",
      clientName: session.clients?.name ?? "Client",
      contactName: session.clients?.contact_name ?? "Client",
      round: session.current_round,
      annotationCount: count ?? 0,
    }).catch(console.error)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[review/submit-round]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
