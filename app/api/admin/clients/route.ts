import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { requireAdmin } from "@/lib/admin-auth"

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const { id, name, contact_name, contact_email, logo_url, notes } = body

    if (!id)   return NextResponse.json({ error: "Missing client ID." }, { status: 400 })
    if (!name || !contact_name || !contact_email) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
    }

    const { data, error } = await (supabaseAdmin
      .from("clients") as any)
      .update({ name, contact_name, contact_email, logo_url, notes })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A client with that email already exists." }, { status: 409 })
      }
      console.error("[api/admin/clients PATCH]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ client: data })
  } catch (err) {
    console.error("[api/admin/clients PATCH]", err)
    return NextResponse.json({ error: "Server error." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const { name, contact_name, contact_email, logo_url, notes } = body

    if (!name || !contact_name || !contact_email) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert({ name, contact_name, contact_email, logo_url, notes } as any)
      .select()
      .single()

    if (error) {
      // Catch duplicate email
      if (error.code === "23505") {
        return NextResponse.json({ error: "A client with that email already exists." }, { status: 409 })
      }
      console.error("[api/admin/clients]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ client: data })
  } catch (err) {
    console.error("[api/admin/clients]", err)
    return NextResponse.json({ error: "Server error." }, { status: 500 })
  }
}
