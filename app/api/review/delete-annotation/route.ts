import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const { annotationId } = await req.json()
    await (supabaseAdmin.from("review_annotations") as any).delete().eq("id", annotationId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[delete-annotation]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
