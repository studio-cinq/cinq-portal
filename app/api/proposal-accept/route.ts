import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendProposalAcceptedEmail, sendProposalConfirmationToClient } from "@/lib/email"

interface Selection {
  id: string
  accepted: boolean
  phase: "now" | "later"
}

export async function POST(req: NextRequest) {
  try {
    const { proposalId, selectedTotal, deposit, depositPct, note, selections } = await req.json()

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

    // Fetch all proposal items
    const { data: allItems } = await (supabaseAdmin.from("proposal_items") as any)
      .select("*")
      .eq("proposal_id", proposalId)
      .order("sort_order")

    const itemList = (allItems ?? []) as any[]

    // Save per-item selections
    const selectionMap = new Map<string, Selection>()
    if (Array.isArray(selections)) {
      for (const s of selections as Selection[]) {
        selectionMap.set(s.id, s)
      }
    }

    for (const item of itemList) {
      const sel = selectionMap.get(item.id)
      if (sel) {
        await (supabaseAdmin.from("proposal_items") as any)
          .update({
            accepted: sel.accepted,
            phase: sel.phase,
          })
          .eq("id", item.id)
      }
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

    // Build detailed invoice line items from selected proposal items
    const pct = depositPct ?? 50
    const acceptedItems = itemList.filter((item: any) => {
      const sel = selectionMap.get(item.id)
      return sel ? sel.accepted : (item.is_required || !item.is_optional)
    })

    const invoiceLineItems = acceptedItems.map((item: any) => ({
      description: item.name,
      amount: Math.round((item.price ?? 0) * (pct / 100)),
    }))

    const lineItemDesc = pct === 100
      ? `${proposal.title}`
      : `${proposal.title} — ${pct}% deposit`

    // Create the invoice
    const { data: invoice, error: invoiceError } = await (supabaseAdmin.from("invoices") as any)
      .insert({
        client_id:       proposal.client_id,
        project_id:      null,
        invoice_number:  invoiceNumber,
        description:     lineItemDesc,
        amount:          deposit,
        line_items:      invoiceLineItems,
        notes:           null,
        due_date:        new Date().toISOString().split("T")[0],
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

    // Mark proposal as accepted
    await (supabaseAdmin.from("proposals") as any)
      .update({
        status:      "accepted",
        client_note: note || null,
      })
      .eq("id", proposalId)

    const client = proposal.clients as any

    // Build item breakdowns for emails
    const selectedItems = itemList
      .filter((item: any) => {
        const sel = selectionMap.get(item.id)
        return sel ? sel.accepted : item.is_required
      })
      .map((item: any) => ({
        name: item.name,
        price: item.price ?? 0,
        phase: selectionMap.get(item.id)?.phase ?? item.phase ?? "now",
        isRequired: item.is_required ?? false,
      }))

    const skippedItems = itemList
      .filter((item: any) => {
        const sel = selectionMap.get(item.id)
        return sel ? !sel.accepted : (!item.is_required && item.is_optional)
      })
      .map((item: any) => ({
        name: item.name,
        price: item.price ?? 0,
        isOptional: item.is_optional ?? false,
      }))

    const schedule = Array.isArray(proposal.payment_schedule)
      ? proposal.payment_schedule as number[]
      : [50, 50]

    // Send confirmation email to client
    try {
      await sendProposalConfirmationToClient({
        proposalId,
        proposalTitle: proposal.title,
        clientName: client?.name ?? "",
        contactName: client?.contact_name ?? client?.name ?? "",
        contactEmail: client?.contact_email ?? "",
        selectedItems,
        skippedItems,
        selectedTotalCents: selectedTotal ?? deposit,
        depositCents: deposit,
        depositPct: pct,
        schedule,
      })
    } catch (err) {
      console.error("[proposal-accept] client confirmation email failed:", err)
    }

    // Send detailed notification to admin
    try {
      await sendProposalAcceptedEmail({
        proposalId,
        proposalTitle: proposal.title,
        clientName: client?.name ?? "",
        contactName: client?.contact_name ?? "",
        contactEmail: client?.contact_email ?? "",
        totalCents: selectedTotal ?? deposit,
        acceptedAt: new Date(),
        selectedItems,
        skippedItems,
        depositCents: deposit,
        depositPct: pct,
        clientNote: note || null,
      })
    } catch (err) {
      console.error("[proposal-accept] admin notification email failed:", err)
    }

    return NextResponse.json({
      invoiceId: invoice.id,
      invoiceUrl: `/invoice/${invoice.id}`,
    })
  } catch (err) {
    console.error("[proposal-accept]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
