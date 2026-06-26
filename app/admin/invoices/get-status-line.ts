/**
 * Single source of truth for the invoice StatusLine on the admin index.
 * Produces sent / viewed / aging text + a tone for the aging fragment so
 * both the row render and any analytics read the same wording.
 */
export type AgingTone = "danger" | "warning" | "secondary"
export type StatusLine = {
  sentText: string
  viewedText: string
  agingText: string
  agingTone: AgingTone
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function dayDiff(later: Date, earlier: Date): number {
  const MS = 24 * 60 * 60 * 1000
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / MS))
}

export function getStatusLine(args: {
  sent_date: string | null   // last_sent_at, falling back to created_at
  viewed_date: string | null
  due_date: string | null
  status: string             // sent / overdue / draft / paid / upcoming
  today?: Date
}): StatusLine {
  const today = args.today ?? new Date()
  const sent = args.sent_date ? new Date(args.sent_date) : null
  const viewed = args.viewed_date ? new Date(args.viewed_date) : null
  const due = args.due_date ? new Date(args.due_date) : null

  const sentText = sent ? `Sent ${fmtDate(sent)}` : "Not sent"
  const viewedText = viewed ? `Viewed ${fmtDate(viewed)}` : "Not yet viewed"

  let agingText: string
  let agingTone: AgingTone

  const isOverdue = args.status === "overdue" || (due != null && due < today)
  if (isOverdue) {
    const anchor = due ?? sent ?? today
    agingText = `${dayDiff(today, anchor)} days unpaid`
    agingTone = "danger"
  } else if (!viewed && sent) {
    agingText = `${dayDiff(today, sent)} days waiting`
    agingTone = "warning"
  } else if (due) {
    agingText = `due in ${dayDiff(due, today)} days`
    agingTone = "secondary"
  } else if (sent) {
    agingText = `${dayDiff(today, sent)} days since sent`
    agingTone = "secondary"
  } else {
    agingText = ""
    agingTone = "secondary"
  }

  return { sentText, viewedText, agingText, agingTone }
}
