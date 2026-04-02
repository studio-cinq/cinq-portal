import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { requireAdmin } from "@/lib/admin-auth"

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    // Delete annotations first (foreign key dependency)
    await (supabaseAdmin.from("review_annotations") as any)
      .delete()
      .eq("session_id", sessionId)

    // Delete the session
    const { error } = await (supabaseAdmin.from("review_sessions") as any)
      .delete()
      .eq("id", sessionId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete review" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[delete-review]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
