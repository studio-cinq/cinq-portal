import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    await (supabaseAdmin.from("review_sessions") as any)
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", sessionId)
      .is("viewed_at", null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
