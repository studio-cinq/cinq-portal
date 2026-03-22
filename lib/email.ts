import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const STUDIO_EMAIL = "kacie@studiocinq.com";
const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.studiocinq.com";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-US", {
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
      <p>Questions? Reply to this email or reach out to kacie@studiocinq.com</p>
    </div>
  </div>
</body>
</html>`
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

// ─── Proposal accepted ────────────────────────────────────────────────────────

interface ProposalAcceptedPayload {
  proposalId: string;
  proposalTitle: string;
  clientName: string;
  contactName: string;
  contactEmail: string;
  totalCents: number;       // sum of accepted proposal_items.price
  stripeSessionId?: string;
  acceptedAt: Date;
}

export async function sendProposalAcceptedEmail(p: ProposalAcceptedPayload) {
  const proposalUrl = `${PORTAL_URL}/admin/proposals/${p.proposalId}`;
  const total = (p.totalCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  const html = emailShell(`
    <div class="body">
      <p>${p.contactName} at <strong>${p.clientName}</strong> accepted a proposal and completed checkout.</p>
      <div class="meta">
        <p><strong>Proposal</strong> &nbsp;${p.proposalTitle}</p>
        <p><strong>Client</strong> &nbsp;${p.clientName} (${p.contactName})</p>
        <p><strong>Contact</strong> &nbsp;${p.contactEmail}</p>
        <p><strong>Total</strong> &nbsp;${total}</p>
        <p><strong>Accepted</strong> &nbsp;${formatDate(p.acceptedAt)}</p>
        ${p.stripeSessionId ? `<p><strong>Stripe session</strong> &nbsp;<code style="font-size:11px">${p.stripeSessionId}</code></p>` : ""}
      </div>
      <a class="cta" href="${proposalUrl}"style="color:#FAF8F5;text-decoration:none;">View &amp; pay invoice →</a>
    </div>
  `);

  return resend.emails.send({
    from: "Studio Cinq Portal <portal@studiocinq.com>",
    to: STUDIO_EMAIL,
    subject: `Proposal accepted 🎉 — ${p.clientName} · ${total}`,
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
}

export async function sendInvoiceEmail(p: InvoiceSentPayload) {
  const amount = (p.amountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })

  const dueLine = p.dueDate
    ? new Date(p.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null

  const html = emailShell(`
    <div class="body">
      <p>Hi ${p.contactName} — you have a new invoice from Studio Cinq.</p>
      <div class="meta">
        <p><strong>Invoice</strong> &nbsp;#${p.invoiceNumber}</p>
        <p><strong>Description</strong> &nbsp;${p.description}</p>
        <p><strong>Amount</strong> &nbsp;${amount}</p>
        ${dueLine ? `<p><strong>Due</strong> &nbsp;${dueLine}</p>` : ""}
      </div>
      <a class="cta" href="${p.invoiceUrl}" style="color:#FAF8F5;text-decoration:none;">View &amp; pay invoice →</a>
    </div>
  `)

  return resend.emails.send({
    from: "Studio Cinq <portal@studiocinq.com>",
    to: p.contactEmail,
    subject: `Invoice #${p.invoiceNumber} — ${amount} due from Studio Cinq`,
    html,
  })
}