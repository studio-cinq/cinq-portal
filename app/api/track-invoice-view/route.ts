import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { trySendEmail } from "@/lib/resend"

export async function POST(req: Request) {
  try {
    const { invoiceIds, clientEmail } = await req.json()
    if (!invoiceIds?.length) return NextResponse.json({ ok: true })

    // Find invoices not yet viewed
    const { data: invoices } = await (supabaseAdmin.from("invoices") as any)
      .select("id, invoice_number, description, amount, viewed_at, clients(name, contact_name)")
      .in("id", invoiceIds)
      .is("viewed_at", null)

    if (!invoices || invoices.length === 0) return NextResponse.json({ ok: true })

    const now = new Date().toISOString()

    // Mark all as viewed
    await (supabaseAdmin.from("invoices") as any)
      .update({ viewed_at: now })
      .in("id", invoices.map((i: any) => i.id))

    // Notify admin
    const client = invoices[0]?.clients
    const invoiceList = invoices.map((inv: any) =>
      `#${inv.invoice_number} — $${(inv.amount / 100).toLocaleString()}`
    ).join(", ")

    await trySendEmail({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? "kacie@studiocinq.com",
      subject: `Invoice viewed — ${client?.name ?? "Client"}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 24px">${client?.contact_name ?? "A client"} opened their invoices</h2>
          <p style="font-size:14px;line-height:1.7;color:#2C2820">First-time views: ${invoiceList}</p>
        </div>
      `,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[track-invoice-view]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
