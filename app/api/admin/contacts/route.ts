import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { requireAdmin } from "@/lib/admin-auth"

// Type helper — client_contacts isn't fully typed in the hand-written Database type
const db = supabaseAdmin as any

// GET — list contacts for a client
export async function GET(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get("client_id")
    if (!clientId) return NextResponse.json({ error: "Missing client_id" }, { status: 400 })

    const { data, error } = await db
      .from("client_contacts")
      .select("*")
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false })
      .order("created_at")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contacts: data ?? [] })
  } catch (err) {
    console.error("[contacts GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST — create a new contact
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const { client_id, name, email, role } = body

    if (!client_id) return NextResponse.json({ error: "Missing client_id" }, { status: 400 })
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })
    if (!email?.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 })

    // Check if email already exists for this client
    const { data: existing } = await db
      .from("client_contacts")
      .select("id")
      .eq("client_id", client_id)
      .eq("email", email.trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "A contact with this email already exists for this client" }, { status: 409 })
    }

    const { data, error } = await db
      .from("client_contacts")
      .insert({
        client_id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role?.trim() || null,
        is_primary: false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contact: data })
  } catch (err) {
    console.error("[contacts POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH — update a contact
export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const { id, name, email, role, is_primary } = body

    if (!id) return NextResponse.json({ error: "Missing contact id" }, { status: 400 })

    const updates: any = {}
    if (name !== undefined) updates.name = name.trim()
    if (email !== undefined) updates.email = email.trim().toLowerCase()
    if (role !== undefined) updates.role = role?.trim() || null
    if (is_primary !== undefined) {
      updates.is_primary = is_primary
      // If setting as primary, unset other primary contacts for this client
      if (is_primary) {
        const { data: contact } = await db
          .from("client_contacts")
          .select("client_id")
          .eq("id", id)
          .single()
        if (contact) {
          await db
            .from("client_contacts")
            .update({ is_primary: false })
            .eq("client_id", contact.client_id)
            .neq("id", id)
        }
      }
    }

    const { data, error } = await db
      .from("client_contacts")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contact: data })
  } catch (err) {
    console.error("[contacts PATCH]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE — remove a contact
export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const body = await req.json()
    const { id } = body

    if (!id) return NextResponse.json({ error: "Missing contact id" }, { status: 400 })

    // Check if contact is primary — can't delete primary
    const { data: contact } = await db
      .from("client_contacts")
      .select("is_primary, client_id")
      .eq("id", id)
      .single()

    if (contact?.is_primary) {
      return NextResponse.json({ error: "Cannot delete the primary contact. Set another contact as primary first." }, { status: 400 })
    }

    // Unassign any projects referencing this contact
    await db
      .from("projects")
      .update({ contact_id: null })
      .eq("contact_id", id)

    const { error } = await db
      .from("client_contacts")
      .delete()
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[contacts DELETE]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
