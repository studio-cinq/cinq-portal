import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

const db = supabaseAdmin as any

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const proposalId = formData.get("proposalId") as string | null

    if (!file || !proposalId) {
      return NextResponse.json({ error: "Missing file or proposalId" }, { status: 400 })
    }

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "pdf"
    const path = `proposals/${proposalId}.${ext}`

    // Remove old file if exists
    await db.storage.from("proposal-pdfs").remove([path])

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadErr } = await db.storage
      .from("proposal-pdfs")
      .upload(path, buffer, { contentType: "application/pdf", upsert: true })

    if (uploadErr) {
      console.error("[proposal-pdf] upload error:", uploadErr)
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    const { data: urlData } = db.storage.from("proposal-pdfs").getPublicUrl(path)
    const publicUrl = urlData?.publicUrl

    // Save URL on proposal
    const { error: updateErr } = await db
      .from("proposals")
      .update({ custom_pdf_url: publicUrl })
      .eq("id", proposalId)

    if (updateErr) {
      console.error("[proposal-pdf] update error:", updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error("[proposal-pdf]", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { proposalId } = await req.json()
    if (!proposalId) return NextResponse.json({ error: "Missing proposalId" }, { status: 400 })

    // Get current URL to find the storage path
    const { data: proposal } = await db
      .from("proposals")
      .select("custom_pdf_url")
      .eq("id", proposalId)
      .single()

    if (proposal?.custom_pdf_url) {
      const path = `proposals/${proposalId}.pdf`
      await db.storage.from("proposal-pdfs").remove([path])
    }

    // Clear the URL
    await db.from("proposals").update({ custom_pdf_url: null }).eq("id", proposalId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[proposal-pdf] delete error:", err)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
