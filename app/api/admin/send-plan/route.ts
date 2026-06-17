import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendPlanEmail } from "@/lib/email"
import { requireAdmin } from "@/lib/admin-auth"

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { planId } = await req.json()
    if (!planId) return NextResponse.json({ error: "Missing planId" }, { status: 400 })

    const { data: plan } = await (supabaseAdmin.from("plans") as any)
      .select("*, clients(name, contact_name, contact_email)")
      .eq("id", planId).single()

    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

    const client = plan.clients as any
    if (!client?.contact_email) {
      return NextResponse.json({ error: "Client has no contact email." }, { status: 400 })
    }

    await sendPlanEmail({
      planId,
      planTitle: plan.title,
      contactName: client.contact_name ?? client.name,
      contactEmail: client.contact_email,
    })

    await (supabaseAdmin.from("plans") as any)
      .update({ last_sent_at: new Date().toISOString(), status: plan.status === "draft" ? "sent" : plan.status })
      .eq("id", planId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[api/admin/send-plan]", err)
    return NextResponse.json({ error: err?.message ?? "Failed to send" }, { status: 500 })
  }
}
