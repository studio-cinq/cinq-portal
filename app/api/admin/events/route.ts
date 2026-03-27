import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { client_id, project_id, title, event_date, event_time, duration_minutes, type, notes } = body

    if (!client_id || !title || !event_date || !type) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
    }

    const { data, error } = await (supabaseAdmin.from("events") as any)
      .insert({
        client_id,
        project_id: project_id || null,
        title: title.trim(),
        event_date,
        event_time: event_time || null,
        duration_minutes: duration_minutes || null,
        type,
        notes: notes?.trim() || null,
        is_auto: false,
      })
      .select()
      .single()

    if (error) {
      console.error("[api/admin/events POST]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ event: data })
  } catch (err) {
    console.error("[api/admin/events POST]", err)
    return NextResponse.json({ error: "Server error." }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: "Missing event ID." }, { status: 400 })

    const { data, error } = await (supabaseAdmin.from("events") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[api/admin/events PATCH]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ event: data })
  } catch (err) {
    console.error("[api/admin/events PATCH]", err)
    return NextResponse.json({ error: "Server error." }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "Missing event ID." }, { status: 400 })

    const { error } = await (supabaseAdmin.from("events") as any)
      .delete()
      .eq("id", id)
      .eq("is_auto", false)

    if (error) {
      console.error("[api/admin/events DELETE]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[api/admin/events DELETE]", err)
    return NextResponse.json({ error: "Server error." }, { status: 500 })
  }
}
