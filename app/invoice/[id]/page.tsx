"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"
import DownloadPDFButton from "@/components/portal/DownloadPDFButton"
import { Suspense } from "react"

function InvoicePageInner({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [justPaid, setJustPaid] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [achDetails, setAchDetails] = useState<{ bankName: string; routingNumber: string; accountNumber: string; accountName: string } | null>(null)

  useEffect(() => {
    function checkViewport() {
      setIsMobile(window.innerWidth < 768)
    }

    checkViewport()
    window.addEventListener("resize", checkViewport)
    return () => window.removeEventListener("resize", checkViewport)
  }, [])

  useEffect(() => {
    // Check for Stripe success redirect (has session_id param)
    const url = new URL(window.location.href)
    if (url.searchParams.get("session_id")) {
      setJustPaid(true)
      // Clean URL without reloading
      url.searchParams.delete("session_id")
      url.searchParams.delete("paid")
      window.history.replaceState({}, "", url.pathname)
    }

    async function loadInvoice() {
      const { data } = await supabase
        .from("invoices")
        .select("*, clients(name, contact_name, contact_email), projects(title)")
        .eq("id", params.id)
        .single()

      setInvoice(data)
      setLoading(false)

      // Skip tracking + notification only if viewer is the logged-in admin.
      // Any other viewer (anonymous, or a logged-in client) gets tracked.
      if (data) {
        const { data: { session } } = await supabase.auth.getSession()
        const isAdmin = session?.user?.email === "kacie@studiocinq.com"
        if (!isAdmin) {
          fetch("/api/track-invoice-view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceIds: [params.id], isReturnView: !!data.viewed_at }),
          }).catch(() => {})
        }
      }
    }
    loadInvoice()
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
    setPaymentError(null)
    try {
      const res = await fetch("/api/invoice-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: params.id }),
      })
      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        setPaymentError(payload.error ?? "Card checkout is temporarily unavailable.")
        setSubmitting(false)
        return
      }

      if (payload.url) {
        window.location.href = payload.url
        return
      }

      setPaymentError("Card checkout is temporarily unavailable.")
    } catch {
      setPaymentError("Card checkout is temporarily unavailable.")
    }
    setSubmitting(false)
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
  // Venmo is opt-in per invoice (small one-off clients). Handle comes from a
  // public env var; when it's unset the whole block stays hidden.
  const venmoHandle = (process.env.NEXT_PUBLIC_VENMO_HANDLE ?? "").replace(/^@/, "")
  const hasVenmo = paymentMethods.includes("venmo") && venmoHandle.length > 0
  const hasAltMethod = hasACH || hasVenmo

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-grad)" }}>

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "0 20px" : "0 48px", height: "var(--nav-h)",
        borderBottom: "0.5px solid rgba(15,15,14,0.1)",
        background: "rgba(244,241,236,0.95)",
        backdropFilter: "blur(8px)",
      }}>
        <CinqLogo width={33} />
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
      <main style={{ maxWidth: 640, margin: "0 auto", padding: isMobile ? "32px 20px 56px" : "48px 32px 80px" }}>

        {/* Payment alert — prominent banner for urgent payment changes */}
        {invoice.payment_alert && !isPaid && (
          <div role="alert" style={{
            display: "flex", gap: 14, alignItems: "flex-start",
            marginBottom: 32, padding: isMobile ? "16px 18px" : "18px 22px",
            background: "rgba(201,90,59,0.07)",
            border: "1px solid rgba(201,90,59,0.4)",
            borderLeft: "3px solid var(--amber)",
          }}>
            <span aria-hidden="true" style={{
              fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600,
              color: "var(--amber)", lineHeight: 1.4, flexShrink: 0,
            }}>!</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: "var(--amber)", opacity: 0.95, marginBottom: 6, fontWeight: 600,
              }}>
                Important — please read
              </div>
              <div style={{
                fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                lineHeight: 1.6, color: "var(--ink)", opacity: 0.88,
                whiteSpace: "pre-wrap",
              }}>
                {invoice.payment_alert}
              </div>
            </div>
          </div>
        )}

        {/* On-completion banner — shown when invoice is draft + unlocks_files
            (i.e., created from a "100% on completion · unlocks files" flow).
            Keeps the pay-now option but explains the situation clearly. */}
        {invoice.status === "draft" && invoice.unlocks_files && !isPaid && (
          <div role="status" style={{
            display: "flex", gap: 14, alignItems: "flex-start",
            marginBottom: 32, padding: isMobile ? "16px 18px" : "18px 22px",
            background: "rgba(143,167,181,0.08)",
            border: "1px solid rgba(143,167,181,0.35)",
            borderLeft: "3px solid var(--sage)",
          }}>
            <span aria-hidden="true" style={{
              fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600,
              color: "var(--sage)", lineHeight: 1.4, flexShrink: 0,
            }}>✓</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: "var(--sage)", opacity: 0.95, marginBottom: 6, fontWeight: 600,
              }}>
                Quote approved · payment due on completion
              </div>
              <div style={{
                fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                lineHeight: 1.6, color: "var(--ink)", opacity: 0.85,
              }}>
                No action needed right now — we'll let you know when the project is ready.
                Final files unlock for download as soon as this is paid.
                {" "}
                <span style={{ opacity: 0.7, fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
                  (If you'd like to pay early, the option is below.)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ position: "relative" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.42, marginBottom: 10 }}>
            Invoice #{invoice.invoice_number}{project?.title ? ` · ${project.title}` : ""}
          </div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: isMobile ? 22 : 28, letterSpacing: "-0.015em", opacity: 0.9, margin: "0 0 32px", paddingRight: isPaid ? (isMobile ? 88 : 140) : 0 }}>
            {invoice.description}
          </h1>
          {isPaid && (
            <img
              src="/paid-stamp.png"
              alt="Paid"
              style={{
                position: "absolute",
                top: isMobile ? -2 : -10,
                right: isMobile ? 0 : -10,
                width: isMobile ? 76 : 120,
                height: isMobile ? 76 : 120,
                objectFit: "contain",
                opacity: 0.85,
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {/* Meta — a strict 2×2 so the columns share one rhythm: From / To,
             then Issued / Due. Project lives in the eyebrow above the title.
             The contact subline is dropped when it just repeats the client
             name (solo clients). */}
        {(() => {
          const metaCell = (row: { label: string; value: string; subline?: string }) => (
            <div key={row.label}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, marginBottom: 6 }}>{row.label}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.75 }}>{row.value}</div>
              {row.subline && (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.5, marginTop: 2 }}>{row.subline}</div>
              )}
            </div>
          )
          const clientName = client?.name ?? "—"
          const contact = client?.contact_name?.trim()
          const contactSub = contact && contact.toLowerCase() !== clientName.trim().toLowerCase() ? contact : undefined
          const issuedRaw = (invoice as any).last_sent_at ?? invoice.created_at
          const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
          return (
            <div style={{ marginBottom: 36, padding: "20px 0", borderTop: "0.5px solid rgba(15,15,14,0.1)", borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 24 }}>
                {metaCell({ label: "From", value: "Studio Cinq", subline: "Kacie Yates" })}
                {metaCell({ label: "To", value: clientName, subline: contactSub })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 24, marginTop: isMobile ? 16 : 22 }}>
                {metaCell({ label: "Issued", value: issuedRaw ? fmt(issuedRaw) : "—" })}
                {metaCell({ label: "Due", value: invoice.due_date ? fmt(invoice.due_date) : "Upon receipt" })}
              </div>
            </div>
          )
        })()}

        {/* Line items */}
        {lineItems.length > 0 ? (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 0 10px", borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4 }}>Description</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4 }}>Amount</span>
            </div>
            {lineItems.map((item: any, i: number) => (
              <div key={i} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", gap: isMobile ? 6 : 16, padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.75 }}>
                  {item.description}
                  {item.detail && (
                    <span style={{ display: "block", fontSize: "var(--text-sm)", opacity: 0.6, marginTop: 3, lineHeight: 1.5 }}>{item.detail}</span>
                  )}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.75, whiteSpace: "nowrap" }}>${(item.amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginBottom: 32, padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.75 }}>{invoice.description}</div>
          </div>
        )}

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28 }}>
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

        {/* Payment block. Fee-free methods (bank transfer / Venmo) lead when
             they're offered: their cards come first under "How to pay" and
             card checkout follows as a same-size OUTLINED button — clearly
             visible, just not the loudest thing. When card is the only
             method, it's the filled primary button as before. */}
        {(() => {
          const showACHCard = hasACH && !isPaid && Boolean(achDetails?.bankName)
          const showVenmoCard = hasVenmo && !isPaid
          const hasCards = showACHCard || showVenmoCard

          const buttonBase: React.CSSProperties = {
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.16em", textTransform: "uppercase",
            padding: "16px 32px",
            width: isMobile ? "100%" : undefined,
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.4 : 1, transition: "opacity 0.2s",
          }
          const cardButton = hasStripe && !isPaid ? (
            <button onClick={handlePay} disabled={submitting} style={hasCards
              ? { ...buttonBase, background: "transparent", color: "var(--ink)", border: "0.5px solid rgba(15,15,14,0.45)" }
              : { ...buttonBase, background: "var(--ink)", color: "var(--cream)", border: "none" }
            }>
              {submitting ? "Redirecting…" : hasCards ? "Pay with card" : "Pay invoice"}
            </button>
          ) : null
          const paidLine = isPaid ? (
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--sage)", opacity: 0.85,
              padding: "14px 0",
            }}>
              {justPaid ? "Payment received — thank you!" : `Paid${invoice.paid_at ? ` · ${new Date(invoice.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}`}
            </div>
          ) : null
          const actionRow = (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                {paidLine}
                {cardButton}
                <DownloadPDFButton type="invoice" id={params.id} label="↓ PDF" />
              </div>
              {paymentError && (
                <div role="alert" style={{ marginTop: 12, fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--amber)", opacity: 0.9, lineHeight: 1.6 }}>
                  {paymentError}
                </div>
              )}
            </>
          )

          // Paid, or card-only: just the action row under the total.
          if (!hasCards) return <div style={{ marginBottom: 40 }}>{actionRow}</div>

          const sideBySide = !isMobile && showACHCard && showVenmoCard
          // In a half-width column the label/value pair stacks so long bank
          // names don't collide with their labels.
          const stacked = isMobile || sideBySide
          const cardStyle: React.CSSProperties = { padding: "20px 24px", background: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(15,15,14,0.1)" }
          const cardTitle: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.55, marginBottom: 14 }
          const detailRow = (row: { label: string; value: string }) => (
            <div key={row.label} style={{ display: "flex", flexDirection: stacked ? "column" : "row", justifyContent: "space-between", alignItems: stacked ? "flex-start" : "center", gap: stacked ? 3 : 16, padding: "8px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.5 }}>{row.label}</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.85, wordBreak: "break-word" }}>{row.value}</span>
            </div>
          )
          return (
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.4, marginBottom: 12 }}>
                How to pay
              </div>
              <div style={{ display: "grid", gridTemplateColumns: sideBySide ? "1fr 1fr" : "1fr", gap: 16 }}>
                {showACHCard && (
                  <div style={cardStyle}>
                    <div style={cardTitle}>Bank transfer</div>
                    {[
                      { label: "Bank",           value: achDetails?.bankName ?? "" },
                      { label: "Account name",   value: achDetails?.accountName ?? "" },
                      { label: "Routing number", value: achDetails?.routingNumber ?? "" },
                      { label: "Account number", value: achDetails?.accountNumber ?? "" },
                      { label: "Reference",      value: `Invoice #${invoice.invoice_number}` },
                    ].map(detailRow)}
                  </div>
                )}
                {showVenmoCard && (
                  // Flex column so the button pins to the bottom and the two
                  // cards close on the same line when side by side.
                  <div style={{ ...cardStyle, display: "flex", flexDirection: "column" }}>
                    <div style={cardTitle}>Venmo</div>
                    {[
                      { label: "Handle",    value: `@${venmoHandle}` },
                      { label: "Amount",    value: `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
                      { label: "Reference", value: `Invoice #${invoice.invoice_number}` },
                    ].map(detailRow)}
                    <div style={{ marginTop: "auto", paddingTop: 14 }}>
                      <a
                        href={`https://venmo.com/u/${venmoHandle}`}
                        target="_blank" rel="noreferrer"
                        style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.6, textDecoration: "none", border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px" }}
                      >
                        Open in Venmo ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 20 }}>{actionRow}</div>
            </div>
          )
        })()}

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
