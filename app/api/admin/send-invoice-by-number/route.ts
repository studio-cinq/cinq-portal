import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendInvoiceEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const { invoiceNumber, clientId } = await req.json()
    if (!invoiceNumber || !clientId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("*, clients(name, contact_name, contact_email)")
      .eq("invoice_number", invoiceNumber)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single() as { data: any }

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

    const client = invoice.clients
    if (!client) return NextResponse.json({ error: "No client" }, { status: 404 })

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com"

    await sendInvoiceEmail({
      invoiceNumber:  invoice.invoice_number,
      description:    invoice.description,
      amountCents:    invoice.amount,
      dueDate:        invoice.due_date,
      clientName:     client.name,
      contactName:    client.contact_name,
      contactEmail:   client.contact_email,
      invoiceUrl:     `${portalUrl}/invoice/${invoice.id}`,
      paymentMethods: invoice.payment_methods ?? ["stripe"],
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[send-invoice-by-number]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}