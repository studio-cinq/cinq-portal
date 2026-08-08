import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendInvoiceEmail } from "@/lib/email"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import { requireAdmin } from "@/lib/admin-auth"

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { invoiceNumber, clientId } = await req.json()
    if (!invoiceNumber || !clientId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("*, clients(name, contact_name, contact_email, attach_pdf_to_emails)")
      .eq("invoice_number", invoiceNumber)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single() as { data: any }

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

    const client = invoice.clients
    if (!client) return NextResponse.json({ error: "No client" }, { status: 404 })

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com"

    // Attach the invoice PDF for PDF-flagged clients (see send-invoice/route.ts
    // for the rationale). Failure is logged and the send continues link-only.
    let attachments: Array<{ filename: string; content: Buffer }> | undefined
    if (client.attach_pdf_to_emails) {
      try {
        const pdf = await generateInvoicePdf(invoice.id)
        if (pdf) attachments = [{ filename: pdf.filename, content: pdf.buffer }]
      } catch (err) {
        console.error("[send-invoice-by-number] PDF generation failed, sending link-only", err)
      }
    }

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
      ccEmails: invoice.cc_emails ?? [],
      notes:    invoice.notes ?? undefined,
      attachments,
    })

    await (supabaseAdmin.from("invoices") as any)
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", invoice.id)

    return NextResponse.json({ ok: true, pdfAttached: Boolean(attachments) })
  } catch (err) {
    console.error("[send-invoice-by-number]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
