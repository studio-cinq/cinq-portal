import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { requireAdmin } from "@/lib/admin-auth"

/**
 * Clones an invoice into a fresh draft so repeat billing is one click.
 *
 * Copies: client, project, description, amount, line_items, payment_methods,
 * notes, payment_alert, cc_emails, unlocks_files.
 *
 * Clears: status (→ draft), invoice_number (Kacie picks a new one),
 * due_date, last_sent_at, viewed_at, paid_at, last_reminder_sent_at,
 * reminders_sent_count.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const { data: source } = await (supabaseAdmin.from("invoices") as any)
      .select("*").eq("id", id).single()
    if (!source) return NextResponse.json({ error: "Source invoice not found" }, { status: 404 })

    // invoice_number is NOT NULL — generate a placeholder by incrementing
    // the source number's trailing digits (NEU-2602 → NEU-2603). Kacie
    // lands on the edit page and can override before sending.
    const sourceNumber = source.invoice_number ?? "DRAFT-1"
    const match = sourceNumber.match(/^(.*?)(\d+)$/)
    const nextNumber = match
      ? match[1] + String(parseInt(match[2], 10) + 1).padStart(match[2].length, "0")
      : `${sourceNumber}-2`

    const payload = {
      client_id: source.client_id,
      project_id: source.project_id ?? null,
      invoice_number: nextNumber,
      description: source.description,
      amount: source.amount,
      line_items: source.line_items ?? [],
      payment_methods: source.payment_methods ?? ["stripe"],
      notes: source.notes ?? null,
      payment_alert: source.payment_alert ?? null,
      cc_emails: source.cc_emails ?? [],
      unlocks_files: source.unlocks_files ?? false,
      status: "draft",
      // Intentionally NOT carrying over: due_date, dates, reminder counters
      // — those are per-cycle.
    }

    const { data: created, error } = await (supabaseAdmin.from("invoices") as any)
      .insert(payload).select("id").single()

    if (error || !created) {
      console.error("[duplicate/invoice]", error)
      return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: created.id })
  } catch (err) {
    console.error("[duplicate/invoice]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
