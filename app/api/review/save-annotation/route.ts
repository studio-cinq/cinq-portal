import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const { sessionId, xPercent, yPercent, comment, pageUrl } = await req.json()
    if (!sessionId || !comment?.trim()) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const { data: session } = await (supabaseAdmin.from("review_sessions") as any)
      .select("current_round").eq("id", sessionId).single()

    const { data, error } = await (supabaseAdmin.from("review_annotations") as any)
      .insert({
        session_id: sessionId,
        round: session?.current_round ?? 1,
        page_url: pageUrl ?? "",
        x_percent: xPercent ?? 0,
        y_percent: yPercent ?? 0,
        viewport_w: 0,
        viewport_h: 0,
        comment: comment.trim(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ annotation: data })
  } catch (err) {
    console.error("[save-annotation]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
