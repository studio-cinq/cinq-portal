import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const { annotationId } = await req.json()
    if (!annotationId) return NextResponse.json({ error: "Missing annotationId" }, { status: 400 })

    await (supabaseAdmin.from("review_annotations") as any)
      .delete()
      .eq("id", annotationId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[review/delete-annotation]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
