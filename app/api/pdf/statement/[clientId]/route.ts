import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { generateStatementPdf } from "@/lib/pdf/statement"

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
export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const result = await generateStatementPdf(params.clientId)
    if (!result) return NextResponse.json({ error: "Client not found" }, { status: 404 })

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("[pdf/statement]", err)
    return NextResponse.json({ error: "Failed to generate statement" }, { status: 500 })
  }
}
