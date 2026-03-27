import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 })

    await (supabaseAdmin.from("clients") as any)
      .update({ last_seen_at: new Date().toISOString() })
      .eq("contact_email", email)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
