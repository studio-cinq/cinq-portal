"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"
import DownloadPDFButton from "@/components/portal/DownloadPDFButton"
import { Suspense } from "react"
import QRCode from "qrcode"

function InvoicePageInner({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [justPaid, setJustPaid] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [achDetails, setAchDetails] = useState<{ bankName: string; routingNumber: string; accountNumber: string; accountName: string } | null>(null)
  // Which copy affordance just fired ("bank" details / Venmo "amount"); resets after 2s.
  const [copied, setCopied] = useState<"bank" | "check" | null>(null)
  // Selected payment tab. null = "first available", resolved at render so a
  // method that isn't offered on this invoice can never be selected.
  const [activeMethod, setActiveMethod] = useState<"ach" | "venmo" | "check" | "card" | null>(null)
  // Venmo QR (data URL) generated client-side from the deep link.
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

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

  // Venmo QR — encodes a venmo:// deep link with recipient, amount and note
  // prefilled, so a phone scan opens the app ready to pay. Drawn from the
  // same handle the "Open in Venmo" button uses, so the two can't drift.
  useEffect(() => {
    if (!invoice) return
    const methods: string[] = invoice.payment_methods ?? ["stripe"]
    const handle = (process.env.NEXT_PUBLIC_VENMO_HANDLE ?? "").replace(/^@/, "")
    const paid = invoice.status === "paid" || justPaid
    if (!methods.includes("venmo") || !handle || paid) { setQrDataUrl(null); return }
    const dollars = (invoice.amount / 100).toFixed(2)
    const note = encodeURIComponent(`Invoice ${invoice.invoice_number}`)
    const deepLink = `venmo://paycharge?txn=pay&recipients=${handle}&amount=${dollars}&note=${note}`
    QRCode.toDataURL(deepLink, { margin: 0, width: 176, color: { dark: "#1A1815", light: "#00000000" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [invoice, justPaid])

  // Clipboard copy with a 2s "Copied" confirmation on the triggering control.
  function copyText(key: "bank" | "check", text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(c => (c === key ? null : c)), 2000)
    }).catch(() => {})
  }

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
  // Check is opt-in per invoice too. Payable-to + mailing address come from
  // public env vars; the card stays hidden until both are set.
  const checkPayableTo = (process.env.NEXT_PUBLIC_CHECK_PAYABLE_TO ?? "").trim()
  const checkAddress   = (process.env.NEXT_PUBLIC_CHECK_MAILING_ADDRESS ?? "").trim()
  const hasCheck = paymentMethods.includes("check") && checkPayableTo.length > 0 && checkAddress.length > 0

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

        {/* Payment block — tabbed. Every offered method is visible at once in
             a segmented row (ACH → Venmo → Check → Card, first one selected by
             default); the selected method's details sit in a single panel
             below. No fee tags — Kacie doesn't want to steer how clients pay.
             Which tabs show is driven by the invoice's payment_methods
             (+ env gates, see hasACH/hasVenmo/hasCheck). */}
        {(() => {
          type Method = "ach" | "venmo" | "check" | "card"
          const available: Method[] = []
          if (hasACH && !isPaid && Boolean(achDetails?.bankName)) available.push("ach")
          if (hasVenmo && !isPaid) available.push("venmo")
          if (hasCheck && !isPaid) available.push("check")
          if (hasStripe && !isPaid) available.push("card")

          const errorLine = paymentError ? (
            <div role="alert" style={{ marginTop: 12, fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--amber)", opacity: 0.9, lineHeight: 1.6 }}>
              {paymentError}
            </div>
          ) : null

          if (isPaid) {
            return (
              <div style={{ marginBottom: 40 }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "var(--sage)", opacity: 0.85, padding: "14px 0",
                }}>
                  {justPaid ? "Payment received — thank you!" : `Paid${invoice.paid_at ? ` · ${new Date(invoice.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}`}
                </div>
              </div>
            )
          }
          if (available.length === 0) return null

          const current: Method = activeMethod && available.includes(activeMethod) ? activeMethod : available[0]
          const labels: Record<Method, string> = { ach: "ACH", venmo: "Venmo", check: "Check", card: "Card" }

          const eyebrow: React.CSSProperties = {
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.14em", textTransform: "uppercase",
          }
          const rowLabel: React.CSSProperties = { ...eyebrow, display: "block", fontSize: 10, letterSpacing: "0.12em", opacity: 0.5, marginBottom: 4 }
          const rowStyle = (last: boolean): React.CSSProperties => ({
            padding: "9px 0", borderBottom: last ? "none" : "0.5px solid rgba(15,15,14,0.08)",
            fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.85,
            wordBreak: "break-word",
          })
          const noteStyle: React.CSSProperties = { ...rowStyle(true), fontSize: "var(--text-sm)", opacity: 0.55, lineHeight: 1.55 }
          // Panel is a horizontal band on desktop: rows left, button pinned
          // bottom-right. Stacks with a full-width button on mobile.
          const btn: React.CSSProperties = {
            ...eyebrow, display: "block", textAlign: "center", textDecoration: "none", lineHeight: "normal",
            width: isMobile ? "100%" : 220, marginTop: isMobile ? 22 : 0, alignSelf: isMobile ? undefined : "flex-end",
            padding: 14, border: "0.5px solid var(--ink)", background: "transparent", color: "var(--ink)",
            cursor: "pointer", flexShrink: 0, boxSizing: "border-box",
          }
          const solid: React.CSSProperties = { ...btn, background: "var(--ink)", color: "var(--cream)" }

          const bankRows = [
            { label: "Bank",         value: achDetails?.bankName ?? "" },
            { label: "Account name", value: achDetails?.accountName ?? "" },
            { label: "Routing",      value: achDetails?.routingNumber ?? "" },
            { label: "Account",      value: achDetails?.accountNumber ?? "" },
          ]
          const reference = `Invoice #${invoice.invoice_number}`
          const bankText = [...bankRows.map(r => `${r.label}: ${r.value}`), `Reference: ${reference}`].join("\n")
          const checkText = `Payable to: ${checkPayableTo}\nMail to: ${checkAddress}\nReference: ${reference}`

          const panels: Record<Method, { rows: React.ReactNode; button: React.ReactNode }> = {
            ach: {
              rows: bankRows.map((r, i) => (
                <div key={r.label} style={rowStyle(i === bankRows.length - 1)}>
                  <small style={rowLabel}>{r.label}</small>{r.value}
                </div>
              )),
              button: (
                <button type="button" onClick={() => copyText("bank", bankText)} style={btn}>
                  {copied === "bank" ? "Copied" : "Copy details"}
                </button>
              ),
            },
            venmo: {
              rows: (
                <>
                  <div style={rowStyle(false)}><small style={rowLabel}>Handle</small>@{venmoHandle}</div>
                  {/* QR encodes a venmo:// deep link with recipient, amount and
                       note prefilled (verified on Kacie's phone). */}
                  <div style={{ ...rowStyle(true), padding: "16px 0 9px" }}>
                    <img
                      src={qrDataUrl ?? "/venmo-qr.png"}
                      width={88} height={88}
                      alt={`Venmo QR code — pay @${venmoHandle}`}
                      style={{ display: "block", width: 88, height: 88, imageRendering: "pixelated" }}
                    />
                  </div>
                </>
              ),
              button: (
                <a href={`https://venmo.com/u/${venmoHandle}`} target="_blank" rel="noreferrer" style={btn}>
                  Open in Venmo
                </a>
              ),
            },
            check: {
              rows: (
                <>
                  <div style={rowStyle(false)}><small style={rowLabel}>Payable to</small>{checkPayableTo}</div>
                  <div style={rowStyle(false)}><small style={rowLabel}>Mail to</small>{checkAddress}</div>
                  <div style={noteStyle}>Please allow 5–7 days for mailed payments to post.</div>
                </>
              ),
              button: (
                <button type="button" onClick={() => copyText("check", checkText)} style={btn}>
                  {copied === "check" ? "Copied" : "Copy details"}
                </button>
              ),
            },
            card: {
              rows: (
                <>
                  <div style={rowStyle(false)}><small style={rowLabel}>Accepted</small>Visa, Mastercard, Amex</div>
                  <div style={noteStyle}>Secure checkout through Stripe. Receipt emailed on payment.</div>
                </>
              ),
              button: (
                <button type="button" onClick={handlePay} disabled={submitting} style={{ ...solid, opacity: submitting ? 0.4 : 1, cursor: submitting ? "default" : "pointer" }}>
                  {submitting ? "Redirecting…" : "Pay with card"}
                </button>
              ),
            },
          }

          return (
            <div style={{ marginBottom: 36 }}>
              <span style={{ ...eyebrow, opacity: 0.4 }}>How to pay</span>

              {/* Tab row — hidden when there's only one way to pay. */}
              {available.length > 1 && (
                <div role="tablist" aria-label="Payment method" style={{ display: "flex", gap: 24, marginTop: 14, borderBottom: "0.5px solid rgba(15,15,14,0.12)" }}>
                  {available.map(m => {
                    const on = m === current
                    return (
                      <button
                        key={m} type="button" role="tab" aria-selected={on}
                        onClick={() => setActiveMethod(m)}
                        style={{
                          ...eyebrow, background: "none", border: "none", padding: "10px 0 12px", cursor: on ? "default" : "pointer",
                          color: "var(--ink)", opacity: on ? 0.9 : 0.4, whiteSpace: "nowrap",
                          marginBottom: -0.5, borderBottom: on ? "1px solid var(--ink)" : "1px solid transparent",
                        }}
                      >
                        {labels[m]}
                      </button>
                    )
                  })}
                </div>
              )}

              <div
                role="tabpanel"
                style={{
                  marginTop: available.length > 1 ? 16 : 14,
                  background: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(15,15,14,0.1)",
                  padding: "20px 22px 22px",
                  display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-start", gap: isMobile ? 0 : 40,
                  minWidth: 0,
                }}
              >
                {available.length === 1 && (
                  <span style={{ ...eyebrow, color: "var(--ink)", opacity: 0.85, flexShrink: 0, paddingTop: 9 }}>{labels[current]}</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>{panels[current].rows}</div>
                {panels[current].button}
              </div>
              {errorLine}
            </div>
          )
        })()}

        {/* Footer — portal link left, PDF download right */}
        <div style={{ marginTop: 64, paddingTop: 22, borderTop: "0.5px solid rgba(15,15,14,0.08)", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.25 }}>
            Studio Cinq · portal.studiocinq.com
          </div>
          <DownloadPDFButton type="invoice" id={params.id} label="↓ Download PDF" variant="link" />
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
