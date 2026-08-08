import { NextResponse } from "next/server"
import { generateInvoicePdf } from "@/lib/pdf/invoice"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const result = await generateInvoicePdf(params.id)
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    })
  } catch (err) {
    console.error("[pdf/invoice]", err)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
