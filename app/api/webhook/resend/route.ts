import { NextResponse } from "next/server"
import crypto from "crypto"
import { trySendEmail } from "@/lib/resend"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "kacie@studiocinq.com"

/**
 * Resend webhook receiver.
 *
 * Fires a low-key "email opened" notification when a client opens one of
 * our outbound emails that carries a "reminder" or "invoice" tag. Other
 * event types (delivered, bounced, complained) are logged but silent —
 * we don't need to pester Kacie for those.
 *
 * Signature: Resend signs webhook payloads via Svix. The header set is:
 *   svix-id, svix-timestamp, svix-signature
 * We verify HMAC-SHA256 over `${id}.${timestamp}.${body}` against a
 * base64-encoded secret set in the RESEND_WEBHOOK_SECRET env var.
 * The endpoint refuses to process unsigned requests (a signing secret
 * MUST be configured) to prevent inbox spam via forged events.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error("[webhook/resend] RESEND_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  const body = await req.text()
  const svixId        = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 })
  }

  if (!verifySignature({ id: svixId, timestamp: svixTimestamp, signatureHeader: svixSignature, body, secret })) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 401 })
  }

  let event: any
  try { event = JSON.parse(body) } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const type = event?.type as string | undefined
  const data = event?.data ?? {}

  // Only notify on opens for now — deliveries and bounces are noise.
  if (type !== "email.opened") {
    return NextResponse.json({ ok: true, ignored: type })
  }

  // Filter: skip anything that's a self-notification (admin emails to Kacie's
  // own address). Everything else is a client-facing send worth notifying on,
  // regardless of whether the template's been explicitly tagged.
  const toValue = Array.isArray(data.to) ? data.to : (data.to ? [data.to] : [])
  const to = toValue.join(", ") || "—"
  const isSelf = toValue.some((addr: string) => (addr ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase())
  if (isSelf) {
    return NextResponse.json({ ok: true, ignored: "self-notification" })
  }

  const subject = data.subject ?? "(no subject)"
  const openedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  })

  // Best-effort heading from the tag when it's there, subject when it's not.
  const tags: Array<{ name: string; value: string }> = Array.isArray(data.tags) ? data.tags : []
  const category = tags.find(t => t.name === "category")?.value
  const heading = category === "invoice-sent"
    ? "A client opened the invoice email you sent"
    : category === "invoice-reminder" || category === "client-invoice-reminder"
    ? "A client opened your reminder email"
    : "A client opened one of your emails"

  await trySendEmail({
    from: "Studio Cinq Portal <portal@studiocinq.com>",
    to: ADMIN_EMAIL,
    subject: `Email opened — ${to}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
        <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
        <h2 style="font-weight:normal;font-size:20px;margin:8px 0 20px">${heading}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5;width:110px">Recipient</td><td style="padding:8px 0;border-bottom:1px solid #eee">${to}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5">Subject</td><td style="padding:8px 0;border-bottom:1px solid #eee">${subject}</td></tr>
          <tr><td style="padding:8px 0;opacity:0.5">Opened</td><td style="padding:8px 0">${openedAt}</td></tr>
        </table>
        <p style="font-size:12px;opacity:0.45;margin-top:24px;line-height:1.6">
          "Opened" means their mail client loaded the tracking pixel — usually a real read, but auto-preview panels can trigger it too. Click-through events (View &amp; pay links) still notify separately.
        </p>
      </div>
    `,
    text: `${heading}\n\nRecipient: ${to}\nSubject: ${subject}\nOpened: ${openedAt}`,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}

function verifySignature(args: {
  id: string; timestamp: string; signatureHeader: string; body: string; secret: string
}): boolean {
  // Secrets from Svix are typically prefixed `whsec_`; strip that then base64-decode.
  const rawSecret = args.secret.startsWith("whsec_") ? args.secret.slice(6) : args.secret
  let keyBytes: Buffer
  try { keyBytes = Buffer.from(rawSecret, "base64") } catch { return false }

  const signed = `${args.id}.${args.timestamp}.${args.body}`
  const expected = crypto.createHmac("sha256", keyBytes).update(signed).digest("base64")

  // Header is a space-separated list of `v1,<sig>` pairs; any match wins.
  const candidates = args.signatureHeader.split(" ")
  for (const c of candidates) {
    const [, sig] = c.split(",")
    if (!sig) continue
    if (safeEqual(sig, expected)) return true
  }
  return false
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}
