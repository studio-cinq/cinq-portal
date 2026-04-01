import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 })

    const now = new Date().toISOString()

    // Check if this is the client's first login
    const { data: client } = await (supabaseAdmin.from("clients") as any)
      .select("first_login_at")
      .eq("contact_email", email)
      .single()

    const update: any = { last_seen_at: now }
    if (client && !client.first_login_at) {
      update.first_login_at = now
    }

    await (supabaseAdmin.from("clients") as any)
      .update(update)
      .eq("contact_email", email)

    return NextResponse.json({ ok: true, isFirstLogin: !client?.first_login_at })
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
