/**
 * Single source of truth for the status colors that show up across the admin
 * portal — proposals, quotes, plans, invoices, project lifecycle. Without
 * this, "draft" was different greys in three places and "sent" was the same
 * amber everywhere only by accident.
 */
export const STATUS_COLORS: Record<string, string> = {
  // Document lifecycle
  draft:    "rgba(15,15,14,0.4)",
  sent:     "var(--amber)",
  viewed:   "var(--sage)",
  accepted: "var(--sage)",
  declined: "var(--danger)",
  archived: "rgba(15,15,14,0.35)",

  // Invoice-specific
  overdue:  "var(--danger)",
  paid:     "var(--sage)",

  // Project lifecycle
  proposal_sent:    "var(--amber)",
  active:           "var(--sage)",
  awaiting_client:  "var(--amber)",
  awaiting_payment: "var(--amber)",
  on_hold:          "var(--amber)",
  complete:         "rgba(15,15,14,0.4)",
}

export function statusColor(status: string | null | undefined): string {
  if (!status) return "rgba(15,15,14,0.4)"
  return STATUS_COLORS[status] ?? "rgba(15,15,14,0.4)"
}
