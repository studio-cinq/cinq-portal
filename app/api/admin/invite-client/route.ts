import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { sendPortalInviteEmail } from "@/lib/email"
import { requireAdmin } from "@/lib/admin-auth"

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { email, clientName, contactName, contactId } = await req.json()
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 })

    // Generate invite link without sending Supabase's default email
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/update-password`,
        data: { client_name: clientName ?? "", contact_id: contactId ?? "" },
      },
    })

    if (error) {
      console.error("[invite-client]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const actionLink = data?.properties?.action_link
    if (!actionLink) {
      return NextResponse.json({ error: "Failed to generate invite link" }, { status: 500 })
    }

    // Send branded invite email via Resend
    await sendPortalInviteEmail({
      contactName: contactName ?? clientName ?? "",
      contactEmail: email,
      inviteLink: actionLink,
    })

    return NextResponse.json({ ok: true, user: data.user })
  } catch (err) {
    console.error("[invite-client]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
