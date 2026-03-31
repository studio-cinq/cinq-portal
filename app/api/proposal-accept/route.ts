import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  try {
    const { proposalId, selectedTotal, deposit, depositPct, note } = await req.json()

    if (!proposalId) {
      return NextResponse.json({ error: "Missing proposalId" }, { status: 400 })
    }

    // Fetch proposal + client
    const { data: proposal } = await (supabaseAdmin.from("proposals") as any)
      .select("*, clients(id, name, contact_name, contact_email)")
      .eq("id", proposalId)
      .single()

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    if (proposal.status === "accepted") {
      return NextResponse.json({ error: "Already accepted" }, { status: 400 })
    }

    // Generate next invoice number (SC-XXX)
    const { data: latestInvoice } = await (supabaseAdmin.from("invoices") as any)
      .select("invoice_number")
      .ilike("invoice_number", "SC-%")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    let nextNum = 1
    if (latestInvoice?.invoice_number) {
      const match = latestInvoice.invoice_number.match(/SC-(\d+)/)
      if (match) nextNum = parseInt(match[1]) + 1
    }
    const invoiceNumber = `SC-${String(nextNum).padStart(3, "0")}`

    // Build line items for the invoice
    const pct = depositPct ?? 50
    const lineItemDesc = pct === 100
      ? proposal.title
      : `${proposal.title} — ${pct}% deposit`

    // Create the invoice
    const { data: invoice, error: invoiceError } = await (supabaseAdmin.from("invoices") as any)
      .insert({
        client_id:       proposal.client_id,
        project_id:      null,
        invoice_number:  invoiceNumber,
        description:     lineItemDesc,
        amount:          deposit, // already in cents
        line_items:      [{ description: lineItemDesc, amount: deposit }],
        notes:           null,
        due_date:        new Date().toISOString().split("T")[0], // due today
        status:          "sent",
        unlocks_files:   false,
        payment_methods: ["stripe", "ach"],
        cc_emails:       [],
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      console.error("[proposal-accept] invoice creation failed:", invoiceError)
      return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 })
    }

    // Mark proposal as accepted and link the invoice
    await (supabaseAdmin.from("proposals") as any)
      .update({
        status:      "accepted",
        client_note: note || null,
      })
      .eq("id", proposalId)

    return NextResponse.json({
      invoiceId: invoice.id,
      invoiceUrl: `/invoice/${invoice.id}`,
    })
  } catch (err) {
    console.error("[proposal-accept]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
