import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { requireAdmin } from "@/lib/admin-auth"

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { annotationId, resolved } = await req.json()
    await (supabaseAdmin.from("review_annotations") as any)
      .update({ resolved })
      .eq("id", annotationId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[resolve-annotation]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
