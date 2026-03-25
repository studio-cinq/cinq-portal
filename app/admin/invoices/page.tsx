import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import DeleteButton from "@/components/portal/DeleteButton"

export default async function AdminInvoicesPage() {
  const supabase = await createServerComponentClient()

  const { data: invoicesRaw } = await supabase
    .from("invoices")
    .select("*, clients(name)")
    .order("created_at", { ascending: false })

  const invoices = invoicesRaw as any[] | null

  const totalPaid       = invoices?.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0) ?? 0
  const totalOutstanding = invoices?.filter(i => ["sent","overdue"].includes(i.status)).reduce((s, i) => s + i.amount, 0) ?? 0
  const totalDraft      = invoices?.filter(i => i.status === "draft").length ?? 0

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }}>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5 }}>
            Invoices
          </div>
          <Link href="/admin/invoices/new" style={{
            fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
            color: "#0F0F0E", opacity: 0.6, textDecoration: "none",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
          }}>
            + New invoice
          </Link>
        </div>

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 40 }}>
          <SummaryCard label="Collected" value={`$${Math.round(totalPaid / 100).toLocaleString()}`} green />
          <SummaryCard label="Outstanding" value={`$${Math.round(totalOutstanding / 100).toLocaleString()}`} highlight={totalOutstanding > 0} />
          <SummaryCard label="Drafts" value={String(totalDraft)} />
        </div>

        {/* Header */}
        <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px 100px 80px 60px", gap: 16, paddingBottom: 10, borderBottom: "0.5px solid rgba(15,15,14,0.12)" }}>
          {["Invoice", "Client", "Amount", "Due", "Status", ""].map(h => (
            <div key={h} style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45 }}>{h}</div>
          ))}
        </div>

        {invoices?.map(inv => (
          <div className="admin-invoice-row" key={inv.id} style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px 120px 100px 80px 60px",
            gap: 16, alignItems: "center",
            padding: "16px 0",
            borderBottom: "0.5px solid rgba(15,15,14,0.08)",
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 300, opacity: 0.88 }}>{inv.description}</div>
              <div style={{ fontSize: 9, opacity: 0.45, marginTop: 2 }}>#{inv.invoice_number}</div>
            </div>
            <div className="admin-client-col-hide" style={{ fontSize: 11, opacity: 0.65 }}>{(inv.clients as any)?.name}</div>
            <div style={{ fontSize: 13, fontWeight: 300, opacity: 0.85 }}>${(inv.amount / 100).toLocaleString()}</div>
            <div style={{ fontSize: 10, opacity: 0.55 }}>
              {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
            </div>
            <InvoiceStatusBadge status={inv.status} />
            <DeleteButton endpoint="/api/admin/delete/invoice" id={inv.id} confirm={`Delete invoice #${inv.invoice_number}? This cannot be undone.`} />
          </div>
        ))}

        {(!invoices || invoices.length === 0) && (
          <div style={{ padding: "48px 0", fontSize: 12, opacity: 0.35, textAlign: "center" }}>
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
      <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.02em", color: green ? "#6B8F71" : highlight ? "#B07D3A" : "#0F0F0E", opacity: 0.88, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.45 }}>{label}</div>
    </div>
  )
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { paid: "#6B8F71", sent: "#B07D3A", overdue: "#c0392b", draft: "rgba(15,15,14,0.4)" }
  return (
    <span style={{ fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)" }}>
      {status}
    </span>
  )
}
