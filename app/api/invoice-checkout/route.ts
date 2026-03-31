import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { supabaseAdmin } from "@/lib/supabase-server"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" })

export async function POST(req: NextRequest) {
  const { invoiceId } = await req.json()
  if (!invoiceId) return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 })

  const { data: invoice } = await (supabaseAdmin.from("invoices") as any)
    .select("*, clients(name, contact_email)")
    .eq("id", invoiceId)
    .single()

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  if (invoice.status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 })

  const methods: string[] = invoice.payment_methods ?? ["stripe"]
  if (!methods.includes("stripe")) return NextResponse.json({ error: "Card payments not enabled for this invoice" }, { status: 400 })

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: invoice.clients?.contact_email ?? undefined,
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: invoice.amount,
        product_data: {
          name: invoice.description,
          description: `Studio Cinq — ${invoice.clients?.name ?? ""}`,
        },
      },
      quantity: 1,
    }],
    metadata: {
      invoice_id: invoice.id,
      client_id: invoice.client_id,
      project_id: invoice.project_id,
      type: "invoice",
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${invoiceId}?paid=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${invoiceId}`,
  })

  return NextResponse.json({ url: session.url })
}
