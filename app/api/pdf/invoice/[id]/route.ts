import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { jsPDF } from "jspdf"
import { PAID_STAMP_PNG } from "@/lib/paid-stamp"

const INK = [15, 15, 14] as const
const CREAM = [244, 241, 236] as const
const SAGE = [143, 167, 181] as const
const AMBER = [201, 90, 59] as const

function setColor(doc: jsPDF, rgb: readonly number[], opacity: number = 1) {
  if (opacity < 1) {
    const mixed = rgb.map((c, i) => Math.round(c * opacity + CREAM[i] * (1 - opacity)))
    doc.setTextColor(mixed[0], mixed[1], mixed[2])
  } else {
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { data: invoice } = await (supabaseAdmin.from("invoices") as any)
      .select("*, clients(name, contact_name, contact_email), projects(title)")
      .eq("id", params.id)
      .single()

    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const client = invoice.clients as any
    const project = invoice.projects as any
    const amount = invoice.amount / 100
    const isPaid = invoice.status === "paid"

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

    // Top bar
    doc.setFillColor(INK[0], INK[1], INK[2])
    doc.rect(0, 0, W, 4, "F")

    // ── Header ──
    y = 56

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    setColor(doc, INK, 0.38)
    doc.text("INVOICE", marginL, y)

    // Status badge (top right) — skip if paid, stamp handles it
    if (invoice.status !== "paid") {
      const statusColors: Record<string, readonly number[]> = {
        sent: AMBER, overdue: [192, 57, 43], draft: INK,
      }
      const statusColor = statusColors[invoice.status] ?? INK
      doc.setFontSize(8)
      setColor(doc, statusColor, 0.85)
      doc.text(invoice.status.toUpperCase(), W - marginR, y, { align: "right" })
    }

    y += 28

    // Invoice number
    doc.setFontSize(26)
    setColor(doc, INK, 0.9)
    doc.text(`#${invoice.invoice_number}`, marginL, y)
    y += 16

    // Description
    doc.setFontSize(12)
    setColor(doc, INK, 0.6)
    doc.text(invoice.description, marginL, y)
    y += 36

    // ── From / To ──
    doc.setDrawColor(200, 196, 190)
    doc.setLineWidth(0.3)
    doc.line(marginL, y, W - marginR, y)
    y += 20

    const colMid = marginL + contentW / 2

    // From
    doc.setFontSize(6.5)
    setColor(doc, INK, 0.38)
    doc.text("FROM", marginL, y)
    doc.text("TO", colMid, y)
    y += 14

    doc.setFontSize(10)
    setColor(doc, INK, 0.8)
    doc.text("Studio Cinq", marginL, y)
    doc.text(client?.name ?? "—", colMid, y)
    y += 14

    doc.setFontSize(9)
    setColor(doc, INK, 0.5)
    doc.text("Kacie Yates", marginL, y)
    doc.text(client?.contact_name ?? "", colMid, y)
    y += 12
    doc.text("kacie@studiocinq.com", marginL, y)
    doc.text(client?.contact_email ?? "", colMid, y)
    y += 28

    doc.line(marginL, y, W - marginR, y)
    y += 28

    // ── Details grid ──
    const details = [
      { label: "INVOICE NUMBER", value: `#${invoice.invoice_number}` },
      { label: "PROJECT", value: project?.title ?? "—" },
      { label: "DATE ISSUED", value: new Date(invoice.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" }) },
      { label: "DUE DATE", value: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" }) : "Upon receipt" },
    ]

    const detailColW = contentW / 2
    details.forEach((d, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = marginL + col * detailColW
      const dy = y + row * 36

      doc.setFontSize(6.5)
      setColor(doc, INK, 0.38)
      doc.text(d.label, x, dy)

      doc.setFontSize(10)
      setColor(doc, INK, 0.75)
      doc.text(d.value, x, dy + 14)
    })

    y += 80

    // ── Line items / Amount section ──
    const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items as any[] : []

    doc.setDrawColor(200, 196, 190)
    doc.setLineWidth(0.3)
    doc.line(marginL, y, W - marginR, y)
    y += 24

    doc.setFontSize(8)
    setColor(doc, INK, 0.38)
    doc.text("DESCRIPTION", marginL, y)
    doc.text("AMOUNT", W - marginR, y, { align: "right" })
    y += 18

    doc.setLineWidth(0.2)
    doc.line(marginL, y, W - marginR, y)
    y += 20

    if (lineItems.length > 0) {
      for (const item of lineItems) {
        doc.setFontSize(11)
        setColor(doc, INK, 0.8)
        doc.text(item.description, marginL, y)
        doc.text(`$${(item.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, W - marginR, y, { align: "right" })
        y += 22
      }
    } else {
      doc.setFontSize(11)
      setColor(doc, INK, 0.8)
      doc.text(invoice.description, marginL, y)
      doc.text(`$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, W - marginR, y, { align: "right" })
      y += 22
    }

    y += 6
    doc.setLineWidth(0.3)
    doc.line(marginL, y, W - marginR, y)
    y += 20

    // Total
    doc.setFontSize(8)
    setColor(doc, INK, 0.45)
    doc.text("TOTAL DUE", W - marginR - 140, y)
    doc.setFontSize(20)
    setColor(doc, INK, 0.9)
    doc.text(`$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, W - marginR, y, { align: "right" })
    y += 12

    // Notes
    if (invoice.notes) {
      y += 20
      doc.setFontSize(8)
      setColor(doc, INK, 0.38)
      doc.text("NOTES", marginL, y)
      y += 14
      doc.setFontSize(9)
      setColor(doc, INK, 0.6)
      const noteLines = doc.splitTextToSize(invoice.notes, contentW)
      for (const line of noteLines) {
        doc.text(line, marginL, y)
        y += 12
      }
    }

    // ACH bank transfer details
    const paymentMethods: string[] = invoice.payment_methods ?? ["stripe"]
    if (paymentMethods.includes("ach") && !isPaid) {
      y += 24
      doc.setDrawColor(200, 196, 190)
      doc.setLineWidth(0.3)
      doc.line(marginL, y, W - marginR, y)
      y += 18

      doc.setFontSize(6.5)
      setColor(doc, INK, 0.38)
      doc.text("BANK TRANSFER DETAILS", marginL, y)
      y += 16

      const achRows = [
        { label: "BANK",           value: process.env.ACH_BANK_NAME ?? "" },
        { label: "ACCOUNT NAME",   value: process.env.ACH_ACCOUNT_NAME ?? "" },
        { label: "ROUTING NUMBER", value: process.env.ACH_ROUTING_NUMBER ?? "" },
        { label: "ACCOUNT NUMBER", value: process.env.ACH_ACCOUNT_NUMBER ?? "" },
        { label: "REFERENCE",      value: `Invoice #${invoice.invoice_number}` },
      ]

      for (const row of achRows) {
        doc.setFontSize(7)
        setColor(doc, INK, 0.38)
        doc.text(row.label, marginL, y)
        doc.setFontSize(10)
        setColor(doc, INK, 0.75)
        doc.text(row.value, marginL + 120, y)
        y += 16
      }
    }

    // Paid stamp (image in upper-right)
    if (isPaid) {
      const stampSize = 100
      doc.addImage(PAID_STAMP_PNG, "PNG", W - marginR - stampSize + 10, 40, stampSize, stampSize)
    }

    // ── Footer ──
    doc.setFontSize(7)
    setColor(doc, INK, 0.25)
    doc.text("Studio Cinq", marginL, H - 40)
    doc.text("portal.studiocinq.com", marginL, H - 28)
    doc.text("1 / 1", W - marginR, H - 28, { align: "right" })

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))
    const filename = `Invoice-${invoice.invoice_number}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[pdf/invoice]", err)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
