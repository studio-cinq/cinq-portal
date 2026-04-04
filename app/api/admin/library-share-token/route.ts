import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { requireAdmin } from "@/lib/admin-auth"
import crypto from "crypto"

const db = supabaseAdmin as any

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { clientId } = await req.json()
    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 })

    const { data: client } = await db
      .from("clients")
      .select("library_share_token")
      .eq("id", clientId)
      .single()

    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

    if (client.library_share_token) {
      return NextResponse.json({ token: client.library_share_token })
    }

    const token = crypto.randomUUID()
    await db
      .from("clients")
      .update({ library_share_token: token })
      .eq("id", clientId)

    return NextResponse.json({ token })
  } catch (err) {
    console.error("[library-share-token]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { clientId } = await req.json()
    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 })

    await db
      .from("clients")
      .update({ library_share_token: null })
      .eq("id", clientId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[library-share-token-revoke]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
