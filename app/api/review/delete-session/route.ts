import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })

    await (supabaseAdmin.from("review_annotations") as any).delete().eq("session_id", sessionId)
    await (supabaseAdmin.from("review_sessions") as any).delete().eq("id", sessionId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[delete-session]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
