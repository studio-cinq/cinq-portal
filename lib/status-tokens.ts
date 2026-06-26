/**
 * Single source of truth for the status colors that show up across the admin
 * portal — proposals, quotes, plans, invoices, project lifecycle.
 *
 * Mapped to the locked Cinq accent roles:
 *   alarm    (oxblood)      → overdue / declined / urgent
 *   pending  (ochre)        → draft / sent / awaiting / in-progress
 *   complete (olive bronze) → accepted / paid / approved / done
 *   neutral  (ink fade)     → archived / past / quiet
 *
 * French blue (--link) is intentionally absent — it's for inline links and
 * focus rings only, never a status chip.
 */
export const STATUS_COLORS: Record<string, string> = {
  // Document lifecycle
  draft:    "var(--pending)",
  sent:     "var(--pending)",
  viewed:   "var(--complete)",
  accepted: "var(--complete)",
  declined: "var(--alarm)",
  archived: "rgba(26,24,21,0.4)",

  // Invoice-specific
  overdue:  "var(--alarm)",
  paid:     "var(--complete)",

  // Project lifecycle
  proposal_sent:    "var(--pending)",
  active:           "var(--complete)",
  awaiting_client:  "var(--pending)",
  awaiting_payment: "var(--pending)",
  on_hold:          "var(--pending)",
  complete:         "rgba(26,24,21,0.4)",
}

export function statusColor(status: string | null | undefined): string {
  if (!status) return "rgba(26,24,21,0.4)"
  return STATUS_COLORS[status] ?? "rgba(26,24,21,0.4)"
}
