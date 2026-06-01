"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"

const mono = { fontFamily: "var(--font-mono)" } as const
const sans = { fontFamily: "var(--font-sans)" } as const
const serif = { fontFamily: "var(--font-serif)" } as const

export default function ClientQuotePage({ params }: { params: { id: string } }) {
  const [quote, setQuote] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 760) }
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: q } = await supabase
        .from("quotes")
        .select("*, clients(name, contact_name)")
        .eq("id", params.id).single()

      if (!q) { setLoading(false); return }
      setQuote(q)

      const { data: its } = await supabase
        .from("quote_items").select("*")
        .eq("quote_id", params.id).order("sort_order")
      setItems(its ?? [])
      setLoading(false)

      // Track view unless admin
      const { data: { session } } = await supabase.auth.getSession()
      const isAdmin = session?.user?.email === "kacie@studiocinq.com"
      if (!isAdmin) {
        const isFirstView = !(q as any).viewed_at
        const now = new Date().toISOString()
        await supabase.from("quotes").update({
          ...(isFirstView ? { viewed_at: now } : {}),
          last_viewed_at: now,
        } as any).eq("id", params.id)
      }
    }
    load()
  }, [params.id])

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>
        Loading…
      </div>
    )
  }

  if (!quote) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
        <div style={{ ...serif, fontStyle: "italic", fontSize: 18, opacity: 0.6 }}>This quote isn't available.</div>
        <div style={{ ...mono, fontSize: "var(--text-eyebrow)", opacity: 0.4 }}>Please check the link, or reach out to Kacie.</div>
      </div>
    )
  }

  const total = items.reduce((s, i) => s + (i.price ?? 0), 0)
  const schedule = Array.isArray(quote.payment_schedule) ? quote.payment_schedule : [100]
  const depositPct = schedule[0] ?? 100
  const isCompletionOnly = schedule.length === 2 && schedule[0] === 0
  const deposit = isCompletionOnly ? 0 : Math.round(total * (depositPct / 100))

  const isAccepted = quote.status === "accepted"
  const isExpired = quote.expires_at && new Date(quote.expires_at) < new Date()
  const canInteract = !isAccepted && !isExpired && quote.status === "sent"

  async function handleApprove() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/quote-accept", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: params.id, note: note || null }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error ?? "Could not accept quote")
      }
      const { invoiceUrl } = await res.json()
      if (invoiceUrl) window.location.href = invoiceUrl
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.")
      setSubmitting(false)
    }
  }

  const scheduleLine = (() => {
    if (isCompletionOnly) return "100% due on completion · final files unlock when paid"
    if (depositPct === 100) return "100% due on approval"
    return `${depositPct}% deposit now, then ${schedule.slice(1).map((p: number, i: number) => `${p}% at ${i === schedule.length - 2 ? "completion" : "midpoint"}`).join(" · ")}`
  })()

  const approveButtonLabel = isCompletionOnly
    ? "Approve quote"
    : depositPct === 100
      ? "Approve & pay"
      : "Approve & pay deposit"

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
        <span style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.38 }}>
          {quote.clients?.name}
        </span>
      </nav>

      <main style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 360px",
        maxWidth: 980, margin: "0 auto",
        padding: isMobile ? "32px 0 56px" : "56px 0 80px",
      }}>

        {/* Content */}
        <div style={{ padding: isMobile ? "0 20px" : "0 40px" }}>
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.42, marginBottom: 10 }}>
            Quote
          </div>
          <h1 style={{ ...sans, fontWeight: 400, fontSize: isMobile ? 26 : 32, letterSpacing: "-0.02em", margin: "0 0 18px", opacity: 0.95, lineHeight: 1.15 }}>
            {quote.title}
          </h1>
          {quote.description && (
            <div style={{ ...serif, fontStyle: "italic", fontSize: 16, opacity: 0.65, lineHeight: 1.6, maxWidth: 560, marginBottom: 28 }}>
              {quote.description}
            </div>
          )}

          {isExpired && !isAccepted && (
            <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", color: "var(--danger)", opacity: 0.8, marginBottom: 24 }}>
              This quote has expired. Reach out and we'll send a fresh one.
            </div>
          )}

          {isAccepted && (
            <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", color: "var(--sage)", opacity: 0.9, marginBottom: 24 }}>
              Approved {quote.accepted_at ? "· " + new Date(quote.accepted_at).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : ""}
            </div>
          )}

          {/* Line items */}
          <div style={{ marginTop: 8 }}>
            <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, paddingBottom: 8, borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
              Included
            </div>
            {items.map(item => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
                <span style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.88 }}>{item.name}</span>
                <span style={{ ...mono, fontSize: "var(--text-body)", opacity: 0.7 }}>
                  ${(item.price / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing panel */}
        <div style={{
          padding: isMobile ? "32px 24px" : "0 40px 0 32px",
          marginTop: isMobile ? 32 : 0,
          borderTop: isMobile ? "0.5px solid rgba(15,15,14,0.1)" : "none",
          borderLeft: isMobile ? "none" : "0.5px solid rgba(15,15,14,0.08)",
        }}>
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.42, marginBottom: 20 }}>
            Summary
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}>Total</span>
            <span style={{ ...serif, fontSize: 26, opacity: 0.88, letterSpacing: "-0.01em" }}>
              ${(total / 100).toLocaleString()}
            </span>
          </div>

          {!isCompletionOnly && depositPct !== 100 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
              <span style={{ ...mono, fontSize: "var(--text-eyebrow)", opacity: 0.45 }}>{depositPct}% deposit today</span>
              <span style={{ ...mono, fontSize: "var(--text-body)", opacity: 0.6 }}>${(deposit / 100).toLocaleString()}</span>
            </div>
          )}

          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.04em", opacity: 0.5, lineHeight: 1.6, marginBottom: 24 }}>
            {scheduleLine}
          </div>

          {canInteract && (
            <>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note (optional)"
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.5)", border: "0.5px solid rgba(15,15,14,0.12)",
                  padding: "10px 12px", fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-body)", color: "var(--ink)",
                  resize: "none", outline: "none", marginBottom: 14, lineHeight: 1.5,
                }}
              />
              <button
                onClick={handleApprove}
                disabled={submitting || total === 0}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--ink)", border: "none", padding: "16px",
                  ...mono, fontSize: "var(--text-eyebrow)",
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: "var(--cream)",
                  cursor: submitting || total === 0 ? "default" : "pointer",
                  opacity: submitting || total === 0 ? 0.4 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {submitting ? "Working…" : approveButtonLabel}
              </button>
              {error && (
                <div style={{ ...sans, fontSize: "var(--text-sm)", color: "var(--danger)", opacity: 0.85, lineHeight: 1.5, marginTop: 12 }}>
                  {error}
                </div>
              )}
            </>
          )}

          {isAccepted && (
            <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.6, lineHeight: 1.7 }}>
              Quote approved — thank you. We'll be in touch.
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
