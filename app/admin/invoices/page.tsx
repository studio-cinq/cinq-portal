import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import MarkPaidButton from "@/components/portal/MarkPaidButton"
import SendInvoiceReminderButton from "@/components/portal/SendInvoiceReminderButton"
import InvoiceOverflowMenu from "./InvoiceOverflowMenu"
import RemindClientButton from "./RemindClientButton"
import FilterTabs from "@/components/portal/FilterTabs"
import { getStatusLine, type AgingTone } from "./get-status-line"

const TAB_VALUES = ["outstanding", "paid", "drafts", "all"] as const
type TabValue = typeof TAB_VALUES[number]

const TAB_LABELS: Record<TabValue, string> = {
  outstanding: "Outstanding",
  paid: "Paid",
  drafts: "Drafts",
  all: "All",
}

const UNPAID_STATUSES = ["sent", "overdue", "upcoming"] as const

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams?: { tab?: string }
}) {
  const supabase = await createServerComponentClient()
  const requested = (searchParams?.tab ?? "outstanding") as TabValue
  const activeTab: TabValue = TAB_VALUES.includes(requested) ? requested : "outstanding"

  const { data: invoicesRaw } = await supabase
    .from("invoices").select("*, clients(name)")
    .order("last_sent_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
  const invoices = (invoicesRaw ?? []) as any[]

  // Server-side totals — independent of the active tab so the cards always
  // reflect the studio's full state, not just what's visible.
  const outstandingTotal = invoices.filter(i => UNPAID_STATUSES.includes(i.status)).reduce((s, i) => s + i.amount, 0)
  const overdueTotal     = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0)
  const overdueCount     = invoices.filter(i => i.status === "overdue").length
  const collectedTotal   = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0)
  const draftCount       = invoices.filter(i => i.status === "draft").length

  const visible = invoices.filter(inv => {
    if (activeTab === "outstanding") return UNPAID_STATUSES.includes(inv.status)
    if (activeTab === "paid")        return inv.status === "paid"
    if (activeTab === "drafts")      return inv.status === "draft"
    return true // "all" now means all — drafts included
  })

  const today = new Date()

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5 }}>
            Invoices
          </div>
          <Link href="/admin/invoices/new" style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--ink)", opacity: 0.6, textDecoration: "none",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
          }}>
            + New invoice
          </Link>
        </div>

        {/* Summary cards — always all three; Overdue greys at $0 */}
        <div className="admin-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 32 }}>
          <SummaryCard label="Outstanding" value={fmtMoney(outstandingTotal)} />
          <SummaryCard
            label={overdueCount > 0 ? `Overdue · ${overdueCount}` : "Overdue"}
            value={fmtMoney(overdueTotal)}
            tone={overdueCount > 0 ? "danger" : "quiet"}
          />
          <SummaryCard label="Collected" value={fmtMoney(collectedTotal)} />
        </div>

        <FilterTabs
          basePath="/admin/invoices"
          paramName="tab"
          activeValue={activeTab === "outstanding" ? null : activeTab}
          tabs={[
            { value: null,    label: TAB_LABELS.outstanding },
            { value: "paid",  label: TAB_LABELS.paid },
            { value: "all",   label: TAB_LABELS.all },
          ]}
          trailing={draftCount > 0 ? (
            <Link
              href="/admin/invoices?tab=drafts"
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "rgba(15,15,14,0.5)",
                textDecoration: "none", padding: "10px 0",
              }}
            >
              {draftCount} draft{draftCount === 1 ? "" : "s"} →
            </Link>
          ) : null}
        />

        {/* Invoice list — Outstanding groups by client so one nudge covers
             the whole batch. Paid + All stay as a flat chronological list. */}
        <div>
          {visible.length === 0 && (
            <div style={{ padding: "72px 0", textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 14, color: "rgba(15,15,14,0.5)" }}>
              {activeTab === "outstanding" && "All caught up — nothing outstanding."}
              {activeTab === "paid"        && "No paid invoices yet."}
              {activeTab === "drafts"      && "No drafts."}
              {activeTab === "all"         && "No invoices yet."}
            </div>
          )}
          {activeTab === "outstanding"
            ? groupByClient(visible, today).map(group => (
                <div key={group.clientId} style={{ marginTop: 24 }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0 8px",
                    borderBottom: "0.5px solid rgba(15,15,14,0.16)",
                    gap: 12,
                  }}>
                    <div style={{ ...clientHeaderStyle }}>
                      {group.clientName}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: "var(--ink)", opacity: 0.55,
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        ${Math.round(group.totalCents / 100).toLocaleString()} · {group.invoices.length} {group.invoices.length === 1 ? "invoice" : "invoices"}
                      </div>
                      <RemindClientButton
                        clientId={group.clientId}
                        clientName={group.clientName}
                        count={group.invoices.length}
                      />
                    </div>
                  </div>
                  {group.invoices.map(inv => (
                    <InvoiceRow key={inv.id} inv={inv} today={today} />
                  ))}
                </div>
              ))
            : visible.map(inv => <InvoiceRow key={inv.id} inv={inv} today={today} />)
          }
        </div>
      </main>
    </>
  )
}

function InvoiceRow({ inv, today }: { inv: any; today: Date }) {
  const isPaid = inv.status === "paid"
  const isUnpaid = UNPAID_STATUSES.includes(inv.status)
  const hasAch = Array.isArray(inv.payment_methods) && inv.payment_methods.includes("ach")
  const clientName = inv.clients?.name ?? "—"

  const status = isUnpaid
    ? getStatusLine({
        sent_date: inv.last_sent_at ?? inv.created_at ?? null,
        viewed_date: inv.viewed_at ?? null,
        due_date: inv.due_date ?? null,
        status: inv.status,
        today,
      })
    : null

  const paidDate = inv.paid_at ?? inv.paid_date ?? null

  // Paid rows get their "quiet" treatment by dimming the content blocks
  // individually — not the whole row — so the ··· overflow popover stays
  // at full opacity when opened. (opacity on a parent cascades and can't
  // be undone by the child.)
  const dimContent = isPaid ? 0.7 : 1

  return (
    <div
      className="invoice-row"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "13px 0",
        borderBottom: "0.5px solid rgba(15,15,14,0.1)",
      }}
    >
      {/* Primary block — name + client (line 1), StatusLine or Paid line (line 2) */}
      <div style={{ flex: 1, minWidth: 0, opacity: dimContent }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em", color: "rgba(15,15,14,0.45)", whiteSpace: "nowrap" }}>
            #{inv.invoice_number}
          </span>
          <span
            title={`${inv.description} · ${clientName}`}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 500,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {inv.description}
            <span style={{ color: "rgba(15,15,14,0.5)", fontWeight: 400 }}>
              {" · "}{clientName}
            </span>
          </span>
        </div>

        {status && (
          <div
            aria-label={`${status.sentText}, ${status.viewedText}, ${status.agingText}`}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              color: "rgba(15,15,14,0.55)",
              marginTop: 4,
              lineHeight: 1.45,
            }}
          >
            <span>{status.sentText}</span>
            <span style={{ opacity: 0.4, margin: "0 8px" }}>·</span>
            <span>{status.viewedText}</span>
            <span style={{ opacity: 0.4, margin: "0 8px" }}>·</span>
            <span style={{ fontWeight: 500, color: toneColor(status.agingTone) }}>
              {status.agingText}
            </span>
          </div>
        )}

        {isPaid && (
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(15,15,14,0.5)", marginTop: 4 }}>
            {paidDate ? `Paid ${new Date(paidDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Paid"}
          </div>
        )}
      </div>

      {/* Amount + ACH chip (ACH lives next to the payment number, not in the StatusLine) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, minWidth: 88, gap: 2, opacity: dimContent }}>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
          color: "var(--ink)",
        }}>
          ${(inv.amount / 100).toLocaleString("en-US")}
        </div>
        {hasAch && (
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(15,15,14,0.5)",
            border: "0.5px solid rgba(15,15,14,0.15)",
            padding: "1px 5px",
          }}>
            ACH
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {isUnpaid && (
          <>
            <MarkPaidButton invoiceId={inv.id} invoiceNumber={inv.invoice_number} />
            <SendInvoiceReminderButton invoiceId={inv.id} remindersSent={inv.reminders_sent_count ?? 0} compact />
          </>
        )}
        {isPaid && (
          <Link href={`/invoice/${inv.id}`} target="_blank" style={{
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--ink)", opacity: 0.6, textDecoration: "none",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "6px 10px",
          }}>
            View
          </Link>
        )}
        <InvoiceOverflowMenu invoiceId={inv.id} invoiceNumber={inv.invoice_number} />
      </div>
    </div>
  )
}

function toneColor(tone: AgingTone): string {
  if (tone === "danger") return "var(--danger)"
  if (tone === "warning") return "var(--amber)"
  return "rgba(15,15,14,0.55)"
}

function fmtMoney(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "danger" | "quiet" }) {
  const danger = tone === "danger"
  return (
    <div style={{
      background: danger ? "rgba(201,90,59,0.06)" : "rgba(255,255,255,0.35)",
      border: `0.5px solid rgba(15,15,14,${danger ? 0.15 : 0.1})`,
      padding: "16px 20px",
      borderRadius: 8,
    }}>
      <div style={{
        fontFamily: "var(--font-sans)",
        fontSize: 22,
        letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums",
        color: danger ? "var(--danger)" : "var(--ink)",
        marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        opacity: 0.5,
        color: danger ? "var(--danger)" : "var(--ink)",
      }}>
        {label}
      </div>
    </div>
  )
}

const clientHeaderStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--ink)",
  opacity: 0.85,
}

/**
 * Groups the outstanding-tab invoices by client and orders each group so
 * the most urgent invoice (oldest days-past-due, or oldest days-waiting)
 * sits at the top of its client bucket. Client buckets themselves sort by
 * total outstanding descending so cash flow drives the scan.
 */
function groupByClient(invoices: any[], today: Date): Array<{
  clientId: string
  clientName: string
  totalCents: number
  invoices: any[]
}> {
  const map = new Map<string, {
    clientId: string
    clientName: string
    totalCents: number
    invoices: any[]
  }>()

  for (const inv of invoices) {
    const key = inv.client_id ?? "__no-client__"
    const existing = map.get(key)
    if (existing) {
      existing.invoices.push(inv)
      existing.totalCents += inv.amount ?? 0
    } else {
      map.set(key, {
        clientId: key,
        clientName: inv.clients?.name ?? "—",
        totalCents: inv.amount ?? 0,
        invoices: [inv],
      })
    }
  }

  function urgency(inv: any): number {
    // Higher number = more urgent = should sort first.
    // Overdue: use days past due date, or days since sent if no due date.
    // Waiting: use days since sent (positive number, but lower than any overdue).
    const sent = inv.last_sent_at ? new Date(inv.last_sent_at) : (inv.created_at ? new Date(inv.created_at) : today)
    const due = inv.due_date ? new Date(inv.due_date) : null
    const isOverdue = inv.status === "overdue" || (due != null && due < today)
    const daysSince = (from: Date) => Math.max(0, Math.floor((today.getTime() - from.getTime()) / 86400000))
    if (isOverdue) return 10_000 + daysSince(due ?? sent)  // overdue always beats waiting
    return daysSince(sent)
  }

  const groups = Array.from(map.values())
  for (const group of groups) {
    group.invoices.sort((a: any, b: any) => urgency(b) - urgency(a))
  }

  return groups.sort((a, b) => b.totalCents - a.totalCents)
}
