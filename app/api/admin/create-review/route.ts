import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendReviewInviteEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const { projectId, clientId, siteUrl, notes } = await req.json()

    if (!projectId || !clientId || !siteUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create the review session
    const { data: session, error } = await (supabaseAdmin.from("review_sessions") as any)
      .insert({ project_id: projectId, client_id: clientId, site_url: siteUrl, notes })
      .select()
      .single()

    if (error || !session) {
      return NextResponse.json({ error: "Failed to create review session" }, { status: 500 })
    }

    // Fetch client + project for email
    const { data: client } = await (supabaseAdmin.from("clients") as any)
      .select("name, contact_name, contact_email")
      .eq("id", clientId)
      .single()

    const { data: project } = await (supabaseAdmin.from("projects") as any)
      .select("title")
      .eq("id", projectId)
      .single()

    if (client && project) {
      await sendReviewInviteEmail({
        sessionId: session.id,
        projectTitle: project.title,
        clientName: client.name,
        contactName: client.contact_name,
        contactEmail: client.contact_email,
        siteUrl,
        round: 1,
        notes,
      }).catch(console.error)
    }

    return NextResponse.json({ id: session.id, ok: true })
  } catch (err) {
    console.error("[create-review]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
