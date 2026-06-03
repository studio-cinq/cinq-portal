import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendInvoiceReminderEmail } from "@/lib/email"
import { requireAdmin } from "@/lib/admin-auth"

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { invoiceId } = await req.json()
    if (!invoiceId) return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 })

    const { data: invoice } = await (supabaseAdmin.from("invoices") as any)
      .select("id, invoice_number, amount, status, cc_emails, reminders_sent_count, clients(name, contact_name, contact_email)")
      .eq("id", invoiceId).single()

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

    // Block reminders on terminal states — no need to nag for paid/draft invoices
    if (invoice.status === "paid") {
      return NextResponse.json({ error: "Invoice is already paid." }, { status: 400 })
    }
    if (invoice.status === "draft") {
      return NextResponse.json({ error: "Can't send a reminder on a draft. Mark the invoice as Sent first." }, { status: 400 })
    }

    const client = invoice.clients as any
    if (!client?.contact_email) {
      return NextResponse.json({ error: "Client has no contact email." }, { status: 400 })
    }

    await sendInvoiceReminderEmail({
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      contactName: client.contact_name ?? client.name,
      contactEmail: client.contact_email,
      amountCents: invoice.amount,
      ccEmails: invoice.cc_emails,
    })

    // Record the send
    await (supabaseAdmin.from("invoices") as any)
      .update({
        last_reminder_sent_at: new Date().toISOString(),
        reminders_sent_count: (invoice.reminders_sent_count ?? 0) + 1,
      })
      .eq("id", invoiceId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[api/admin/send-invoice-reminder]", err)
    return NextResponse.json({ error: err?.message ?? "Failed to send reminder" }, { status: 500 })
  }
}
