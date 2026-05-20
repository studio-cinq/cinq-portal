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

    // Record the send timestamp so we can tell from the DB whether the email
    // was actually attempted (independent of the proposal's status field).
    await (supabaseAdmin.from("proposals") as any)
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", proposalId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[api/admin/send-proposal]", err)
    // Bubble up the underlying error message so the admin UI can show it
    return NextResponse.json(
      { error: err?.message ?? "Failed to send email" },
      { status: 500 }
    )
  }
}
