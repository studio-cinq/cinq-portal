import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { requireAdmin } from "@/lib/admin-auth"
import { jsPDF } from "jspdf"

/**
 * Client-level Statement of Account.
 *
 * A one-page summary PDF listing every open invoice for a client — number,
 * issued date, due date, aging, amount, total balance. It does NOT replace
 * any existing invoice; each invoice keeps its own number, its own aging,
 * its own status. This is a courtesy summary Kacie can attach to a nudge
 * email or hand to accounts payable to help them route payment internally.
 *
 * Route: /api/pdf/statement/{clientId}
 */

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com"

const INK    = [15, 15, 14] as const
const CREAM  = [244, 241, 236] as const
const ALARM  = [158, 53, 40] as const  // oxblood
const AMBER  = [196, 148, 58] as const // ochre
const MUTED  = 0.55

function setColor(doc: jsPDF, rgb: readonly number[], opacity: number = 1) {
  if (opacity < 1) {
    const mixed = rgb.map((c, i) => Math.round(c * opacity + CREAM[i] * (1 - opacity)))
    doc.setTextColor(mixed[0], mixed[1], mixed[2])
  } else {
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
  }
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—"
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const [{ data: client }, { data: invoices }] = await Promise.all([
      (supabaseAdmin.from("clients") as any)
        .select("name, contact_name")
        .eq("id", params.clientId).single(),
      (supabaseAdmin.from("invoices") as any)
        .select("id, invoice_number, description, amount, status, last_sent_at, created_at, due_date")
        .eq("client_id", params.clientId)
        .in("status", ["sent", "overdue", "upcoming"])
        .order("last_sent_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
    ])

    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

    const list = (invoices ?? []) as any[]
    const total = list.reduce((s, i) => s + (i.amount ?? 0), 0)
    const today = new Date()

    const doc = new jsPDF({ unit: "pt", format: "letter" })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const marginL = 56
    const marginR = 56
    const contentW = W - marginL - marginR
    let y = 0

    // Background
    doc.setFillColor(CREAM[0], CREAM[1], CREAM[2])
    doc.rect(0, 0, W, H, "F")

    // Top rule
    doc.setFillColor(INK[0], INK[1], INK[2])
    doc.rect(0, 0, W, 4, "F")

    // ── Header eyebrow + title ──
    y = 60

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    setColor(doc, INK, 0.4)
    doc.text("STATEMENT OF ACCOUNT", marginL, y)
    doc.text(fmtDate(today).toUpperCase(), W - marginR, y, { align: "right" })

    y += 32
    doc.setFontSize(22)
    setColor(doc, INK, 0.92)
    doc.text(client.name ?? "Statement", marginL, y)

    y += 14
    doc.setFontSize(9)
    setColor(doc, INK, 0.5)
    if (client.contact_name) doc.text(`Attn. ${client.contact_name}`, marginL, y)

    // ── Balance-due block (one loud thing) ──
    y += 44
    doc.setDrawColor(200, 196, 190)
    doc.setLineWidth(0.3)
    doc.line(marginL, y, W - marginR, y)

    y += 26
    doc.setFontSize(7)
    setColor(doc, INK, 0.4)
    doc.text("TOTAL BALANCE DUE", marginL, y)
    doc.text(`${list.length} ${list.length === 1 ? "OPEN INVOICE" : "OPEN INVOICES"}`, W - marginR, y, { align: "right" })

    y += 34
    doc.setFontSize(36)
    setColor(doc, INK, 0.95)
    doc.text(fmtMoney(total), marginL, y)

    // ── Invoice table ──
    y += 44
    doc.setDrawColor(200, 196, 190)
    doc.setLineWidth(0.3)
    doc.line(marginL, y, W - marginR, y)

    y += 20
    // Column x-anchors — Number / Description / Issued / Due / Aging / Amount(right)
    const colX = {
      num:    marginL,
      desc:   marginL + 78,
      issued: marginL + 250,
      due:    marginL + 320,
      status: marginL + 390,
    }
    const amountX = W - marginR

    doc.setFontSize(6.5)
    setColor(doc, INK, 0.4)
    doc.text("INVOICE", colX.num, y)
    doc.text("DESCRIPTION", colX.desc, y)
    doc.text("ISSUED", colX.issued, y)
    doc.text("DUE", colX.due, y)
    doc.text("STATUS", colX.status, y)
    doc.text("AMOUNT", amountX, y, { align: "right" })

    y += 8
    doc.setDrawColor(200, 196, 190)
    doc.setLineWidth(0.3)
    doc.line(marginL, y, W - marginR, y)
    y += 16

    for (const inv of list) {
      const issued = inv.last_sent_at ?? inv.created_at
      const due = inv.due_date ? new Date(inv.due_date) : null
      const isOverdue = inv.status === "overdue" || (due && due < today)
      let statusText = "Sent"
      let statusColor: readonly number[] = INK
      let statusOpacity = 0.55
      if (isOverdue) {
        const anchor = due ?? (issued ? new Date(issued) : today)
        const days = Math.max(0, Math.floor((today.getTime() - anchor.getTime()) / 86400000))
        statusText = `${days}d overdue`
        statusColor = ALARM
        statusOpacity = 1
      } else if (!inv.due_date) {
        statusText = "On receipt"
        statusColor = AMBER
        statusOpacity = 1
      } else {
        const days = Math.max(0, Math.floor((due!.getTime() - today.getTime()) / 86400000))
        statusText = `due in ${days}d`
      }

      doc.setFontSize(9)
      setColor(doc, INK, 0.85)
      const invLabel = `#${inv.invoice_number}`
      const invUrl = `${PORTAL_URL}/invoice/${inv.id}`
      doc.textWithLink(invLabel, colX.num, y, { url: invUrl })

      // Description, truncated to fit
      const descMax = colX.issued - colX.desc - 6
      const descText = inv.description ?? ""
      const desc = doc.splitTextToSize(descText, descMax)[0] ?? ""
      doc.text(desc, colX.desc, y)

      setColor(doc, INK, MUTED)
      doc.text(fmtDate(issued), colX.issued, y)
      doc.text(fmtDate(inv.due_date), colX.due, y)

      setColor(doc, statusColor, statusOpacity)
      doc.text(statusText, colX.status, y)

      setColor(doc, INK, 0.9)
      doc.text(fmtMoney(inv.amount ?? 0), amountX, y, { align: "right" })

      y += 10
      doc.setDrawColor(220, 216, 210)
      doc.setLineWidth(0.2)
      doc.line(marginL, y, W - marginR, y)
      y += 14
    }

    // Total row
    y += 8
    doc.setFontSize(7)
    setColor(doc, INK, 0.5)
    doc.text("TOTAL DUE", colX.num, y)
    doc.setFontSize(14)
    setColor(doc, INK, 0.95)
    doc.text(fmtMoney(total), amountX, y, { align: "right" })

    // ── How to pay ──
    y += 44
    doc.setDrawColor(200, 196, 190)
    doc.setLineWidth(0.3)
    doc.line(marginL, y, W - marginR, y)

    y += 20
    doc.setFontSize(7)
    setColor(doc, INK, 0.4)
    doc.text("HOW TO PAY", marginL, y)

    y += 18
    doc.setFontSize(10)
    setColor(doc, INK, 0.75)
    doc.text("Each invoice above has its own client link with a Pay button and, where enabled,", marginL, y); y += 14
    doc.text("bank transfer details. Click any invoice number in your Cinq portal email, or ask", marginL, y); y += 14
    doc.text("Kacie to resend links.", marginL, y)

    // Optional ACH block if configured — one shared account works for all invoices
    if (process.env.ACH_BANK_NAME || process.env.ACH_ROUTING_NUMBER) {
      y += 28
      doc.setFontSize(6.5)
      setColor(doc, INK, 0.4)
      doc.text("BANK TRANSFER DETAILS", marginL, y)
      y += 14

      const achRows = [
        { label: "BANK",           value: process.env.ACH_BANK_NAME ?? "" },
        { label: "ACCOUNT NAME",   value: process.env.ACH_ACCOUNT_NAME ?? "" },
        { label: "ROUTING NUMBER", value: process.env.ACH_ROUTING_NUMBER ?? "" },
        { label: "ACCOUNT NUMBER", value: process.env.ACH_ACCOUNT_NUMBER ?? "" },
        { label: "REFERENCE",      value: `Statement — ${client.name ?? ""}` },
      ]
      for (const row of achRows) {
        doc.setFontSize(7)
        setColor(doc, INK, 0.4)
        doc.text(row.label, marginL, y)
        doc.setFontSize(10)
        setColor(doc, INK, 0.75)
        doc.text(row.value, marginL + 120, y)
        y += 14
      }
    }

    // ── Footer ──
    doc.setFontSize(7)
    setColor(doc, INK, 0.3)
    doc.text("Studio Cinq · Kacie Yates", marginL, H - 40)
    doc.text("portal.studiocinq.com  ·  kacie@studiocinq.com", marginL, H - 28)
    doc.text("1 / 1", W - marginR, H - 28, { align: "right" })

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))
    const safeName = (client.name ?? "client").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    const dateStr  = today.toISOString().slice(0, 10)
    const filename = `Statement-${safeName}-${dateStr}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("[pdf/statement]", err)
    return NextResponse.json({ error: "Failed to generate statement" }, { status: 500 })
  }
}
