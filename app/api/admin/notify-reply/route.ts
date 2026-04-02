import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendMessageReplyEmail } from "@/lib/email"
import { requireAdmin } from "@/lib/admin-auth"

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { clientId, projectId, messageBody } = await req.json()
    if (!clientId || !projectId || !messageBody) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const { data: client } = await (supabaseAdmin.from("clients") as any)
      .select("name, contact_name, contact_email")
      .eq("id", clientId)
      .single()

    const { data: project } = await (supabaseAdmin.from("projects") as any)
      .select("title")
      .eq("id", projectId)
      .single()

    if (!client?.contact_email || !project?.title) {
      return NextResponse.json({ error: "Client or project not found" }, { status: 404 })
    }

    await sendMessageReplyEmail({
      contactName: client.contact_name,
      contactEmail: client.contact_email,
      clientName: client.name,
      projectTitle: project.title,
      messagePreview: messageBody,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[notify-reply]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
