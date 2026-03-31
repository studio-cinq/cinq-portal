"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"
import DownloadPDFButton from "@/components/portal/DownloadPDFButton"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function InvoicePageInner({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [achDetails, setAchDetails] = useState<{ bankName: string; routingNumber: string; accountNumber: string; accountName: string } | null>(null)
  const searchParams = useSearchParams()
  const justPaid = searchParams.get("paid") === "true"

  useEffect(() => {
    supabase
      .from("invoices")
      .select("*, clients(name, contact_name, contact_email), projects(title)")
      .eq("id", params.id)
      .single()
      .then(({ data }) => {
        setInvoice(data)
        setLoading(false)

        // Track view
        if (data && !data.viewed_at) {
          fetch("/api/track-invoice-view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceIds: [params.id] }),
          }).catch(() => {})
        }
      })
  }, [params.id])

  useEffect(() => {
    if (!invoice) return
    const methods: string[] = invoice.payment_methods ?? ["stripe"]
    const isPaidCheck = invoice.status === "paid" || justPaid
    if (methods.includes("ach") && !isPaidCheck) {
      fetch("/api/ach-details").then(r => r.json()).then(setAchDetails).catch(() => {})
    }
  }, [invoice, justPaid])

  async function handlePay() {
    setSubmitting(true)
    const res = await fetch("/api/invoice-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: params.id }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    else setSubmitting(false)
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-grad)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>Loading…</div>
    </div>
  )

  if (!invoice) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-grad)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.5 }}>Invoice not found.</div>
    </div>
  )

  const client = invoice.clients as any
  const project = invoice.projects as any
  const amount = invoice.amount / 100
  const isPaid = invoice.status === "paid" || justPaid
  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : []
  const paymentMethods: string[] = invoice.payment_methods ?? ["stripe"]
  const hasStripe = paymentMethods.includes("stripe")
  const hasACH = paymentMethods.includes("ach")

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-grad)" }}>

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: "var(--nav-h)",
        borderBottom: "0.5px solid rgba(15,15,14,0.1)",
        background: "rgba(244,241,236,0.95)",
        backdropFilter: "blur(8px)",
      }}>
        <CinqLogo width={18} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {isPaid && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sage)", opacity: 0.85 }}>
              Paid
            </span>
          )}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.38 }}>
            {client?.name}
          </span>
        </div>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 32px 80px" }}>

        {/* Header */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.42, marginBottom: 10 }}>
          Invoice #{invoice.invoice_number}
        </div>
        <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 28, letterSpacing: "-0.015em", opacity: 0.9, margin: "0 0 32px" }}>
          {invoice.description}
        </h1>

        {/* Meta */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 36, padding: "20px 0", borderTop: "0.5px solid rgba(15,15,14,0.1)", borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
          {[
            { label: "From", value: "Studio Cinq" },
            { label: "To", value: client?.name ?? "—" },
            { label: "Project", value: project?.title ?? "—" },
            { label: "Due", value: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Upon receipt" },
          ].map(row => (
            <div key={row.label}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, marginBottom: 6 }}>{row.label}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.75 }}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* Line items */}
        {lineItems.length > 0 ? (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 0 10px", borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4 }}>Description</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4 }}>Amount</span>
            </div>
            {lineItems.map((item: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.75 }}>{item.description}</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.75 }}>${(item.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginBottom: 32, padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.75 }}>{invoice.description}</div>
          </div>
        )}

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5 }}>Total due</span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 28, letterSpacing: "-0.01em", opacity: 0.9 }}>
            ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ marginBottom: 36, padding: "16px 20px", background: "rgba(255,255,255,0.3)", border: "0.5px solid rgba(15,15,14,0.08)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, marginBottom: 8 }}>Notes</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.65, lineHeight: 1.7 }}>{invoice.notes}</div>
          </div>
        )}

        {/* ACH bank details */}
        {hasACH && !isPaid && achDetails && achDetails.bankName && (
          <div style={{ marginBottom: 36, padding: "16px 20px", background: "rgba(255,255,255,0.3)", border: "0.5px solid rgba(15,15,14,0.08)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, marginBottom: 12 }}>
              Bank transfer details
            </div>
            {[
              { label: "Bank",           value: achDetails.bankName },
              { label: "Account name",   value: achDetails.accountName },
              { label: "Routing number", value: achDetails.routingNumber },
              { label: "Account number", value: achDetails.accountNumber },
              { label: "Reference",      value: `Invoice #${invoice.invoice_number}` },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid rgba(15,15,14,0.05)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.4 }}>{row.label}</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.75 }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {isPaid ? (
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--sage)", opacity: 0.85,
              border: "0.5px solid rgba(107,143,113,0.3)", padding: "14px 28px",
            }}>
              {justPaid ? "Payment received — thank you!" : `Paid${invoice.paid_at ? ` · ${new Date(invoice.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}`}
            </div>
          ) : (
            <>
              {hasStripe && (
                <button onClick={handlePay} disabled={submitting} style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  background: "var(--ink)", color: "var(--cream)",
                  border: "none", padding: "16px 32px",
                  cursor: submitting ? "default" : "pointer",
                  opacity: submitting ? 0.4 : 1, transition: "opacity 0.2s",
                }}>
                  {submitting ? "Redirecting…" : hasACH ? "Pay with card" : "Pay invoice"}
                </button>
              )}
              {hasACH && !hasStripe && (
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                  letterSpacing: "0.1em", opacity: 0.5, lineHeight: 1.6,
                }}>
                  Please complete payment via bank transfer using the details above.
                </div>
              )}
              {hasACH && hasStripe && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.06em", opacity: 0.4 }}>
                  or pay via bank transfer above
                </span>
              )}
            </>
          )}
          <DownloadPDFButton type="invoice" id={params.id} label="↓ PDF" />
        </div>

        {/* Footer */}
        <div style={{ marginTop: 64, paddingTop: 20, borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.25 }}>
            Studio Cinq · portal.studiocinq.com
          </div>
        </div>
      </main>
    </div>
  )
}

export default function PublicInvoicePage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <InvoicePageInner params={params} />
    </Suspense>
  )
}
