import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { requireAdmin } from "@/lib/admin-auth"

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    // If the quote has an associated invoice (from acceptance), delete it too.
    // Otherwise dangling invoices linger after quote cleanup.
    const { data: quote } = await (supabaseAdmin.from("quotes") as any)
      .select("invoice_id").eq("id", id).single()

    if (quote?.invoice_id) {
      await supabaseAdmin.from("invoices").delete().eq("id", quote.invoice_id)
    }

    // quote_items has ON DELETE CASCADE → removed automatically
    const { error } = await supabaseAdmin.from("quotes").delete().eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[api/admin/delete/quote]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
