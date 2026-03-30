import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { sessionId, screenshotUrl, notes } = await req.json()
    if (!sessionId || !screenshotUrl) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const { data: session } = await (supabaseAdmin.from("review_sessions") as any)
      .select("*, clients(name, contact_name, contact_email), projects(title)")
      .eq("id", sessionId).single()

    const nextRound = (session?.current_round ?? 1) + 1

    await (supabaseAdmin.from("review_sessions") as any)
      .update({
        screenshot_url: screenshotUrl,
        current_round: nextRound,
        status: "in_review",
        notes: notes?.trim() || session?.notes || null,
        submitted_at: null,
        viewed_at: null,
      })
      .eq("id", sessionId)

    const client = session?.clients as any
    const project = session?.projects as any
    const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/review/${sessionId}`

    if (client?.contact_email) {
      await resend.emails.send({
        from: "Studio Cinq <portal@studiocinq.com>",
        to: client.contact_email,
        subject: `Round ${nextRound} ready for review — ${project?.title ?? "Website"}`,
        html: `
          <div style="font-family:Georgia,serif;max-width:500px;margin:40px auto;color:#1C1916">
            <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
            <h2 style="font-weight:normal;font-size:20px;margin:8px 0 24px">Round ${nextRound} is ready for your review</h2>
            <p style="font-size:14px;line-height:1.7;color:#2C2820">We've made updates based on your feedback. Please review and let us know your thoughts.</p>
            <a href="${reviewUrl}" style="display:inline-block;margin-top:16px;background:#1C1916;color:#F6F4EF;padding:10px 22px;font-family:monospace;font-size:12px;text-decoration:none;letter-spacing:0.06em">Review site →</a>
          </div>
        `,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, round: nextRound })
  } catch (err) {
    console.error("[next-round]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
