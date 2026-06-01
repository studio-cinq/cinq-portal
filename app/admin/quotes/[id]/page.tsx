import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import { notFound } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import CopyLinkButton from "@/components/portal/CopyLinkButton"
import ResendQuoteButton from "@/components/portal/ResendQuoteButton"
import DeleteButton from "@/components/portal/DeleteButton"

const mono = { fontFamily: "var(--font-mono)" } as const
const sans = { fontFamily: "var(--font-sans)" } as const
const serif = { fontFamily: "var(--font-serif)" } as const

function fmt$(c: number) { return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}` }
function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function AdminQuoteDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerComponentClient()

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, clients(name, contact_name, contact_email), invoices(id, invoice_number)")
    .eq("id", params.id)
    .single()

  if (!quote) return notFound()

  const { data: itemsRaw } = await supabase.from("quote_items").select("*").eq("quote_id", params.id).order("sort_order")
  const items = itemsRaw ?? []
  const total = items.reduce((s, i: any) => s + (i.price ?? 0), 0)

  const client = (quote as any).clients
  const invoice = (quote as any).invoices
  const schedule = Array.isArray((quote as any).payment_schedule) ? (quote as any).payment_schedule : [100]
  const scheduleLabel = schedule[0] === 100 ? "100% on approval"
    : schedule[0] === 0 ? "100% on completion · unlocks files"
    : schedule.map((p: number, i: number) =>
        i === 0 ? `${p}% deposit` :
        i === schedule.length - 1 ? `${p}% completion` :
        `${p}% midpoint`
      ).join(" · ")

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 720, margin: "0 auto", padding: "40px 48px 80px" }}>

        <Link href="/admin/quotes" style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 24 }}>
          ← Quotes
        </Link>

        {/* Header strip */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 10 }}>
            Quote · <span style={{ color: statusColor((quote as any).status) }}>{(quote as any).status}</span>
          </div>
          <h1 style={{ ...sans, fontWeight: 400, fontSize: 30, letterSpacing: "-0.02em", margin: "0 0 14px", opacity: 0.95, lineHeight: 1.15 }}>
            {(quote as any).title}
          </h1>
          {(quote as any).description && (
            <div style={{ ...serif, fontStyle: "italic", fontSize: 15, opacity: 0.6, lineHeight: 1.55, marginBottom: 14, maxWidth: 580 }}>
              {(quote as any).description}
            </div>
          )}
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", opacity: 0.5 }}>
            {client?.name} · {client?.contact_name} <span style={{ opacity: 0.5 }}>· {client?.contact_email}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginBottom: 36, flexWrap: "wrap", alignItems: "center" }}>
          <Link href={`/admin/quotes/${params.id}/edit`} style={btn}>Edit</Link>
          {(quote as any).status !== "accepted" && <ResendQuoteButton quoteId={params.id} />}
          <CopyLinkButton id={params.id} basePath="/quotes" />
          <span style={{ flex: 1 }} />
          <DeleteButton
            endpoint="/api/admin/delete/quote"
            id={params.id}
            label="Delete quote"
            redirectTo="/admin/quotes"
            confirm={
              (quote as any).invoice_id
                ? `Delete "${(quote as any).title}"? This will also delete the linked invoice. Cannot be undone.`
                : `Delete "${(quote as any).title}"? This cannot be undone.`
            }
          />
        </div>

        {/* Items */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, marginBottom: 12 }}>Line items</div>
          <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
            {items.map((it: any) => (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)" }}>
                <span style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.88 }}>{it.name}</span>
                <span style={{ ...mono, fontSize: "var(--text-body)", opacity: 0.7 }}>{fmt$(it.price)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "16px 0 0" }}>
              <span style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5 }}>Total</span>
              <span style={{ ...sans, fontSize: 22, letterSpacing: "-0.01em", opacity: 0.92 }}>{fmt$(total)}</span>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, paddingTop: 22, borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
          <MetaRow label="Payment" value={scheduleLabel} />
          <MetaRow label="Expires" value={fmtDate((quote as any).expires_at)} />
          <MetaRow label="Sent" value={fmtDate((quote as any).last_sent_at)} />
          <MetaRow label="First viewed" value={fmtDate((quote as any).viewed_at)} />
          {(quote as any).status === "accepted" && invoice && (
            <MetaRow
              label="Invoice"
              value={
                <Link href={`/admin/invoices/${invoice.id}/edit`} style={{ textDecoration: "underline", color: "inherit" }}>
                  #{invoice.invoice_number}
                </Link> as any
              }
            />
          )}
          {(quote as any).accepted_note && (
            <div style={{ gridColumn: "1 / -1", paddingTop: 14 }}>
              <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, marginBottom: 6 }}>Client note</div>
              <div style={{ ...serif, fontStyle: "italic", fontSize: 15, opacity: 0.78, lineHeight: 1.6 }}>
                "{(quote as any).accepted_note}"
              </div>
            </div>
          )}
        </div>

      </main>
    </>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, marginBottom: 4 }}>{label}</div>
      <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.85 }}>{value}</div>
    </div>
  )
}

const btn: React.CSSProperties = {
  ...mono,
  fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
  color: "var(--ink)", opacity: 0.6, textDecoration: "none",
  border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
}

function statusColor(s: string) {
  return ({ draft: "rgba(15,15,14,0.5)", sent: "var(--amber)", accepted: "var(--sage)", declined: "var(--danger)", expired: "rgba(15,15,14,0.4)" } as Record<string, string>)[s] ?? "var(--ink)"
}
