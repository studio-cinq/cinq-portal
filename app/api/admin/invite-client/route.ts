import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const { email, clientName } = await req.json()
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 })

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/update-password`,
      data: { client_name: clientName ?? "" },
    })

    if (error) {
      console.error("[invite-client]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user: data.user })
  } catch (err) {
    console.error("[invite-client]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}