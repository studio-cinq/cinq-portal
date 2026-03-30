import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const { sessionId, pageUrl, xPercent, yPercent, viewportW, viewportH, comment } = await req.json()

    if (!sessionId || !pageUrl || xPercent == null || yPercent == null || !comment) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get current round from session
    const { data: session } = await (supabaseAdmin.from("review_sessions") as any)
      .select("current_round")
      .eq("id", sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const { data: annotation, error } = await (supabaseAdmin.from("review_annotations") as any)
      .insert({
        session_id: sessionId,
        round: session.current_round,
        page_url: pageUrl,
        x_percent: xPercent,
        y_percent: yPercent,
        viewport_w: viewportW,
        viewport_h: viewportH,
        comment,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to save annotation" }, { status: 500 })
    }

    return NextResponse.json({ annotation, ok: true })
  } catch (err) {
    console.error("[review/save-annotation]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
