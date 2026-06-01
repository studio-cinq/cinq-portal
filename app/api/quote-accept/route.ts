import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendQuoteAcceptedEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const { quoteId, note } = await req.json()
    if (!quoteId) return NextResponse.json({ error: "Missing quoteId" }, { status: 400 })

    const { data: quote } = await (supabaseAdmin.from("quotes") as any)
      .select("*, clients(id, name, contact_name, contact_email, invoice_prefix)")
      .eq("id", quoteId).single()

    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    if (quote.status === "accepted") return NextResponse.json({ error: "Already accepted" }, { status: 400 })

    const client = quote.clients as any

    // Total
    const { data: items } = await (supabaseAdmin.from("quote_items") as any)
      .select("*").eq("quote_id", quoteId).order("sort_order")
    const itemList = (items ?? []) as any[]
    const total = itemList.reduce((s, i) => s + (i.price ?? 0), 0)

    // Payment schedule — same shape as proposals
    const schedule = Array.isArray(quote.payment_schedule) ? (quote.payment_schedule as number[]) : [100]
    const depositPct = schedule[0] ?? 100
    const isCompletionOnly = schedule.length === 2 && schedule[0] === 0
    const invoicePct = isCompletionOnly ? 100 : depositPct
    const invoiceAmount = isCompletionOnly ? total : Math.round(total * (depositPct / 100))

    // Generate invoice number using the client's prefix.
    // Falls back to "Q" if the client doesn't have one set.
    const rawPrefix = (client?.invoice_prefix ?? "Q").toString().trim().toUpperCase()
    const prefix = rawPrefix || "Q"
    const { data: latestInv } = await (supabaseAdmin.from("invoices") as any)
      .select("invoice_number")
      .ilike("invoice_number", `${prefix}-%`)
      .order("created_at", { ascending: false }).limit(1).single()
    let nextNum = 1
    if (latestInv?.invoice_number) {
      const m = latestInv.invoice_number.match(new RegExp(`${prefix}-(\\d+)`))
      if (m) nextNum = parseInt(m[1]) + 1
    }
    const invoiceNumber = `${prefix}-${String(nextNum).padStart(3, "0")}`

    const invoiceLineItems = itemList.map(item => ({
      description: item.name,
      amount: Math.round((item.price ?? 0) * (invoicePct / 100)),
    }))

    const lineItemDesc = isCompletionOnly
      ? `${quote.title} — Final payment (unlocks files)`
      : depositPct === 100
        ? quote.title
        : `${quote.title} — ${depositPct}% deposit`

    // Create the invoice
    const { data: invoice, error: invoiceError } = await (supabaseAdmin.from("invoices") as any)
      .insert({
        client_id:       quote.client_id,
        project_id:      quote.project_id ?? null,
        invoice_number:  invoiceNumber,
        description:     lineItemDesc,
        amount:          invoiceAmount,
        line_items:      invoiceLineItems,
        notes:           null,
        due_date:        isCompletionOnly ? null : new Date().toISOString().split("T")[0],
        status:          isCompletionOnly ? "draft" : "sent",
        unlocks_files:   isCompletionOnly,
        payment_methods: ["stripe", "ach"],
        cc_emails:       [],
      })
      .select().single()

    if (invoiceError || !invoice) {
      console.error("[quote-accept] invoice creation failed:", invoiceError)
      return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 })
    }

    // Mark quote accepted and link the invoice
    await (supabaseAdmin.from("quotes") as any)
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_note: note || null,
        invoice_id: invoice.id,
      })
      .eq("id", quoteId)

    // Notify admin (don't throw if it fails — quote is already accepted)
    try {
      await sendQuoteAcceptedEmail({
        quoteId,
        quoteTitle: quote.title,
        clientName: client?.name ?? "Client",
        totalCents: total,
        note: note || null,
      })
    } catch (err) {
      console.error("[quote-accept] admin notify failed:", err)
    }

    return NextResponse.json({
      ok: true,
      invoiceId: invoice.id,
      invoiceUrl: `/invoice/${invoice.id}`,
    })
  } catch (err: any) {
    console.error("[api/quote-accept]", err)
    return NextResponse.json({ error: err?.message ?? "Failed to accept quote" }, { status: 500 })
  }
}
