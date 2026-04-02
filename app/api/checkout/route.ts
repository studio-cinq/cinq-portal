import { NextRequest, NextResponse } from "next/server"
import { createServerComponentClient } from "@/lib/supabase-server"
import { getStripe } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  let invoiceId: string
  try {
    const body = await req.json()
    invoiceId = body.invoiceId
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 })
  }

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
  let session
  try {
    session = await getStripe().checkout.sessions.create({
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
      type:        "invoice",
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoices`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/invoices`,
    })
  } catch (err) {
    console.error("[checkout]", err)
    return NextResponse.json({ error: "Card checkout is temporarily unavailable." }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
