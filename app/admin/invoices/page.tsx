import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import DeleteButton from "@/components/portal/DeleteButton"
import MarkPaidButton from "@/components/portal/MarkPaidButton"
import DownloadPDFButton from "@/components/portal/DownloadPDFButton"

export default async function AdminInvoicesPage() {
  const supabase = await createServerComponentClient()

  const { data: invoicesRaw } = await supabase
    .from("invoices").select("*, clients(name)")
    .order("created_at", { ascending: false })
  const invoices = invoicesRaw as any[] | null

  const totalPaid        = invoices?.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0) ?? 0
  const totalOutstanding = invoices?.filter(i => ["sent","overdue"].includes(i.status)).reduce((s, i) => s + i.amount, 0) ?? 0
  const totalDraft       = invoices?.filter(i => i.status === "draft").length ?? 0

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }}>
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

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 40 }}>
          <SummaryCard label="Collected"   value={`$${Math.round(totalPaid / 100).toLocaleString()}`}        green />
          <SummaryCard label="Outstanding" value={`$${Math.round(totalOutstanding / 100).toLocaleString()}`} highlight={totalOutstanding > 0} />
          <SummaryCard label="Drafts"      value={String(totalDraft)} />
        </div>

        <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px 100px 80px 80px 50px 50px 60px", gap: 16, paddingBottom: 10, borderBottom: "0.5px solid rgba(15,15,14,0.12)" }}>
          {["Invoice", "Client", "Amount", "Due", "Status", "", "", "", ""].map((h, i) => (
            <div key={`${h}-${i}`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45 }}>{h}</div>
          ))}
        </div>

        {invoices?.map(inv => (
          <div className="admin-invoice-row" key={inv.id} style={{
            display: "grid", gridTemplateColumns: "1fr 140px 120px 100px 80px 80px 50px 50px 60px",
            gap: 16, alignItems: "center", padding: "16px 0",
            borderBottom: "0.5px solid rgba(15,15,14,0.08)",
          }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-full)" as any }}>{inv.description}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any, marginTop: 2 }}>#{inv.invoice_number}</div>
            </div>
            <div className="admin-client-col-hide" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-muted)" as any }}>{(inv.clients as any)?.name}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-full)" as any }}>${(inv.amount / 100).toLocaleString()}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any }}>
              {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
            </div>
            <InvoiceStatusBadge status={inv.status} />
            <div>
              {["sent", "overdue"].includes(inv.status) && (
                <MarkPaidButton invoiceId={inv.id} invoiceNumber={inv.invoice_number} />
              )}
            </div>
            <DownloadPDFButton type="invoice" id={inv.id} label="PDF" />
            <Link href={`/admin/invoices/${inv.id}/edit`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.35, textDecoration: "none" }}>
              Edit
            </Link>
            <DeleteButton endpoint="/api/admin/delete/invoice" id={inv.id} confirm={`Delete invoice #${inv.invoice_number}? This cannot be undone.`} />
          </div>
        ))}

        {(!invoices || invoices.length === 0) && (
          <div style={{ padding: "48px 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-ghost)" as any, textAlign: "center" }}>
            No invoices yet.
          </div>
        )}
      </main>
    </>
  )
}

function SummaryCard({ label, value, green, highlight }: { label: string; value: string; green?: boolean; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? "rgba(176,125,58,0.06)" : "rgba(255,255,255,0.35)",
      border: `0.5px solid rgba(15,15,14,${highlight ? 0.15 : 0.1})`,
      padding: "16px 20px",
    }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 22, letterSpacing: "-0.02em", color: green ? "var(--sage)" : highlight ? "var(--amber)" : "var(--ink)", opacity: "var(--op-full)" as any, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.45 }}>{label}</div>
    </div>
  )
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { paid: "var(--sage)", sent: "var(--amber)", overdue: "var(--danger)", draft: "rgba(15,15,14,0.4)" }
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)" }}>
      {status}
    </span>
  )
}