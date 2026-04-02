import { Resend } from "resend"

let resendClient: Resend | null = null

function getApiKey() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured")
  }
  return apiKey
}

export function getResend() {
  if (!resendClient) {
    resendClient = new Resend(getApiKey())
  }
  return resendClient
}

type SendEmailPayload = Parameters<ReturnType<typeof getResend>["emails"]["send"]>[0]

export function sendEmail(payload: SendEmailPayload) {
  return getResend().emails.send(payload)
}

export function trySendEmail(payload: SendEmailPayload) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] Skipping send because RESEND_API_KEY is not configured")
    return Promise.resolve({ skipped: true as const })
  }

  return getResend().emails.send(payload)
}
