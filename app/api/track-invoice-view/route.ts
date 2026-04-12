import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { trySendEmail } from "@/lib/resend"

export async function POST(req: Request) {
  try {
    const { invoiceIds, isReturnView } = await req.json()
    if (!invoiceIds?.length) return NextResponse.json({ ok: true })

    const { data: invoices } = await (supabaseAdmin.from("invoices") as any)
      .select("id, invoice_number, description, amount, viewed_at, clients(name, contact_name)")
      .in("id", invoiceIds)

    if (!invoices || invoices.length === 0) return NextResponse.json({ ok: true })

    const now = new Date().toISOString()

    // Mark first view + update last_viewed_at every time
    for (const inv of invoices) {
      await (supabaseAdmin.from("invoices") as any)
        .update({ ...(!inv.viewed_at ? { viewed_at: now } : {}), last_viewed_at: now })
        .eq("id", inv.id)
    }

    // Notify admin every time
    const client = invoices[0]?.clients
    const invoiceList = invoices.map((inv: any) =>
      `#${inv.invoice_number} — $${(inv.amount / 100).toLocaleString()}`
    ).join(", ")

    const viewedAt = new Date().toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      weekday: "long", month: "long", day: "numeric",
      year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
    })

    const heading = isReturnView
      ? `${client?.contact_name ?? "A client"} is looking at their invoice again`
      : `${client?.contact_name ?? "A client"} opened an invoice`
    const subject = isReturnView
      ? `Invoice revisited — ${client?.name ?? "Client"}`
      : `Invoice opened — ${client?.name ?? "Client"}`

    await trySendEmail({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? "kacie@studiocinq.com",
      subject,
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 24px">${heading}</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px">
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5;width:120px">Invoice</td><td style="padding:8px 0;border-bottom:1px solid #eee">${invoiceList}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5">Client</td><td style="padding:8px 0;border-bottom:1px solid #eee">${client?.name ?? "—"}</td></tr>
            <tr><td style="padding:8px 0;opacity:0.5">Viewed</td><td style="padding:8px 0">${viewedAt}</td></tr>
          </table>
        </div>
      `,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[track-invoice-view]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
