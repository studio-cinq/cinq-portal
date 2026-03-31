import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    bankName:      process.env.ACH_BANK_NAME ?? "",
    routingNumber: process.env.ACH_ROUTING_NUMBER ?? "",
    accountNumber: process.env.ACH_ACCOUNT_NUMBER ?? "",
    accountName:   process.env.ACH_ACCOUNT_NAME ?? "",
  })
}
