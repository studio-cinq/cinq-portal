import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Daily sweep that flips any sent invoice whose due_date has passed to
 * status = 'overdue'. Keeps the Overdue card total and the row aging
 * label in agreement — without this, the card filtered on status while
 * the row computed freshly from due_date, and they disagreed for any
 * invoice the cron hadn't touched.
 *
 * Invoices with no due_date stay 'sent' indefinitely — the brief calls
 * for those to read as neutral "waiting," not red overdue.
 *
 * Schedule this in vercel.json crons: { "path": "/api/cron/invoice-overdue",
 * "schedule": "0 7 * * *" } so it runs at 7am UTC daily.
 */
export async function GET(req: Request) {
  // Vercel Cron sets this header; reject anything else so the endpoint
  // isn't trivially callable from outside.
  const auth = req.headers.get("authorization")
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await (supabaseAdmin.from("invoices") as any)
    .update({ status: "overdue" })
    .eq("status", "sent")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .select("id, invoice_number")

  if (error) {
    console.error("[cron/invoice-overdue]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    flipped: data?.length ?? 0,
    invoices: (data ?? []).map((d: any) => d.invoice_number),
  })
}
