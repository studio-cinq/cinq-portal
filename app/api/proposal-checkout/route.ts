import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy proposal checkout is no longer available. Use /api/proposal-accept.",
      code: "LEGACY_ROUTE_RETIRED",
    },
    { status: 410 }
  )
}
