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

    // Count OTHER open invoices for this client (excluding the one being
    // sent). If ≥1, auto-attach the Statement of Account PDF as a gentle
    // nudge. See send-invoice/route.ts for the rationale.
    const { count: otherOpenCount } = await (supabaseAdmin.from("invoices") as any)
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .in("status", UNPAID_STATUSES)
      .neq("id", invoice.id)
    const otherOpen = otherOpenCount ?? 0

    const attachments: Array<{ filename: string; content: Buffer }> = []

    if (client.attach_pdf_to_emails) {
      try {
        const pdf = await generateInvoicePdf(invoice.id)
        if (pdf) attachments.push({ filename: pdf.filename, content: pdf.buffer })
      } catch (err) {
        console.error("[send-invoice-by-number] Invoice PDF generation failed, skipping that attachment", err)
      }
    }

    if (otherOpen > 0) {
      try {
        const pdf = await generateStatementPdf(clientId)
        if (pdf) attachments.push({ filename: pdf.filename, content: pdf.buffer })
      } catch (err) {
        console.error("[send-invoice-by-number] Statement PDF generation failed, sending without", err)
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
      attachments: attachments.length > 0 ? attachments : undefined,
      otherOpenInvoicesCount: otherOpen,
    })

    await (supabaseAdmin.from("invoices") as any)
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", invoice.id)

    return NextResponse.json({
      ok: true,
      attachments: attachments.map(a => a.filename),
      otherOpenInvoicesCount: otherOpen,
    })
  } catch (err) {
    console.error("[send-invoice-by-number]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
