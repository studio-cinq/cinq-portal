import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendInvoicePaidEmail, sendStatementPaidEmail } from "@/lib/email"
import { getStripe } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: "Webhook signature failed" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const type       = session.metadata?.type
    const invoiceId  = session.metadata?.invoice_id
    const proposalId = session.metadata?.proposal_id

    // Statement payment — one checkout covering several invoices. Checked
    // first: it carries no invoice_id, so it can't collide with the branches
    // below, but being explicit keeps the ordering obvious.
    if (type === "statement") {
      const paidAt = new Date()
      const ids = (session.metadata?.invoice_ids ?? "").split(",").map(s => s.trim()).filter(Boolean)
      if (ids.length === 0) {
        console.error("[webhook] statement session with no invoice_ids:", session.id)
        return NextResponse.json({ error: "No invoice ids" }, { status: 400 })
      }

      const { error: updateError } = await (supabaseAdmin as any)
        .from("invoices")
        .update({
          status:                   "paid",
          paid_at:                  paidAt.toISOString(),
          stripe_payment_intent_id: session.payment_intent as string ?? null,
        })
        .in("id", ids)

      if (updateError) {
        console.error("[webhook] statement update failed:", updateError)
        return NextResponse.json({ error: "DB update failed" }, { status: 500 })
      }

      try {
        const { data: rows } = await (supabaseAdmin as any)
          .from("invoices")
          .select("invoice_number, amount, clients(name, contact_name)")
          .in("id", ids)
        const list = (rows ?? []) as any[]
        if (list.length > 0) {
          await sendStatementPaidEmail({
            clientId: session.metadata?.client_id ?? "",
            clientName: list[0].clients?.name ?? "Unknown",
            contactName: list[0].clients?.contact_name ?? "",
            invoices: list.map(r => ({ invoiceNumber: r.invoice_number ?? "—", amountCents: r.amount ?? 0 })),
            paidAt,
          })
        }
      } catch (err) {
        console.error("[webhook] statement paid email failed:", err)
      }
    }
    // Invoice payment
    else if (type === "invoice" || (invoiceId && !proposalId)) {
      const paidAt = new Date()

      const { error: updateError } = await (supabaseAdmin as any)
        .from("invoices")
        .update({
          status:                   "paid",
          paid_at:                  paidAt.toISOString(),
          stripe_payment_intent_id: session.payment_intent as string ?? null,
        })
        .eq("id", invoiceId)

      if (updateError) {
        console.error("[webhook] invoice update failed:", updateError)
        return NextResponse.json({ error: "DB update failed" }, { status: 500 })
      }

      // Notify admin
      try {
        const { data: invoice } = await (supabaseAdmin as any)
          .from("invoices")
          .select("*, clients(name, contact_name)")
          .eq("id", invoiceId)
          .single()

        if (invoice) {
          await sendInvoicePaidEmail({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number ?? "—",
            description: invoice.description ?? "",
            amountCents: invoice.amount ?? 0,
            clientName: invoice.clients?.name ?? "Unknown",
            contactName: invoice.clients?.contact_name ?? "",
            paidAt,
          })
        }
      } catch (err) {
        console.error("[webhook] invoice paid email failed:", err)
      }
    }
    // Proposal deposit (else if to prevent double processing)
    else if (type === "proposal_deposit" || proposalId) {
      const { error: updateError } = await (supabaseAdmin as any)
        .from("proposals")
        .update({
          status:            "accepted",
          stripe_session_id: session.id,
        })
        .eq("id", proposalId)

      if (updateError) {
        console.error("[webhook] proposal update failed:", updateError)
        return NextResponse.json({ error: "DB update failed" }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
