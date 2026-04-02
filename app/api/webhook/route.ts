import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendInvoicePaidEmail } from "@/lib/email"
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

    // Invoice payment
    if (type === "invoice" || (invoiceId && !proposalId)) {
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
