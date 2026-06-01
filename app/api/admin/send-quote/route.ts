import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendQuoteEmail } from "@/lib/email"
import { requireAdmin } from "@/lib/admin-auth"

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { quoteId } = await req.json()
    if (!quoteId) return NextResponse.json({ error: "Missing quoteId" }, { status: 400 })

    const { data: quote } = await (supabaseAdmin.from("quotes") as any)
      .select("*, clients(name, contact_name, contact_email)")
      .eq("id", quoteId).single()

    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 })

    const client = quote.clients as any
    if (!client?.contact_email) {
      return NextResponse.json({ error: "Client has no contact email" }, { status: 400 })
    }

    const { data: items } = await (supabaseAdmin.from("quote_items") as any)
      .select("price").eq("quote_id", quoteId)

    const totalCents = (items ?? []).reduce((sum: number, i: any) => sum + (i.price ?? 0), 0)

    await sendQuoteEmail({
      quoteId,
      quoteTitle: quote.title,
      clientName: client.name,
      contactName: client.contact_name ?? client.name,
      contactEmail: client.contact_email,
      totalCents,
      expiresAt: quote.expires_at,
    })

    await (supabaseAdmin.from("quotes") as any)
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", quoteId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[api/admin/send-quote]", err)
    return NextResponse.json({ error: err?.message ?? "Failed to send email" }, { status: 500 })
  }
}
