import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { trySendEmail } from "@/lib/resend"

/**
 * Fired when a non-admin loads /statement/{clientId}. Stamps viewed_at /
 * last_viewed_at on every open invoice (same columns the single-invoice
 * tracker uses, so the admin rows light up the same way) and sends Kacie
 * ONE "statement opened" email — not one per invoice.
 */
export async function POST(req: Request) {
  try {
    const { clientId, isReturnView } = await req.json()
    if (!clientId) return NextResponse.json({ ok: true })

    const [{ data: client }, { data: invoices }] = await Promise.all([
      (supabaseAdmin.from("clients") as any).select("name, contact_name").eq("id", clientId).single(),
      (supabaseAdmin.from("invoices") as any)
        .select("id, invoice_number, amount, viewed_at")
        .eq("client_id", clientId)
        .in("status", ["sent", "overdue", "upcoming"]),
    ])
    if (!client) return NextResponse.json({ ok: true })

    const list = (invoices ?? []) as any[]
    const now = new Date().toISOString()
    await Promise.all(list.map(inv =>
      (supabaseAdmin.from("invoices") as any)
        .update({ ...(!inv.viewed_at ? { viewed_at: now } : {}), last_viewed_at: now })
        .eq("id", inv.id)
    ))

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "Unknown"
    const total = list.reduce((s, i) => s + (i.amount ?? 0), 0)
    const viewedAt = new Date().toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
    })
    const who = client.contact_name ?? client.name
    const heading = isReturnView ? `${who} is back on their statement` : `${who} opened their statement`
    const subject = `${isReturnView ? "Statement revisited" : "Statement opened"} — ${client.name}`
    const invoiceList = list.map(i => `#${i.invoice_number}`).join(", ") || "—"

    await trySendEmail({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? "kacie@studiocinq.com",
      subject,
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 24px">${heading}</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px">
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5;width:120px">Balance</td><td style="padding:8px 0;border-bottom:1px solid #eee">$${(total / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} · ${list.length} invoice${list.length === 1 ? "" : "s"}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5">Invoices</td><td style="padding:8px 0;border-bottom:1px solid #eee">${invoiceList}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5">Viewed</td><td style="padding:8px 0;border-bottom:1px solid #eee">${viewedAt}</td></tr>
            <tr><td style="padding:8px 0;opacity:0.5">IP</td><td style="padding:8px 0;opacity:0.4;font-family:monospace;font-size:12px">${ip}</td></tr>
          </table>
          <p style="font-size:12px;opacity:0.45;line-height:1.6">You'll get a separate "started card checkout" note if they click Pay, and a "Statement paid" note when it clears.</p>
        </div>
      `,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[track-statement-view]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
