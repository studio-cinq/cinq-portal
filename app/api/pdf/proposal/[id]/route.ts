import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { jsPDF } from "jspdf"

const INK = [15, 15, 14] as const
const CREAM = [244, 241, 236] as const
const SAGE = [143, 167, 181] as const
const AMBER = [201, 90, 59] as const
const GOLD = [181, 160, 66] as const
const MUTED = [15, 15, 14] as const

function setColor(doc: jsPDF, rgb: readonly number[], opacity: number = 1) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2])
  // jsPDF doesn't support text opacity natively, we adjust via color mixing with cream
  if (opacity < 1) {
    const mixed = rgb.map((c, i) => Math.round(c * opacity + CREAM[i] * (1 - opacity)))
    doc.setTextColor(mixed[0], mixed[1], mixed[2])
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { data: proposal } = await (supabaseAdmin.from("proposals") as any)
      .select("*, clients(name, contact_name, contact_email)")
      .eq("id", params.id)
      .single()

    if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: items } = await (supabaseAdmin.from("proposal_items") as any)
      .select("*")
      .eq("proposal_id", params.id)
      .order("sort_order")

    const client = proposal.clients as any
    const allItems = (items ?? []) as any[]
    const requiredItems   = allItems.filter((i: any) => i.is_required)
    const selectableItems = allItems.filter((i: any) => !i.is_required && !i.is_optional)
    const optionalItems   = allItems.filter((i: any) => i.is_optional)
    const requiredTotal   = requiredItems.reduce((s: number, i: any) => s + (i.price ?? 0), 0)
    const selectableTotal = selectableItems.reduce((s: number, i: any) => s + (i.price ?? 0), 0)
    const optionalTotal   = optionalItems.reduce((s: number, i: any) => s + (i.price ?? 0), 0)
    const baseTotal       = requiredTotal + selectableTotal
    const schedule = Array.isArray(proposal.payment_schedule) ? proposal.payment_schedule as number[] : [50, 50]
    const depositPct = schedule[0] ?? 50
    const depositCents = Math.round(baseTotal * (depositPct / 100))

    const doc = new jsPDF({ unit: "pt", format: "letter" })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const marginL = 56
    const marginR = 56
    const contentW = W - marginL - marginR
    let y = 0

    const newPage = () => {
      doc.addPage()
      drawBackground()
      y = 56
    }

    const checkSpace = (needed: number) => {
      if (y + needed > H - 60) newPage()
    }

    // ── Page background ──
    const drawBackground = () => {
      doc.setFillColor(CREAM[0], CREAM[1], CREAM[2])
      doc.rect(0, 0, W, H, "F")
    }
    drawBackground()

    // ── Header bar ──
    doc.setFillColor(INK[0], INK[1], INK[2])
    doc.rect(0, 0, W, 4, "F")

    // ── Top section ──
    y = 56

    // "PROPOSAL · STUDIO CINQ"
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    setColor(doc, INK, 0.38)
    doc.text("PROPOSAL  ·  STUDIO CINQ", marginL, y)
    y += 28

    // Title
    doc.setFont("helvetica", "normal")
    doc.setFontSize(26)
    setColor(doc, INK, 0.9)
    const titleLines = doc.splitTextToSize(proposal.title, contentW)
    doc.text(titleLines, marginL, y)
    y += titleLines.length * 32

    // Subtitle
    if (proposal.subtitle) {
      doc.setFontSize(12)
      setColor(doc, INK, 0.5)
      doc.text(proposal.subtitle, marginL, y)
      y += 20
    }

    // Prepared for
    doc.setFontSize(9)
    setColor(doc, INK, 0.4)
    doc.text(`Prepared for ${client?.contact_name ?? ""}`, marginL, y)
    y += 22

    // ── Meta row ──
    doc.setDrawColor(INK[0], INK[1], INK[2])
    doc.setLineWidth(0.3)
    const metaY = y
    doc.line(marginL, metaY, W - marginR, metaY)
    y += 18

    const metaCols = [
      { label: "CLIENT", value: client?.name ?? "—" },
      { label: "SENT", value: new Date(proposal.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }) },
      { label: "EXPIRES", value: proposal.expires_at ? new Date(proposal.expires_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }) : "—" },
      { label: "ESTIMATE", value: `$${(baseTotal / 100).toLocaleString()}` },
    ]

    const colW = contentW / metaCols.length
    metaCols.forEach((col, i) => {
      const x = marginL + i * colW
      doc.setFontSize(6.5)
      setColor(doc, INK, 0.38)
      doc.text(col.label, x, y)
      doc.setFontSize(10)
      setColor(doc, INK, 0.75)
      doc.text(col.value, x, y + 14)
    })

    y += 32
    doc.line(marginL, y, W - marginR, y)
    y += 22

    // ── Overview ──
    if (proposal.overview) {
      checkSpace(80)
      doc.setFontSize(7)
      setColor(doc, INK, 0.38)
      doc.text("OVERVIEW", marginL, y)
      y += 14

      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      setColor(doc, INK, 0.7)
      const overviewLines = doc.splitTextToSize(proposal.overview, contentW)
      for (const line of overviewLines) {
        checkSpace(14)
        doc.text(line, marginL, y)
        y += 13
      }
      y += 8
    }

    // ── Scope ──
    const renderItems = (sectionLabel: string, itemList: any[], subtotal: number) => {
      checkSpace(40)
      doc.setLineWidth(0.3)
      doc.line(marginL, y, W - marginR, y)
      y += 18

      doc.setFontSize(7)
      setColor(doc, INK, 0.38)
      doc.text(sectionLabel, marginL, y)
      doc.text(`Est. $${(subtotal / 100).toLocaleString()}`, W - marginR, y, { align: "right" })
      y += 10

      const renderedPhaseLabels = new Set<string>()

      for (const item of itemList) {
        // Phase header — only render each unique label once, require space for header + item
        const phaseLabel = item.phase_label?.trim() || null
        if (phaseLabel && !renderedPhaseLabels.has(phaseLabel)) {
          checkSpace(110)
          y += renderedPhaseLabels.size > 0 ? 10 : 2
          doc.setFontSize(11)
          setColor(doc, INK, 0.72)
          doc.text(phaseLabel, marginL, y)
          y += 6
          renderedPhaseLabels.add(phaseLabel)
        }

        checkSpace(60)
        doc.setLineWidth(0.2)
        setColor(doc, INK, 0.08)
        doc.setDrawColor(200, 196, 190)
        doc.line(marginL, y, W - marginR, y)
        y += 14

        // Name + timeline inline + price
        doc.setFontSize(12)
        setColor(doc, INK, 0.85)
        const nameWidth = doc.getTextWidth(item.name)
        doc.text(item.name, marginL, y)

        // Timeline inline after name
        if (item.timeline_weeks_min != null && item.timeline_weeks_max != null) {
          doc.setFontSize(7.5)
          setColor(doc, INK, 0.3)
          let timelineLabel: string
          if (item.timeline_weeks_min === 0 && item.timeline_weeks_max === 0) {
            timelineLabel = "Ongoing"
          } else if (item.timeline_weeks_min === item.timeline_weeks_max) {
            timelineLabel = item.timeline_weeks_min === 1 ? "1 week" : `${item.timeline_weeks_min} weeks`
          } else {
            timelineLabel = `${item.timeline_weeks_min}–${item.timeline_weeks_max} weeks`
          }
          doc.text(`·  ${timelineLabel}`, marginL + nameWidth + 8, y)
        }

        doc.setFontSize(11)
        setColor(doc, INK, 0.75)
        doc.text(`$${(item.price / 100).toLocaleString()}`, W - marginR, y, { align: "right" })
        y += 15

        // Badges
        if (item.is_recommended) {
          doc.setFontSize(6.5)
          setColor(doc, GOLD, 0.9)
          doc.text("RECOMMENDED", marginL, y)
          y += 10
        }

        // Description
        if (item.description) {
          doc.setFontSize(9)
          setColor(doc, INK, 0.55)
          const descLines = doc.splitTextToSize(item.description, contentW)
          for (const line of descLines) {
            checkSpace(11)
            doc.text(line, marginL, y)
            y += 11
          }
          y += 4
        } else {
          y += 2
        }
      }
    }

    if (requiredItems.length > 0) {
      renderItems("INCLUDED IN YOUR PROJECT", requiredItems, requiredTotal)
    }

    if (selectableItems.length > 0) {
      if (requiredItems.length > 0) y += 6
      renderItems(requiredItems.length > 0 ? "CUSTOMIZE YOUR SCOPE" : "SCOPE", selectableItems, selectableTotal)
    }

    if (optionalItems.length > 0) {
      y += 6
      renderItems("ADDITIONAL ADD-ONS", optionalItems, optionalTotal)
    }

    // ── Closing ──
    if (proposal.closing) {
      y += 6
      checkSpace(80)
      doc.setLineWidth(0.3)
      doc.setDrawColor(200, 196, 190)
      doc.line(marginL, y, W - marginR, y)
      y += 18

      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      setColor(doc, INK, 0.65)
      const closingLines = doc.splitTextToSize(proposal.closing, contentW)
      for (const line of closingLines) {
        checkSpace(16)
        doc.text(line, marginL, y)
        y += 14
      }
      y += 12

      doc.setFontSize(9)
      setColor(doc, INK, 0.4)
      doc.text("Kacie Yates · Studio Cinq", marginL, y)
      y += 18
    }

    // ── Summary box ──
    checkSpace(100)
    y += 6
    doc.setLineWidth(0.3)
    doc.setDrawColor(200, 196, 190)
    doc.line(marginL, y, W - marginR, y)
    y += 18

    doc.setFontSize(7)
    setColor(doc, INK, 0.38)
    doc.text("SUMMARY", marginL, y)
    y += 18

    doc.setFontSize(12)
    setColor(doc, INK, 0.85)
    doc.text("Base total", marginL, y)
    doc.text(`$${(baseTotal / 100).toLocaleString()}`, W - marginR, y, { align: "right" })
    y += 18

    doc.setFontSize(9)
    setColor(doc, INK, 0.5)
    doc.text(`${depositPct}% deposit due now`, marginL, y)
    doc.text(`$${Math.round(depositCents / 100).toLocaleString()}`, W - marginR, y, { align: "right" })
    y += 14

    if (schedule.length === 2) {
      doc.text(`Remaining ${schedule[1]}% invoiced at completion`, marginL, y)
    } else if (schedule.length === 3) {
      doc.text(`${schedule[1]}% at midpoint · ${schedule[2]}% at completion`, marginL, y)
    } else if (depositPct === 100) {
      doc.text("Full payment due now", marginL, y)
    }
    y += 18

    if (optionalTotal > 0) {
      doc.setFontSize(9)
      setColor(doc, INK, 0.4)
      doc.text("With additional add-ons", marginL, y)
      doc.text(`$${((baseTotal + optionalTotal) / 100).toLocaleString()}`, W - marginR, y, { align: "right" })
    }

    // ── Footer on each page ──
    const pageCount = doc.getNumberOfPages()
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setFontSize(7)
      setColor(doc, INK, 0.25)
      doc.text("Studio Cinq", marginL, H - 28)
      doc.text(`${p} / ${pageCount}`, W - marginR, H - 28, { align: "right" })
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))
    const filename = `${(proposal.title ?? "Proposal").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-")}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[pdf/proposal]", err)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
