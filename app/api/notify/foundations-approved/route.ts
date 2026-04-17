import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { trySendEmail } from "@/lib/resend"

// Minimal HTML escape for user-supplied note text — these go straight into
// the email HTML, so we don't want "<" or quotes breaking the template.
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function POST(req: Request) {
  try {
    const { foundationId, note } = await req.json()
    if (!foundationId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const { data: foundation } = await supabaseAdmin
      .from("brand_foundations")
      .select("id, title, client_id, clients(name, contact_name, contact_email)")
      .eq("id", foundationId)
      .single() as { data: any }

    if (!foundation) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const client = foundation.clients
    if (!client) return NextResponse.json({ error: "No client" }, { status: 404 })

    // Pull the client's favorited moodboard images, with the containing
    // section's trait name for context, ordered by when they were favorited.
    const { data: favoritesRaw } = await supabaseAdmin
      .from("foundation_image_favorites")
      .select("image_url, image_index, note, favorited_at, brand_foundation_sections(content)")
      .eq("foundation_id", foundationId)
      .order("favorited_at", { ascending: true }) as { data: any }

    const favorites = (favoritesRaw ?? []).map((f: any) => ({
      url: f.image_url,
      index: f.image_index,
      note: (f.note ?? "").trim() || null,
      trait: f.brand_foundation_sections?.content?.trait_name ?? "",
    }))

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com"
    const approvedAt = new Date().toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      weekday: "long", month: "long", day: "numeric",
      year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
    })

    // Build the favorites block. Thumbnails sit in a 2-column table so it
    // renders reliably across email clients. Notes appear beneath each image
    // in italic serif — matches the portal's treatment of client notes.
    const favoritesBlock = favorites.length === 0 ? "" : `
      <div style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.45;margin-bottom:14px">
        ${favorites.length} favorite${favorites.length === 1 ? "" : "s"}
      </div>
      <table style="width:100%;border-collapse:separate;border-spacing:0 12px;margin-bottom:28px">
        ${favorites.map((f: any) => `
          <tr>
            <td style="width:96px;vertical-align:top;padding-right:14px">
              <img src="${f.url}" alt="" style="width:96px;height:96px;object-fit:cover;display:block;border-radius:3px;background:#eee" />
            </td>
            <td style="vertical-align:top;font-size:12px;line-height:1.55">
              ${f.trait ? `<div style="font-family:monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.45;margin-bottom:4px">${f.trait}</div>` : ""}
              ${f.note
                ? `<div style="font-style:italic;font-family:Georgia,serif;font-size:13px;color:#1C1916">"${escapeHtml(f.note)}"</div>`
                : `<div style="opacity:0.4;font-size:12px">No note</div>`}
            </td>
          </tr>
        `).join("")}
      </table>
    `

    const subjectCount = favorites.length > 0 ? ` (${favorites.length} favorite${favorites.length === 1 ? "" : "s"})` : ""

    await trySendEmail({
      from: "Studio Cinq Portal <portal@studiocinq.com>",
      to: process.env.ADMIN_EMAIL ?? "kacie@studiocinq.com",
      subject: `Brand direction approved — ${client.name}${subjectCount}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:40px auto;color:#1C1916">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.4">Studio Cinq · Portal</p>
          <h2 style="font-weight:normal;font-size:20px;margin:8px 0 24px">${client.contact_name} approved the brand direction</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px">
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5;width:120px">Project</td><td style="padding:8px 0;border-bottom:1px solid #eee">${foundation.title}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5">Client</td><td style="padding:8px 0;border-bottom:1px solid #eee">${client.name}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee;opacity:0.5">Approved</td><td style="padding:8px 0;border-bottom:1px solid #eee">${approvedAt}</td></tr>
            ${note ? `<tr><td style="padding:8px 0;opacity:0.5">Note</td><td style="padding:8px 0;font-style:italic">${escapeHtml(note)}</td></tr>` : ""}
          </table>
          ${favoritesBlock}
          <a href="${portalUrl}/admin/clients/${foundation.client_id ?? ""}" style="display:inline-block;background:#1C1916;color:#F6F4EF;padding:10px 22px;font-family:monospace;font-size:12px;text-decoration:none;letter-spacing:0.06em">View client →</a>
        </div>
      `,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[notify/foundations-approved]", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
