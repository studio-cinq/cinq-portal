import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createServerComponentClient } from "@/lib/supabase-server"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" })

export async function POST(req: NextRequest) {
  const { proposalId, amount, clientName, title, depositPct } = await req.json()
  const pct = depositPct ?? 50

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: amount,
        product_data: {
          name: pct === 100 ? title : `${title} — ${pct}% deposit`,
          description: `Studio Cinq — ${clientName}`,
        },
      },
      quantity: 1,
    }],
    metadata: {
      proposal_id: proposalId,
      type: "proposal_deposit",
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/proposals/${proposalId}?accepted=true`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/proposals/${proposalId}`,
  })

  return NextResponse.json({ url: session.url })
}
