import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import {
  sendProposalReminderToClient,
  sendProposalReminderToAdmin,
} from "@/lib/email"

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const day14Ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const day28Ago = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString()

  const results: string[] = []

  // ── 14-day reminders ──────────────────────────────────────────────────────

  const { data: proposals14 } = await (supabaseAdmin
    .from("proposals") as any)
    .select("*, clients(name, contact_name, contact_email)")
    .eq("status", "sent")
    .is("reminder_14_sent_at", null)
    .lte("created_at", day14Ago)

  for (const proposal of (proposals14 as any[]) ?? []) {
    const client = proposal.clients as any
    if (!client?.contact_email) continue

    try {
      const payload = {
        proposalId:   proposal.id,
        proposalTitle: proposal.title,
        clientName:   client.name,
        contactName:  client.contact_name,
        contactEmail: client.contact_email,
        dayMark:      14 as const,
        expiresAt:    proposal.expires_at,
      }

      await sendProposalReminderToClient(payload)
      await sendProposalReminderToAdmin(payload)

      await (supabaseAdmin
        .from("proposals") as any)
        .update({ reminder_14_sent_at: now.toISOString() })
        .eq("id", proposal.id)

      results.push(`14d reminder sent: ${client.name} — ${proposal.title}`)
    } catch (err) {
      console.error(`[cron] 14d reminder failed for ${proposal.id}:`, err)
      results.push(`14d reminder FAILED: ${proposal.id}`)
    }
  }

  // ── 28-day reminders ──────────────────────────────────────────────────────

  const { data: proposals28 } = await (supabaseAdmin
    .from("proposals") as any)
    .select("*, clients(name, contact_name, contact_email)")
    .eq("status", "sent")
    .is("reminder_28_sent_at", null)
    .not("reminder_14_sent_at", "is", null)   // only if 14-day already went out
    .lte("created_at", day28Ago)

  for (const proposal of (proposals28 as any[]) ?? []) {
    const client = proposal.clients as any
    if (!client?.contact_email) continue

    try {
      const payload = {
        proposalId:   proposal.id,
        proposalTitle: proposal.title,
        clientName:   client.name,
        contactName:  client.contact_name,
        contactEmail: client.contact_email,
        dayMark:      28 as const,
        expiresAt:    proposal.expires_at,
      }

      await sendProposalReminderToClient(payload)
      await sendProposalReminderToAdmin(payload)

      await (supabaseAdmin
        .from("proposals") as any)
        .update({ reminder_28_sent_at: now.toISOString() })
        .eq("id", proposal.id)

      results.push(`28d reminder sent: ${client.name} — ${proposal.title}`)
    } catch (err) {
      console.error(`[cron] 28d reminder failed for ${proposal.id}:`, err)
      results.push(`28d reminder FAILED: ${proposal.id}`)
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
    timestamp: now.toISOString(),
  })
}
