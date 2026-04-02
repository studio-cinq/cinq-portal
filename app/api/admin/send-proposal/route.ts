import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendProposalEmail } from "@/lib/email"
import { requireAdmin } from "@/lib/admin-auth"

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { proposalId } = await req.json()

    if (!proposalId) {
      return NextResponse.json({ error: "Missing proposalId" }, { status: 400 })
    }

    // Fetch proposal with client + items
    const { data: proposal } = await (supabaseAdmin.from("proposals") as any)
      .select("*, clients(name, contact_name, contact_email)")
      .eq("id", proposalId)
      .single()

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    const client = proposal.clients as any
    if (!client?.contact_email) {
      return NextResponse.json({ error: "Client has no contact email" }, { status: 400 })
    }

    // Calculate estimate from non-optional items
    const { data: items } = await (supabaseAdmin.from("proposal_items") as any)
      .select("price, is_optional")
      .eq("proposal_id", proposalId)

    const estimateCents = (items ?? [])
      .filter((i: any) => !i.is_optional)
      .reduce((sum: number, i: any) => sum + (i.price ?? 0), 0)

    await sendProposalEmail({
      proposalId,
      proposalTitle: proposal.title,
      subtitle: proposal.subtitle,
      clientName: client.name,
      contactName: client.contact_name ?? client.name,
      contactEmail: client.contact_email,
      estimateCents,
      expiresAt: proposal.expires_at,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[api/admin/send-proposal]", err)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
