/**
 * Single source of truth for the "Needs your attention" list rendered on
 * both /admin/focus and /admin/studio.
 *
 * Before this, the two pages computed their own lists with different rules:
 * Studio counted every sent invoice + every pending proposal as attention,
 * Focus only counted stalled / overdue items. They disagreed by 5–7 items
 * on any given day, which eroded trust in both dashboards.
 *
 * Rules are deliberately strict — only things that need a human action:
 *   1. Overdue invoices
 *   2. Foundations published > 5 days ago with no approval
 *   3. Proposals viewed by client > 3 days ago with no response
 *   4. Unread client messages
 *
 * Sent-but-not-yet-overdue invoices, proposals that haven't been opened,
 * and out-for-review deliverables are NOT attention items. They're normal
 * in-flight work; surface them as activity, not action items.
 */

export type AttentionKind = "overdue" | "foundation-stalled" | "proposal-stalled" | "message"

export type AttentionItem = {
  id: string
  kind: AttentionKind
  clientId: string | null
  clientName: string
  /** Short headline rendered as the main label. */
  label: string
  /** Supporting detail line ($, due date, age, message snippet). */
  detail: string
  /** Sort key — 1 is most urgent, larger is less urgent. */
  urgency: number
  /** Where to send the user when they click the item. */
  href: string
}

function daysSince(d: string | Date): number {
  const then = typeof d === "string" ? new Date(d) : d
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / 86400000))
}

export function computeAttention(args: {
  invoicesOverdue: any[]
  foundationsPublished: any[]
  proposalsSent: any[]
  unreadMessages: any[]
}): AttentionItem[] {
  const out: AttentionItem[] = []

  // 1. Overdue invoices (urgency 1 — top of list)
  for (const inv of args.invoicesOverdue) {
    const age = inv.due_date ? daysSince(inv.due_date) : 0
    out.push({
      id: `inv-${inv.id}`,
      kind: "overdue",
      clientId: inv.client_id ?? null,
      clientName: inv.clients?.name ?? "—",
      label: `Overdue invoice — ${inv.clients?.name ?? "—"}`,
      detail: `#${inv.invoice_number} · $${(inv.amount / 100).toLocaleString()} · ${age}d past due`,
      urgency: 1,
      href: `/admin/invoices/${inv.id}/edit`,
    })
  }

  // 2. Foundations published > 5 days ago, no approval
  for (const f of args.foundationsPublished) {
    const age = daysSince(f.updated_at)
    if (age <= 5) continue
    out.push({
      id: `found-${f.id}`,
      kind: "foundation-stalled",
      clientId: f.client_id ?? null,
      clientName: f.clients?.name ?? "—",
      label: `Foundation awaiting approval — ${f.clients?.name ?? "—"}`,
      detail: `${f.title || "Brand Foundations"} · ${age}d since sent`,
      urgency: 2,
      href: `/admin/foundations/${f.id}/edit`,
    })
  }

  // 3. Proposals viewed by client > 3 days ago with no response
  for (const p of args.proposalsSent) {
    const viewedRef = p.last_viewed_at || p.viewed_at
    if (!viewedRef) continue
    const age = daysSince(viewedRef)
    if (age <= 3) continue
    out.push({
      id: `prop-${p.id}`,
      kind: "proposal-stalled",
      clientId: p.client_id ?? null,
      clientName: p.clients?.name ?? "—",
      label: `Proposal viewed, no response — ${p.clients?.name ?? "—"}`,
      detail: `${p.title} · last seen ${age}d ago`,
      urgency: 3,
      href: `/admin/proposals/${p.id}`,
    })
  }

  // 4. Unread client messages
  for (const m of args.unreadMessages) {
    const proj = m.projects as any
    const clientName = proj?.clients?.name ?? "—"
    out.push({
      id: `msg-${m.id}`,
      kind: "message",
      clientId: proj?.clients?.id ?? proj?.client_id ?? null,
      clientName,
      label: `New message — ${clientName}`,
      detail: ((m.body ?? "") as string).slice(0, 80) + ((m.body ?? "").length > 80 ? "…" : ""),
      urgency: 4,
      href: `/admin/clients/${proj?.clients?.id ?? proj?.client_id ?? ""}`,
    })
  }

  out.sort((a, b) => a.urgency - b.urgency)
  return out
}
