import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const STUDIO_EMAIL = "kacie@studiocinq.com";
const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com";

// ─── Shared helpers ────────────────────────────────────────────────────────────

const TZ = "America/New_York"

function formatDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function emailShell(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body  { margin: 0; padding: 0; background: #F0EBE3; font-family: Georgia, serif; }
    .wrap { max-width: 520px; margin: 48px auto; background: #FAF8F5; border: 0.5px solid #DDD6CC; }
    .head { padding: 32px 40px 24px; border-bottom: 0.5px solid #DDD6CC; }
    .head p { margin: 0; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
              color: #9E9589; font-family: -apple-system, sans-serif; }
    .body { padding: 28px 40px 32px; }
    .body p { margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #2C2820; }
    .meta  { background: #F0EBE3; border: 0.5px solid #DDD6CC;
             padding: 16px 20px; margin: 24px 0; }
    .meta p { margin: 0 0 7px; font-size: 13px; font-family: -apple-system, sans-serif;
              color: #6B6258; }
    .meta p:last-child { margin: 0; }
    .meta strong { color: #1C1916; font-weight: 600; }
    .cta  { display: inline-block; margin-top: 8px; padding: 12px 24px;
        background: #1C1916; color: #FAF8F5 !important; font-family: -apple-system, sans-serif;
        font-size: 12px; letter-spacing: 0.08em; text-decoration: none !important; }
    .foot { padding: 16px 40px; border-top: 0.5px solid #DDD6CC; }
    .foot p { margin: 0; font-size: 11px; font-family: -apple-system, sans-serif;
              color: #B0A89E; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <p>Studio Cinq</p>
    </div>
    ${body}
    <div class="foot">
      <p>Questions? Reply to this email or reach out to <a href="mailto:kacie@studiocinq.com" style="color:#9E9589;text-decoration:none;">kacie@studiocinq.com</a></p>
    </div>
  </div>
</body>
</html>`
}

// ─── Proposal sent — to client ────────────────────────────────────────────────

interface ProposalSentPayload {
  proposalId: string;
  proposalTitle: string;
  subtitle?: string | null;
  clientName: string;
  contactName: string;
  contactEmail: string;
  estimateCents: number;
  expiresAt?: string | null;
}

export async function sendProposalEmail(p: ProposalSentPayload) {
  const proposalUrl = `${PORTAL_URL}/proposals/${p.proposalId}`;
  const estimate = (p.estimateCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  const expiresLine = p.expiresAt
    ? new Date(p.expiresAt).toLocaleDateString("en-US", { timeZone: TZ, month: "long", day: "numeric", year: "numeric" })
    : null;

  const html = emailShell(`
    <div class="body">
      <p>Hi ${p.contactName} — a new proposal from Studio Cinq is ready for your review.</p>
      ${p.subtitle ? `<p style="color:#6B6258;font-style:italic">${p.subtitle}</p>` : ""}
      <div class="meta">
        <p><strong>Proposal</strong> &nbsp;${p.proposalTitle}</p>
        ${expiresLine ? `<p><strong>Expires</strong> &nbsp;${expiresLine}</p>` : ""}
      </div>
      <a class="cta" href="${proposalUrl}" style="color:#FAF8F5;text-decoration:none;">View proposal →</a>
    </div>
  `);

  return resend.emails.send({
    from: "Studio Cinq <portal@studiocinq.com>",
    to: p.contactEmail,
    subject: `New proposal — ${p.proposalTitle}`,
    html,
  });
}

// ─── Proposal viewed ──────────────────────────────────────────────────────────

interface ProposalViewedPayload {
  proposalId: string;
  proposalTitle: string;
  clientName: string;       // company name
  contactName: string;      // contact person
  contactEmail: string;
  viewedAt: Date;
}

export async function sendProposalViewedEmail(p: ProposalViewedPayload) {
  const proposalUrl = `${PORTAL_URL}/admin/proposals/${p.proposalId}`;

  const html = emailShell(`
    <div class="body">
      <p>${p.contactName} at <strong>${p.clientName}</strong> just opened their proposal.</p>
      <div class="meta">
        <p><strong>Proposal</strong> &nbsp;${p.proposalTitle}</p>
        <p><strong>Client</strong> &nbsp;${p.clientName} (${p.contactName})</p>
        <p><strong>Contact</strong> &nbsp;${p.contactEmail}</p>
        <p><strong>Viewed</strong> &nbsp;${formatDate(p.viewedAt)}</p>
      </div>
      <a class="cta" href="${proposalUrl}"style="color:#FAF8F5;text-decoration:none;">View &amp; pay invoice →</a>
    </div>
  `);

  return resend.emails.send({
    from: "Studio Cinq Portal <portal@studiocinq.com>",
    to: STUDIO_EMAIL,
    subject: `Proposal opened — ${p.clientName}`,
    html,
  });
}

// ─── Shared item types for proposal emails ───────────────────────────────────

interface SelectedItem {
  name: string;
  price: number;         // cents
  phase: "now" | "later";
  isRequired: boolean;
}

interface SkippedItem {
  name: string;
  price: number;         // cents
  isOptional: boolean;
}

function formatItemList(selectedItems: SelectedItem[], skippedItems: SkippedItem[]) {
  const fmt = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  let html = ""

  // Selected items
  const priorityItems = selectedItems.filter(i => i.phase === "now")
  const phase2Items = selectedItems.filter(i => i.phase === "later")

  if (priorityItems.length > 0) {
    html += `<p style="margin:0 0 4px;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#9E9589">Priority for launch</p>`
    for (const item of priorityItems) {
      html += `<p style="margin:0 0 4px;font-size:13px;color:#2C2820">${item.name} &nbsp;<span style="color:#6B6258">${fmt(item.price)}</span>${item.isRequired ? ' <span style="color:#9E9589;font-size:11px">· included</span>' : ""}</p>`
    }
    html += `<br/>`
  }

  if (phase2Items.length > 0) {
    html += `<p style="margin:0 0 4px;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#9E9589">Second phase</p>`
    for (const item of phase2Items) {
      html += `<p style="margin:0 0 4px;font-size:13px;color:#2C2820">${item.name} &nbsp;<span style="color:#6B6258">${fmt(item.price)}</span></p>`
    }
    html += `<br/>`
  }

  // Skipped items
  if (skippedItems.length > 0) {
    html += `<p style="margin:0 0 4px;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#9E9589">Not included (still available)</p>`
    for (const item of skippedItems) {
      html += `<p style="margin:0 0 4px;font-size:13px;color:#9E9589">${item.name} &nbsp;${fmt(item.price)}</p>`
    }
  }

  return html
}

// ─── Proposal accepted — to admin ────────────────────────────────────────────

interface ProposalAcceptedPayload {
  proposalId: string;
  proposalTitle: string;
  clientName: string;
  contactName: string;
  contactEmail: string;
  totalCents: number;
  acceptedAt: Date;
  selectedItems: SelectedItem[];
  skippedItems: SkippedItem[];
  depositCents: number;
  depositPct: number;
  clientNote?: string | null;
}

export async function sendProposalAcceptedEmail(p: ProposalAcceptedPayload) {
  const proposalUrl = `${PORTAL_URL}/admin/proposals/${p.proposalId}`;
  const total = (p.totalCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const depositAmt = (p.depositCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  const html = emailShell(`
    <div class="body">
      <p>${p.contactName} at <strong>${p.clientName}</strong> accepted a proposal.</p>
      <div class="meta">
        <p><strong>Proposal</strong> &nbsp;${p.proposalTitle}</p>
        <p><strong>Client</strong> &nbsp;${p.clientName} (${p.contactName})</p>
        <p><strong>Project total</strong> &nbsp;${total}</p>
        <p><strong>Deposit (${p.depositPct}%)</strong> &nbsp;${depositAmt}</p>
        <p><strong>Accepted</strong> &nbsp;${formatDate(p.acceptedAt)}</p>
        ${p.clientNote ? `<p><strong>Client note</strong> &nbsp;<em>"${p.clientNote}"</em></p>` : ""}
      </div>
      <div style="margin: 20px 0; padding: 16px 20px; background: #F0EBE3; border: 0.5px solid #DDD6CC;">
        ${formatItemList(p.selectedItems, p.skippedItems)}
      </div>
      <a class="cta" href="${proposalUrl}" style="color:#FAF8F5;text-decoration:none;">View proposal →</a>
    </div>
  `);

  return resend.emails.send({
    from: "Studio Cinq Portal <portal@studiocinq.com>",
    to: STUDIO_EMAIL,
    subject: `Proposal accepted — ${p.clientName} · ${total}`,
    html,
  });
}

// ─── Proposal confirmation — to client ───────────────────────────────────────

interface ProposalConfirmationPayload {
  proposalId: string;
  proposalTitle: string;
  clientName: string;
  contactName: string;
  contactEmail: string;
  selectedItems: SelectedItem[];
  skippedItems: SkippedItem[];
  selectedTotalCents: number;
  depositCents: number;
  depositPct: number;
  schedule: number[];
}

export async function sendProposalConfirmationToClient(p: ProposalConfirmationPayload) {
  const total = (p.selectedTotalCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const depositAmt = (p.depositCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const proposalUrl = `${PORTAL_URL}/proposals/${p.proposalId}`;

  const scheduleLabel = p.schedule.map((pct, i) => {
    if (i === 0) return `${pct}% deposit`
    if (p.schedule.length === 2 && i === 1) return `${pct}% at completion`
    if (p.schedule.length === 3 && i === 1) return `${pct}% at midpoint`
    if (p.schedule.length === 3 && i === 2) return `${pct}% at completion`
    return `${pct}%`
  }).join(" · ")

  const skippedNote = p.skippedItems.length > 0
    ? `<p style="margin-top:12px;font-size:13px;color:#6B6258">The items listed under "not included" are still available if you'd like to add them later — just reach out.</p>`
    : ""

  const html = emailShell(`
    <div class="body">
      <p>Hi ${p.contactName} — thank you for confirming your project with Studio Cinq. Here's a summary of what you selected:</p>
      <div style="margin: 20px 0; padding: 16px 20px; background: #F0EBE3; border: 0.5px solid #DDD6CC;">
        ${formatItemList(p.selectedItems, p.skippedItems)}
      </div>
      <div class="meta">
        <p><strong>Project total</strong> &nbsp;${total}</p>
        <p><strong>Deposit due</strong> &nbsp;${depositAmt} (${p.depositPct}%)</p>
        <p><strong>Payment schedule</strong> &nbsp;${scheduleLabel}</p>
      </div>
      ${skippedNote}
      <p style="margin-top:16px">You'll receive a separate invoice for the deposit. If you have any questions, just reply to this email.</p>
      <a class="cta" href="${proposalUrl}" style="color:#FAF8F5;text-decoration:none;">View proposal →</a>
    </div>
  `);

  return resend.emails.send({
    from: "Studio Cinq <portal@studiocinq.com>",
    to: p.contactEmail,
    subject: `Project confirmed — ${p.proposalTitle}`,
    html,
  });
}

// ─── Invoice sent ─────────────────────────────────────────────────────────────

interface InvoiceSentPayload {
  invoiceNumber: string
  description: string
  amountCents: number
  dueDate?: string
  clientName: string
  contactName: string
  contactEmail: string
  invoiceUrl: string
  paymentMethods?: string[]
  ccEmails?: string[]
}

export async function sendInvoiceEmail(p: InvoiceSentPayload) {
  const amount = (p.amountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })

  const dueLine = p.dueDate
    ? new Date(p.dueDate).toLocaleDateString("en-US", { timeZone: TZ, month: "long", day: "numeric", year: "numeric" })
    : null

  const methods = p.paymentMethods ?? ["stripe"]
  const hasACH = methods.includes("ach")
  const hasStripe = methods.includes("stripe")
  const ctaLabel = hasStripe ? "View &amp; pay invoice →" : "View invoice details →"

  const achBlock = hasACH ? `
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid #DDD6CC">
      <p style="margin:0 0 8px;font-weight:600">Bank transfer option</p>
      <p style="margin:0;font-size:13px;color:#555">Bank: ${process.env.ACH_BANK_NAME ?? ""}</p>
      <p style="margin:0;font-size:13px;color:#555">Account name: ${process.env.ACH_ACCOUNT_NAME ?? ""}</p>
      <p style="margin:0;font-size:13px;color:#555">Routing #: ${process.env.ACH_ROUTING_NUMBER ?? ""}</p>
      <p style="margin:0;font-size:13px;color:#555">Account #: ${process.env.ACH_ACCOUNT_NUMBER ?? ""}</p>
      <p style="margin:0;font-size:13px;color:#555">Reference: Invoice #${p.invoiceNumber}</p>
    </div>
  ` : ""

  const html = emailShell(`
    <div class="body">
      <p>Hi ${p.contactName} — you have a new invoice from Studio Cinq.</p>
      <div class="meta">
        <p><strong>Invoice</strong> &nbsp;#${p.invoiceNumber}</p>
        <p><strong>Description</strong> &nbsp;${p.description}</p>
        <p><strong>Amount</strong> &nbsp;${amount}</p>
        ${dueLine ? `<p><strong>Due</strong> &nbsp;${dueLine}</p>` : ""}
        ${achBlock}
      </div>
      <a class="cta" href="${p.invoiceUrl}" style="color:#FAF8F5;text-decoration:none;">${ctaLabel}</a>
    </div>
  `)

  const cc = (p.ccEmails ?? []).filter(Boolean)

  return resend.emails.send({
    from: "Studio Cinq <portal@studiocinq.com>",
    to: p.contactEmail,
    ...(cc.length > 0 ? { cc } : {}),
    subject: `Invoice #${p.invoiceNumber} — ${amount} due from Studio Cinq`,
    html,
  })
}

// ─── Invoice paid — to admin ─────────────────────────────────────────────────

interface InvoicePaidPayload {
  invoiceId: string;
  invoiceNumber: string;
  description: string;
  amountCents: number;
  clientName: string;
  contactName: string;
  paidAt: Date;
  paymentMethod?: string; // "stripe" or "ach"
}

export async function sendInvoicePaidEmail(p: InvoicePaidPayload) {
  const amount = (p.amountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  const invoiceUrl = `${PORTAL_URL}/admin/invoices/${p.invoiceId}`;

  const html = emailShell(`
    <div class="body">
      <p><strong>${p.clientName}</strong> just paid an invoice.</p>
      <div class="meta">
        <p><strong>Invoice</strong> &nbsp;#${p.invoiceNumber}</p>
        <p><strong>Description</strong> &nbsp;${p.description}</p>
        <p><strong>Amount</strong> &nbsp;${amount}</p>
        <p><strong>Client</strong> &nbsp;${p.clientName} (${p.contactName})</p>
        <p><strong>Paid</strong> &nbsp;${formatDate(p.paidAt)}</p>
      </div>
      <a class="cta" href="${invoiceUrl}" style="color:#FAF8F5;text-decoration:none;">View invoice →</a>
    </div>
  `);

  return resend.emails.send({
    from: "Studio Cinq Portal <portal@studiocinq.com>",
    to: STUDIO_EMAIL,
    subject: `Invoice paid — #${p.invoiceNumber} · ${amount} from ${p.clientName}`,
    html,
  });
}

// ─── Proposal reminder — to client ────────────────────────────────────────────

interface ProposalReminderPayload {
  proposalId: string;
  proposalTitle: string;
  clientName: string;
  contactName: string;
  contactEmail: string;
  dayMark: 14 | 28;
  expiresAt?: string | null;
}

export async function sendProposalReminderToClient(p: ProposalReminderPayload) {
  const proposalUrl = `${PORTAL_URL}/proposals/${p.proposalId}`;

  const expiresLine = p.expiresAt
    ? new Date(p.expiresAt).toLocaleDateString("en-US", { timeZone: TZ, month: "long", day: "numeric", year: "numeric" })
    : null;

  const bodyText = p.dayMark === 14
    ? `<p>Hi ${p.contactName} — just a gentle follow-up. Your proposal from Studio Cinq has been waiting for your review for about two weeks.</p>
       <p>If you have questions or would like to talk through the scope, I'm always happy to hop on a quick call.</p>`
    : `<p>Hi ${p.contactName} — circling back on your proposal from Studio Cinq. It's been about a month since we sent it over${expiresLine ? `, and it expires on ${expiresLine}` : ""}.</p>
       <p>If the timing isn't right, no worries at all — just let me know and we can revisit when it makes sense.</p>`;

  const html = emailShell(`
    <div class="body">
      ${bodyText}
      <div class="meta">
        <p><strong>Proposal</strong> &nbsp;${p.proposalTitle}</p>
        ${expiresLine ? `<p><strong>Expires</strong> &nbsp;${expiresLine}</p>` : ""}
      </div>
      <a class="cta" href="${proposalUrl}" style="color:#FAF8F5;text-decoration:none;">View proposal →</a>
    </div>
  `);

  return resend.emails.send({
    from: "Studio Cinq <portal@studiocinq.com>",
    to: p.contactEmail,
    subject: p.dayMark === 14
      ? `Following up — ${p.proposalTitle}`
      : `Your proposal is waiting — ${p.proposalTitle}`,
    html,
  });
}

// ─── Proposal reminder — to admin (Kacie) ─────────────────────────────────────

export async function sendProposalReminderToAdmin(p: ProposalReminderPayload) {
  const proposalUrl = `${PORTAL_URL}/admin/proposals/${p.proposalId}`;

  const html = emailShell(`
    <div class="body">
      <p>${p.contactName} at <strong>${p.clientName}</strong> hasn't responded to their proposal after ${p.dayMark} days.</p>
      <div class="meta">
        <p><strong>Proposal</strong> &nbsp;${p.proposalTitle}</p>
        <p><strong>Client</strong> &nbsp;${p.clientName} (${p.contactName})</p>
        <p><strong>Contact</strong> &nbsp;${p.contactEmail}</p>
        <p><strong>Days since sent</strong> &nbsp;${p.dayMark}</p>
        ${p.expiresAt ? `<p><strong>Expires</strong> &nbsp;${new Date(p.expiresAt).toLocaleDateString("en-US", { timeZone: TZ, month: "long", day: "numeric" })}</p>` : ""}
      </div>
      <p>A reminder was also sent to the client. You may want to follow up personally.</p>
      <a class="cta" href="${proposalUrl}" style="color:#FAF8F5;text-decoration:none;">View proposal →</a>
    </div>
  `);

  return resend.emails.send({
    from: "Studio Cinq Portal <portal@studiocinq.com>",
    to: STUDIO_EMAIL,
    subject: `Proposal reminder (${p.dayMark}d) — ${p.clientName}`,
    html,
  });
}

// ─── Message reply notification — to client ───────────────────────────────────

// ─── Review invite — to client ───────────────────────────────────────────────

interface ReviewInvitePayload {
  sessionId: string
  projectTitle: string
  clientName: string
  contactName: string
  contactEmail: string
  siteUrl: string
  round: number
  notes?: string
}

export async function sendReviewInviteEmail(p: ReviewInvitePayload) {
  const reviewUrl = `${PORTAL_URL}/review/${p.sessionId}`

  const isFirstRound = p.round === 1
  const bodyText = isFirstRound
    ? `<p>Hi ${p.contactName} — your website is ready for review. Click through the site, leave your notes on anything you'd like changed, and submit when you're done.</p>`
    : `<p>Hi ${p.contactName} — round ${p.round} of your website review is ready. The changes from your previous feedback have been made. Take a look and let us know if anything else needs adjusting.</p>`

  const notesBlock = p.notes
    ? `<p style="color:#2C2820;font-style:italic;margin-top:8px">"${p.notes}"</p>`
    : ""

  const html = emailShell(`
    <div class="body">
      ${bodyText}
      <div class="meta">
        <p><strong>Project</strong> &nbsp;${p.projectTitle}</p>
        <p><strong>Site</strong> &nbsp;${p.siteUrl}</p>
        <p><strong>Round</strong> &nbsp;${p.round}</p>
        ${notesBlock}
      </div>
      <a class="cta" href="${reviewUrl}" style="color:#FAF8F5;text-decoration:none;">Review website →</a>
    </div>
  `)

  return resend.emails.send({
    from: "Studio Cinq <portal@studiocinq.com>",
    to: p.contactEmail,
    subject: isFirstRound
      ? `Website review ready — ${p.projectTitle}`
      : `Round ${p.round} ready for review — ${p.projectTitle}`,
    html,
  })
}

// ─── Review submitted — to admin ─────────────────────────────────────────────

interface ReviewSubmittedPayload {
  sessionId: string
  projectTitle: string
  clientName: string
  contactName: string
  round: number
  annotationCount: number
}

export async function sendReviewSubmittedEmail(p: ReviewSubmittedPayload) {
  const reviewUrl = `${PORTAL_URL}/admin/reviews/${p.sessionId}`

  const html = emailShell(`
    <div class="body">
      <p>${p.contactName} at <strong>${p.clientName}</strong> submitted their website review.</p>
      <div class="meta">
        <p><strong>Project</strong> &nbsp;${p.projectTitle}</p>
        <p><strong>Client</strong> &nbsp;${p.clientName} (${p.contactName})</p>
        <p><strong>Round</strong> &nbsp;${p.round}</p>
        <p><strong>Notes</strong> &nbsp;${p.annotationCount} annotation${p.annotationCount === 1 ? "" : "s"}</p>
      </div>
      <a class="cta" href="${reviewUrl}" style="color:#FAF8F5;text-decoration:none;">View feedback →</a>
    </div>
  `)

  return resend.emails.send({
    from: "Studio Cinq Portal <portal@studiocinq.com>",
    to: STUDIO_EMAIL,
    subject: `Review feedback received — ${p.clientName} (Round ${p.round})`,
    html,
  })
}

// ─── Review approved — to admin ──────────────────────────────────────────────

interface ReviewApprovedPayload {
  sessionId: string
  projectTitle: string
  clientName: string
  contactName: string
  totalRounds: number
}

export async function sendReviewApprovedEmail(p: ReviewApprovedPayload) {
  const reviewUrl = `${PORTAL_URL}/admin/reviews/${p.sessionId}`

  const html = emailShell(`
    <div class="body">
      <p>${p.contactName} at <strong>${p.clientName}</strong> approved their website.</p>
      <div class="meta">
        <p><strong>Project</strong> &nbsp;${p.projectTitle}</p>
        <p><strong>Client</strong> &nbsp;${p.clientName} (${p.contactName})</p>
        <p><strong>Total rounds</strong> &nbsp;${p.totalRounds}</p>
        <p><strong>Approved</strong> &nbsp;${formatDate(new Date())}</p>
      </div>
      <a class="cta" href="${reviewUrl}" style="color:#FAF8F5;text-decoration:none;">View in portal →</a>
    </div>
  `)

  return resend.emails.send({
    from: "Studio Cinq Portal <portal@studiocinq.com>",
    to: STUDIO_EMAIL,
    subject: `Website approved — ${p.clientName}`,
    html,
  })
}

// ─── Message reply notification — to client ───────────────────────────────────

interface MessageReplyPayload {
  contactName: string;
  contactEmail: string;
  clientName: string;
  projectTitle: string;
  messagePreview: string;
}

export async function sendMessageReplyEmail(p: MessageReplyPayload) {
  const dashboardUrl = `${PORTAL_URL}/dashboard`;

  const html = emailShell(`
    <div class="body">
      <p>Hi ${p.contactName} — Kacie left you a message on your ${p.projectTitle} project.</p>
      <div class="meta">
        <p><strong>Project</strong> &nbsp;${p.projectTitle}</p>
        <p style="color:#2C2820;font-style:italic;margin-top:8px">"${p.messagePreview.length > 200 ? p.messagePreview.slice(0, 200) + "…" : p.messagePreview}"</p>
      </div>
      <a class="cta" href="${dashboardUrl}" style="color:#FAF8F5;text-decoration:none;">View in portal →</a>
    </div>
  `);

  return resend.emails.send({
    from: "Studio Cinq <portal@studiocinq.com>",
    to: p.contactEmail,
    subject: `New message from Kacie — ${p.projectTitle}`,
    html,
  });
}

// ─── Portal invite — to client ──────────────────────────────────────────────

interface PortalInvitePayload {
  contactName: string;
  contactEmail: string;
  inviteLink: string;
}

export async function sendPortalInviteEmail(p: PortalInvitePayload) {
  const firstName = p.contactName.split(" ")[0] || p.contactName

  const html = emailShell(`
    <div class="body">
      <p>Hi ${firstName} — your Studio Cinq client portal is ready.</p>
      <p>This is your private space to track your project, review deliverables, manage invoices, and access your brand files — all in one place.</p>
      <p>Click below to set your password and get started.</p>
      <a class="cta" href="${p.inviteLink}" style="color:#FAF8F5;text-decoration:none;">Set up your account →</a>
      <p style="margin-top:24px;font-size:13px;color:#9E9589">If you have any questions, just reply to this email.</p>
    </div>
  `);

  return resend.emails.send({
    from: "Studio Cinq <portal@studiocinq.com>",
    to: p.contactEmail,
    subject: `Your Studio Cinq portal is ready`,
    html,
  });
}