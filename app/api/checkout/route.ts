import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createServerComponentClient } from "@/lib/supabase-server"
import type { Database } from "@/types/database"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" })

export async function POST(req: NextRequest) {
  const { invoiceId } = await req.json()

  const supabase = await createServerComponentClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get invoice
  const { data: invoiceRaw } = await supabase
  .from("invoices")
  .select("*, clients(*)")
  .eq("id", invoiceId)
  .single()
const invoice = invoiceRaw as any

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  const methods: string[] = invoice.payment_methods ?? ["stripe"]
  if (!methods.includes("stripe")) return NextResponse.json({ error: "Card payments not enabled for this invoice" }, { status: 400 })

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode:                 "payment",
    customer_email:       user.email,
    line_items: [{
      price_data: {
        currency:     "usd",
        unit_amount:  invoice.amount, // already in cents
        product_data: {
          name:        invoice.description,
          description: `Studio Cinq — ${(invoice.clients as any)?.name ?? ""}`,
        },
      },
      quantity: 1,
    }],
    metadata: {
      invoice_id:  invoice.id,
      client_id:   invoice.client_id,
      project_id:  invoice.project_id,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoices?paid=true`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/invoices`,
  })

  return NextResponse.json({ url: session.url })
}
