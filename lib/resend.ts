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

/**
 * Send an email via Resend, and throw if Resend rejects it.
 *
 * Resend's SDK returns { data, error } rather than throwing on failure, which
 * meant a rejection looked indistinguishable from success to our callers. This
 * wrapper inspects the response and throws so callers' try/catch blocks see
 * the failure.
 */
export async function sendEmail(payload: SendEmailPayload) {
  const result = await getResend().emails.send(payload)
  if (result.error) {
    const to = Array.isArray(payload.to) ? payload.to.join(", ") : payload.to
    console.error("[resend] Send failed", { to, subject: payload.subject, error: result.error })
    throw new Error(`Resend rejected email to ${to}: ${result.error.message ?? "unknown error"}`)
  }
  return result
}

export async function trySendEmail(payload: SendEmailPayload) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] Skipping send because RESEND_API_KEY is not configured")
    return { skipped: true as const }
  }
  const result = await getResend().emails.send(payload)
  if (result.error) {
    const to = Array.isArray(payload.to) ? payload.to.join(", ") : payload.to
    console.error("[resend] Send failed (non-throwing path)", { to, subject: payload.subject, error: result.error })
  }
  return result
}
