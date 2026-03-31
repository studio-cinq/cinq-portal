import { NextResponse } from "next/server"
import { Resend } from "resend"
import { supabaseAdmin } from "@/lib/supabase-server"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { proposalId, isReturnView } = await req.json()
    if (!proposalId) return NextResponse.json({ error: "Missing proposalId" }, { status: 400 })


        const { data: proposal } = await supabaseAdmin
        .from("proposals")
        .select("id, title, clients(name, contact_name, contact_email)")
        .eq("id", proposalId)
        .single() as { data: {
          id: string
          title: string
          clients: { name: string; contact_name: string; contact_email: string } | null
        } | null }
    if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 })

        const client = proposal.clients

    if (!client) return NextResponse.json({ error: "No client" }, { status: 404 })

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com"
    const proposalUrl = `${portalUrl}/admin/proposals/${proposal.id}`
    const viewedAt = new Date().toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      weekday: "long", month: "long", day: "numeric",
      year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
    })

    const heading = isReturnView
      ? `${client.contact_name} is looking at their proposal again`
      : `${client.contact_name} opened a proposal`
    const subject = isReturnView
      ? `Proposal revisited — ${client.name}`
      : `Proposal opened — ${client.name}`

    await resend.emails.send({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? "kacie@studiocinq.com",
      subject,
      html: `
        <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 24px">${heading}</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px">
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5;width:120px">Proposal</td><td style="padding:8px 0;border-bottom:1px solid #eee">${proposal.title}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5">Client</td><td style="padding:8px 0;border-bottom:1px solid #eee">${client.name}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5">Contact</td><td style="padding:8px 0;border-bottom:1px solid #eee">${client.contact_name} · ${client.contact_email}</td></tr>
            <tr><td style="padding:8px 0;opacity:0.5">Viewed</td><td style="padding:8px 0">${viewedAt}</td></tr>
          </table>
          <a href="${proposalUrl}" style="display:inline-block;background:#1C1916;color:#F6F4EF;padding:10px 22px;font-family:monospace;font-size:12px;text-decoration:none;letter-spacing:0.06em">View proposal →</a>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[notify/proposal-viewed]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}