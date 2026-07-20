import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendClientInvoiceReminderEmail } from "@/lib/email"
import { requireAdmin } from "@/lib/admin-auth"

/**
 * Sends ONE reminder email to a client listing every unpaid invoice they
 * have (or a specific subset passed via invoiceIds). Replaces two separate
 * per-invoice reminders arriving in the same minute — the client just gets
 * a single tidy summary.
 *
 * Stamps last_reminder_sent_at + increments reminders_sent_count on each
 * included invoice so the per-row "N reminders sent" counters stay
 * accurate on the admin side.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { clientId, invoiceIds } = await req.json()
    if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 })

    const { data: client } = await (supabaseAdmin.from("clients") as any)
      .select("name, contact_name, contact_email")
      .eq("id", clientId).single()
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })
    if (!client.contact_email) {
      return NextResponse.json({ error: "Client has no contact email." }, { status: 400 })
    }

    // Pull every unpaid invoice for this client (or the caller's subset).
    let query = (supabaseAdmin.from("invoices") as any)
      .select("id, invoice_number, amount, description, due_date, status, cc_emails, reminders_sent_count")
      .eq("client_id", clientId)
      .in("status", ["sent", "overdue", "upcoming"])
    if (Array.isArray(invoiceIds) && invoiceIds.length > 0) {
      query = query.in("id", invoiceIds)
    }
    const { data: invoices } = await query
    const list = (invoices ?? []) as any[]

    if (list.length === 0) {
      return NextResponse.json({ error: "No outstanding invoices for that client." }, { status: 400 })
    }

    // Union of all invoice-level CC emails so no thread participant gets dropped.
    const ccSet = new Set<string>()
    for (const inv of list) {
      for (const e of (inv.cc_emails ?? []) as string[]) if (e) ccSet.add(e)
    }

    await sendClientInvoiceReminderEmail({
      clientName: client.name,
      contactName: client.contact_name ?? client.name,
      contactEmail: client.contact_email,
      ccEmails: Array.from(ccSet),
      invoices: list.map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount: inv.amount,
        description: inv.description ?? null,
        due_date: inv.due_date ?? null,
      })),
    })

    // Stamp each included invoice so the counter stays honest.
    const now = new Date().toISOString()
    await Promise.all(list.map(inv =>
      (supabaseAdmin.from("invoices") as any)
        .update({
          last_reminder_sent_at: now,
          reminders_sent_count: (inv.reminders_sent_count ?? 0) + 1,
        })
        .eq("id", inv.id)
    ))

    return NextResponse.json({ ok: true, count: list.length })
  } catch (err: any) {
    console.error("[api/admin/send-client-invoice-reminder]", err)
    return NextResponse.json({ error: err?.message ?? "Failed to send reminder" }, { status: 500 })
  }
}
