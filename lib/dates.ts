/**
 * Date helpers that don't shift date-only values.
 *
 * Postgres `date` columns (invoices.due_date etc.) arrive as "YYYY-MM-DD".
 * `new Date("2026-04-28")` parses that as UTC midnight, so every US
 * timezone renders it as April 27. These helpers pin date-only strings to
 * UTC for both parsing and formatting; timestamps pass through untouched.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function isDateOnly(d: unknown): d is string {
  return typeof d === "string" && DATE_ONLY.test(d)
}

/** Parse for comparisons. Date-only → UTC midnight of that calendar day. */
export function toDate(d: string | Date): Date {
  if (d instanceof Date) return d
  return isDateOnly(d) ? new Date(`${d}T00:00:00Z`) : new Date(d)
}

/** Format for display. Date-only values are formatted in UTC so the calendar day is preserved. */
export function formatDate(
  d: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  if (!d) return ""
  if (isDateOnly(d)) return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" })
  return new Date(d).toLocaleDateString("en-US", opts)
}
