import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendInvoiceEmail } from "@/lib/email"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import { requireAdmin } from "@/lib/admin-auth"

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { invoiceId } = await req.json()
    if (!invoiceId) return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 })

    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("*, clients(name, contact_name, contact_email, attach_pdf_to_emails)")
      .eq("id", invoiceId)
      .single() as { data: any }

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

    const client = invoice.clients
    if (!client) return NextResponse.json({ error: "No client" }, { status: 404 })

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com"

    // If the client is flagged for PDF-attach billing (their AP system ingests
    // PDFs rather than following links), render the invoice PDF and attach it.
    // A PDF failure is logged but doesn't block the send — the email itself
    // still gets through with the pay link.
    let attachments: Array<{ filename: string; content: Buffer }> | undefined
    if (client.attach_pdf_to_emails) {
      try {
        const pdf = await generateInvoicePdf(invoiceId)
        if (pdf) attachments = [{ filename: pdf.filename, content: pdf.buffer }]
      } catch (err) {
        console.error("[send-invoice] PDF generation failed, sending link-only", err)
      }
    }

    await sendInvoiceEmail({
      invoiceNumber: invoice.invoice_number,
      description:   invoice.description,
      amountCents:   invoice.amount,
      dueDate:       invoice.due_date,
      clientName:    client.name,
      contactName:   client.contact_name,
      contactEmail:  client.contact_email,
      invoiceUrl:    `${portalUrl}/invoice/${invoice.id}`,
      paymentMethods: invoice.payment_methods ?? ["stripe"],
      ccEmails:      invoice.cc_emails ?? [],
      notes:         invoice.notes ?? undefined,
      attachments,
    })

    await (supabaseAdmin.from("invoices") as any)
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", invoiceId)

    return NextResponse.json({ ok: true, pdfAttached: Boolean(attachments) })
  } catch (err) {
    console.error("[send-invoice]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
