import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendInvoiceEmail } from "@/lib/email"
import { generateInvoicePdf } from "@/lib/pdf/invoice"
import { generateStatementPdf } from "@/lib/pdf/statement"
import { requireAdmin } from "@/lib/admin-auth"

const UNPAID_STATUSES = ["sent", "overdue", "upcoming"] as const

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

    // Count OTHER open invoices for this client (excluding the one we're
    // sending). If ≥1, we auto-attach the Statement of Account PDF as a
    // gentle nudge — the email body references it.
    const { count: otherOpenCount } = await (supabaseAdmin.from("invoices") as any)
      .select("id", { count: "exact", head: true })
      .eq("client_id", invoice.client_id)
      .in("status", UNPAID_STATUSES)
      .neq("id", invoiceId)
    const otherOpen = otherOpenCount ?? 0

    const attachments: Array<{ filename: string; content: Buffer }> = []

    // Client flagged for PDF-attach billing (AP system ingests PDFs rather
    // than following links) — attach the invoice PDF itself. Failure is
    // logged and the send continues link-only.
    if (client.attach_pdf_to_emails) {
      try {
        const pdf = await generateInvoicePdf(invoiceId)
        if (pdf) attachments.push({ filename: pdf.filename, content: pdf.buffer })
      } catch (err) {
        console.error("[send-invoice] Invoice PDF generation failed, skipping that attachment", err)
      }
    }

    // Any-client statement nudge: when there are other open invoices, attach
    // the Statement of Account PDF and let the email body mention it. Failure
    // is logged and the send continues without the statement.
    if (otherOpen > 0) {
      try {
        const pdf = await generateStatementPdf(invoice.client_id)
        if (pdf) attachments.push({ filename: pdf.filename, content: pdf.buffer })
      } catch (err) {
        console.error("[send-invoice] Statement PDF generation failed, sending without", err)
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
      attachments: attachments.length > 0 ? attachments : undefined,
      otherOpenInvoicesCount: otherOpen,
    })

    await (supabaseAdmin.from("invoices") as any)
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", invoiceId)

    return NextResponse.json({
      ok: true,
      attachments: attachments.map(a => a.filename),
      otherOpenInvoicesCount: otherOpen,
    })
  } catch (err) {
    console.error("[send-invoice]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
