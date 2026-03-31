import { createServerComponentClient } from "@/lib/supabase-server"
import PortalNav from "@/components/portal/Nav"
import PayInvoiceButton from "@/components/portal/PayInvoiceButton"
import DownloadPDFButton from "@/components/portal/DownloadPDFButton"
import InvoiceViewTracker from "@/components/portal/InvoiceViewTracker"

export default async function InvoicesPage() {
  const supabase = await createServerComponentClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: client } = await supabase
    .from("clients").select("*")
    .eq("contact_email", user?.email ?? "").single()

  const { data: invoices } = await supabase
    .from("invoices").select("*, projects(title)")
    .eq("client_id", client?.id ?? "")
    .order("created_at", { ascending: false })

  const paid     = invoices?.filter(i => i.status === "paid")                        ?? []
  const due      = invoices?.filter(i => ["sent","overdue"].includes(i.status))       ?? []
  const upcoming = invoices?.filter(i => i.status === "draft")                        ?? []

  const totalPaid     = paid.reduce((s, i) => s + i.amount, 0)
  const totalDue      = due.reduce((s, i) => s + i.amount, 0)
  const totalContract = (invoices ?? []).reduce((s, i) => s + i.amount, 0)
  const paidPct       = totalContract > 0 ? Math.round((totalPaid / totalContract) * 100) : 0

  return (
    <>
      <PortalNav clientName={client?.name} />
      <InvoiceViewTracker invoiceIds={(invoices ?? []).filter(i => ["sent", "overdue"].includes(i.status)).map(i => i.id)} />

      <main className="layout-grid" style={{
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        maxWidth: 1100,
        margin: "0 auto",
        minHeight: "calc(100vh - 64px)",
      }}>

        {/* Left */}
        <div className="layout-left" style={{ padding: "40px 40px 64px 48px", borderRight: "0.5px solid rgba(15,15,14,0.08)" }}>

          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.18em", textTransform: "uppercase",
            opacity: 0.5, marginBottom: 8,
          }}>&bull; Invoices</div>

          <div style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-title)",
            letterSpacing: "-0.01em",
            opacity: "var(--op-full)" as any,
            marginBottom: 36,
          }}>
            {client?.name}
          </div>

          {due.length > 0 && (
            <>
              <div style={sectionLabel}>Due now</div>
              {due.map(inv => <InvoiceCard key={inv.id} inv={inv} variant="due" />)}
            </>
          )}

          {paid.length > 0 && (
            <>
              <div style={{ ...sectionLabel, marginTop: due.length > 0 ? 32 : 0 }}>Paid</div>
              {paid.map(inv => <InvoiceCard key={inv.id} inv={inv} variant="paid" />)}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <div style={{ ...sectionLabel, marginTop: 32 }}>Upcoming</div>
              {upcoming.map(inv => <InvoiceCard key={inv.id} inv={inv} variant="locked" />)}
            </>
          )}

          {due.length === 0 && paid.length === 0 && upcoming.length === 0 && (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, color: "var(--ink)", opacity: 0.5, letterSpacing: "-0.01em", marginBottom: 8 }}>
                No invoices yet.
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--ink)", opacity: 0.4, lineHeight: 1.7 }}>
                Invoices will appear here as your project progresses.
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="layout-sidebar" style={{ padding: "40px 28px" }}>

          <div style={sidebarLabel}>Payment summary</div>
          <div style={{ marginBottom: 28 }}>
            <SummaryRow label="Paid"     value={`$${(totalPaid / 100).toLocaleString()}`}     color="var(--sage)" />
            {totalDue > 0 && <SummaryRow label="Due now" value={`$${(totalDue / 100).toLocaleString()}`} color="var(--amber)" />}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 0" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.32 }}>Total</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 20, letterSpacing: "-0.02em", opacity: "var(--op-full)" as any }}>
                ${(totalContract / 100).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ height: 2, background: "rgba(15,15,14,0.08)", borderRadius: 2, marginBottom: 8 }}>
              <div style={{ height: 2, width: `${paidPct}%`, background: "var(--sage)", borderRadius: 2, opacity: 0.7 }} />
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", color: "var(--ink)", opacity: 0.5, letterSpacing: "0.04em" }}>
              ${(totalPaid / 100).toLocaleString()} of ${(totalContract / 100).toLocaleString()} &nbsp;&middot;&nbsp; {paidPct}%
            </div>
          </div>

          {upcoming.some(i => i.unlocks_files) && (
            <>
              <div style={sidebarLabel}>On final payment</div>
              <div style={{ border: "0.5px solid rgba(15,15,14,0.1)", padding: 18, background: "rgba(255,255,255,0.2)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 10 }}>
                  Files unlocked
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", opacity: "var(--op-muted)" as any, lineHeight: 1.6 }}>
                  Your brand library and all final deliverable files unlock automatically once the final invoice is paid.
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  )
}

function InvoiceCard({ inv, variant }: { inv: any; variant: "paid" | "due" | "locked" }) {
  const fmt = (n: number) => `$${(n / 100).toLocaleString()}`

  return (
    <div style={{
      border: "0.5px solid rgba(15,15,14,0.1)",
      background: variant === "due" ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)",
      padding: "24px 28px", marginBottom: 12,
      opacity: variant === "locked" ? 0.45 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: Array.isArray(inv.line_items) && inv.line_items.length > 0 ? 8 : 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 6 }}>
            {inv.invoice_number}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-lg)", opacity: "var(--op-full)" as any, letterSpacing: "-0.01em", marginBottom: 3 }}>
            {inv.description}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any, letterSpacing: "0.04em" }}>
            {variant === "paid" && inv.paid_at
              ? `Paid ${new Date(inv.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : variant === "due" && inv.due_date
              ? `Due ${new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : "Due on delivery"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-lg)", opacity: "var(--op-full)" as any }}>
            {fmt(inv.amount)}
          </div>
          <StatusBadge variant={variant} dueDate={inv.due_date} />
        </div>
      </div>

      {/* Line items breakdown */}
      {Array.isArray(inv.line_items) && inv.line_items.length > 0 && (
        <div style={{ marginBottom: 12, padding: "10px 0", borderTop: "0.5px solid rgba(15,15,14,0.07)" }}>
          {inv.line_items.map((item: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.55 }}>
              <span>{item.description}</span>
              <span>${(item.amount / 100).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {variant === "due" && (() => {
        const methods: string[] = inv.payment_methods ?? ["stripe"]
        const showStripe = methods.includes("stripe")
        const showACH = methods.includes("ach")
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 14, borderTop: "0.5px solid rgba(15,15,14,0.07)" }}>
            <DownloadPDFButton type="invoice" id={inv.id} label="↓ Invoice PDF" />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {showACH && (
                <a href={`/invoice/${inv.id}`} style={{
                  fontFamily: "var(--font-mono)", fontSize: 9,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "var(--ink)", opacity: 0.5, textDecoration: "none",
                  border: "0.5px solid rgba(15,15,14,0.18)", padding: "6px 12px",
                  whiteSpace: "nowrap",
                }}>
                  Bank transfer
                </a>
              )}
              {showStripe && (
                <PayInvoiceButton invoiceId={inv.id} amount={inv.amount} label={showACH ? "Pay with card" : undefined} />
              )}
            </div>
          </div>
        )
      })()}

      {variant === "paid" && (
        <div style={{ paddingTop: 12, borderTop: "0.5px solid rgba(15,15,14,0.07)" }}>
          <DownloadPDFButton type="invoice" id={inv.id} label="↓ Download receipt" />
        </div>
      )}

      {variant === "locked" && (
        <div style={{ paddingTop: 14, borderTop: "0.5px solid rgba(15,15,14,0.07)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.32, letterSpacing: "0.04em" }}>
            {inv.unlocks_files ? "Final files unlock automatically when this invoice is paid." : "Not yet due."}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ variant, dueDate }: { variant: string; dueDate?: string }) {
  const configs: Record<string, { color: string; label: string; border: string }> = {
    paid:   { color: "var(--sage)",  label: "Paid",  border: "rgba(143,167,181,0.4)" },
    due:    { color: "var(--amber)", label: dueDate ? `Due ${new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Due", border: "rgba(201,90,59,0.4)" },
    locked: { color: "rgba(15,15,14,0.4)", label: "Not yet due", border: "rgba(15,15,14,0.15)" },
  }
  const c = configs[variant]
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", border: `0.5px solid ${c.border}`, color: c.color }}>
        {c.label}
      </span>
    </div>
  )
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any }}>{label}</span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-eyebrow)", color: color ?? "var(--ink)", opacity: color ? 0.85 : 0.65 }}>{value}</span>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)" as any,
  letterSpacing: "0.16em", textTransform: "uppercase",
  color: "var(--ink)", opacity: 0.5, marginBottom: 14,
}

const sidebarLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)" as any,
  letterSpacing: "0.16em", textTransform: "uppercase",
  color: "var(--ink)", opacity: 0.5, marginBottom: 14,
}