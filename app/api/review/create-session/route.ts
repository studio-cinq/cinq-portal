import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const { clientId, projectId, siteUrl, screenshotUrl, notes } = await req.json()
    if (!clientId || !siteUrl || !screenshotUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data, error } = await (supabaseAdmin.from("review_sessions") as any)
      .insert({
        client_id: clientId,
        project_id: projectId || null,
        site_url: siteUrl,
        screenshot_url: screenshotUrl,
        notes: notes?.trim() || null,
        status: "in_review",
        current_round: 1,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ session: data })
  } catch (err) {
    console.error("[create-session]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
