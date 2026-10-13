import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { getStripe } from "@/lib/stripe"

/**
 * One Stripe Checkout session covering every open invoice for a client —
 * the "pay the full statement" button. One line item per invoice so the
 * Stripe receipt itemises them; metadata carries the invoice ids so the
 * webhook can mark them all paid together.
 */
export async function POST(req: NextRequest) {
  let clientId: string
  try {
    clientId = (await req.json()).clientId
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 })

  const [{ data: client }, { data: invoices }] = await Promise.all([
    (supabaseAdmin.from("clients") as any).select("name, contact_email").eq("id", clientId).single(),
    (supabaseAdmin.from("invoices") as any)
      .select("id, invoice_number, description, amount, payment_methods")
      .eq("client_id", clientId)
      .in("status", ["sent", "overdue", "upcoming"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("invoice_number", { ascending: true }),
  ])
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const list = (invoices ?? []) as any[]
  if (list.length === 0) return NextResponse.json({ error: "Nothing outstanding on this account." }, { status: 400 })

  const noCard = list.filter(i => !((i.payment_methods ?? ["stripe"]) as string[]).includes("stripe"))
  if (noCard.length > 0) {
    return NextResponse.json({
      error: `Card payment isn't enabled on ${noCard.map(i => `#${i.invoice_number}`).join(", ")}. Please pay those from their own invoice pages.`,
    }, { status: 400 })
  }

  // Stripe metadata values cap at 500 chars; 13 UUIDs fit, more would not.
  const invoiceIds = list.map(i => i.id).join(",")
  if (invoiceIds.length > 500) {
    return NextResponse.json({ error: "Too many invoices for a single checkout — please pay in two batches." }, { status: 400 })
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: client.contact_email ?? undefined,
      line_items: list.map(i => ({
        price_data: {
          currency: "usd",
          unit_amount: i.amount,
          product_data: {
            name: `Invoice #${i.invoice_number}`,
            description: i.description ? `${i.description} — Studio Cinq` : `Studio Cinq — ${client.name}`,
          },
        },
        quantity: 1,
      })),
      metadata: { type: "statement", client_id: clientId, invoice_ids: invoiceIds },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/statement/${clientId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/statement/${clientId}`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("[statement-checkout]", err)
    return NextResponse.json({ error: "Card checkout is temporarily unavailable." }, { status: 500 })
  }
}
