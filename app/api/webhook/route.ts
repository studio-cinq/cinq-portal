import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendInvoicePaidEmail } from "@/lib/email"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" })

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get("stripe-signature")!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: "Webhook signature failed" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const type       = session.metadata?.type
    const invoiceId  = session.metadata?.invoice_id
    const proposalId = session.metadata?.proposal_id

    // Invoice payment
    if (type === "invoice" || invoiceId) {
      const paidAt = new Date()

      await (supabaseAdmin as any)
        .from("invoices")
        .update({
          status:                   "paid",
          paid_at:                  paidAt.toISOString(),
          stripe_payment_intent_id: session.payment_intent as string,
        })
        .eq("id", invoiceId)

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

    // Proposal deposit
    if (type === "proposal_deposit" || proposalId) {
      await (supabaseAdmin as any)
        .from("proposals")
        .update({
          status:            "accepted",
          stripe_session_id: session.id,
        })
        .eq("id", proposalId)
    }
  }

  return NextResponse.json({ received: true })
}