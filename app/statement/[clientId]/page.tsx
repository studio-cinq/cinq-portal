"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"

/**
 * Client-facing Statement of Account with a single "pay the full balance"
 * card checkout. Lists every open invoice for the client (each number links
 * to its own invoice page, which still carries bank transfer / Venmo / check
 * details) and offers one Stripe session covering all of them.
 *
 * Route: /statement/{clientId} — public by unguessable UUID, same model as
 * /invoice/{id}. Kacie shares it from the admin invoices page (client group
 * header → "Copy pay link") or via the statement PDF.
 */

type Inv = {
  id: string
  invoice_number: string
  description: string | null
  amount: number
  status: string
  due_date: string | null
}

const UNPAID = ["sent", "overdue", "upcoming"]

function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Upon receipt"
}

export default function StatementPage({ params }: { params: { clientId: string } }) {
  const [client, setClient] = useState<{ name: string } | null>(null)
  const [invoices, setInvoices] = useState<Inv[] | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justPaid, setJustPaid] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get("session_id")) {
      setJustPaid(true)
      url.searchParams.delete("session_id")
      window.history.replaceState({}, "", url.pathname)
    }
    async function load() {
      const [{ data: c }, { data: list }] = await Promise.all([
        supabase.from("clients").select("name").eq("id", params.clientId).single(),
        supabase.from("invoices")
          .select("id, invoice_number, description, amount, status, due_date")
          .eq("client_id", params.clientId)
          .in("status", UNPAID)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("invoice_number", { ascending: true }),
      ])
      setClient((c as any) ?? null)
      setInvoices(((list ?? []) as Inv[]))
    }
    load()
  }, [params.clientId])

  async function payAll() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/statement-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: params.clientId }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload.url) {
        setError(payload.error ?? "Card checkout is temporarily unavailable.")
        setSubmitting(false)
        return
      }
      window.location.href = payload.url
    } catch {
      setError("Card checkout is temporarily unavailable.")
      setSubmitting(false)
    }
  }

  const eyebrow: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
    letterSpacing: "0.14em", textTransform: "uppercase",
  }

  if (invoices === null) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-grad)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...eyebrow, letterSpacing: "0.16em", opacity: 0.35 }}>Loading…</div>
    </div>
  )
  if (!client) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-grad)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.5 }}>Statement not found.</div>
    </div>
  )

  const total = invoices.reduce((s, i) => s + i.amount, 0)
  const today = new Date()
  const settled = invoices.length === 0

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-grad)" }}>
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "0 20px" : "0 48px", height: "var(--nav-h)",
        borderBottom: "0.5px solid rgba(15,15,14,0.1)",
        background: "rgba(244,241,236,0.95)", backdropFilter: "blur(8px)",
      }}>
        <CinqLogo width={33} />
        <span style={{ ...eyebrow, letterSpacing: "0.1em", color: "var(--ink)", opacity: 0.38 }}>{client.name}</span>
      </nav>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: isMobile ? "32px 20px 56px" : "48px 32px 80px" }}>
        <div style={{ ...eyebrow, letterSpacing: "0.16em", opacity: 0.42, marginBottom: 10 }}>
          Statement of account · {today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </div>
        <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: isMobile ? 22 : 28, letterSpacing: "-0.015em", opacity: 0.9, margin: "0 0 32px" }}>
          {client.name}
        </h1>

        {justPaid && (
          <div style={{
            display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 32,
            padding: isMobile ? "16px 18px" : "18px 22px",
            background: "rgba(143,167,181,0.08)", border: "1px solid rgba(143,167,181,0.35)", borderLeft: "3px solid var(--sage)",
          }}>
            <span aria-hidden="true" style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600, color: "var(--sage)", lineHeight: 1.4 }}>✓</span>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: 1.6, color: "var(--ink)", opacity: 0.85 }}>
              Payment received — thank you! A receipt is on its way from Stripe, and each invoice below will show as paid once the payment settles.
            </div>
          </div>
        )}

        {settled ? (
          <div style={{ padding: "40px 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.6 }}>
            Nothing outstanding — this account is settled.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "20px 0", borderTop: "0.5px solid rgba(15,15,14,0.1)", borderBottom: "0.5px solid rgba(15,15,14,0.1)", marginBottom: 28 }}>
              <span style={{ ...eyebrow, letterSpacing: "0.12em", opacity: 0.5 }}>Total balance due</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 28, letterSpacing: "-0.01em", opacity: 0.9 }}>{fmtMoney(total)}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 0 10px", borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
              <span style={{ ...eyebrow, letterSpacing: "0.1em", opacity: 0.4 }}>Invoice</span>
              <span style={{ ...eyebrow, letterSpacing: "0.1em", opacity: 0.4 }}>Amount</span>
            </div>
            {invoices.map(inv => {
              const due = inv.due_date ? new Date(inv.due_date) : null
              const overdue = inv.status === "overdue" || (due !== null && due < today)
              return (
                <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
                  <div style={{ minWidth: 0 }}>
                    <a href={`/invoice/${inv.id}`} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--ink)", opacity: 0.85, textDecoration: "underline", textUnderlineOffset: 3 }}>
                      #{inv.invoice_number}
                    </a>
                    {inv.description && (
                      <span style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.6, marginTop: 3 }}>{inv.description}</span>
                    )}
                    <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 5, color: overdue ? "var(--alarm)" : "var(--ink)", opacity: overdue ? 0.9 : 0.45 }}>
                      {overdue ? `Overdue · was due ${fmtDate(inv.due_date)}` : `Due ${fmtDate(inv.due_date)}`}
                    </span>
                  </div>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.85, whiteSpace: "nowrap" }}>{fmtMoney(inv.amount)}</span>
                </div>
              )
            })}

            <div style={{ marginTop: 32 }}>
              <button onClick={payAll} disabled={submitting} style={{
                ...eyebrow, letterSpacing: "0.16em",
                background: "var(--ink)", color: "var(--cream)", border: "none",
                padding: "16px 32px", width: isMobile ? "100%" : undefined,
                cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.4 : 1, transition: "opacity 0.2s",
              }}>
                {submitting ? "Redirecting…" : `Pay full balance by card · ${fmtMoney(total)}`}
              </button>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.55, lineHeight: 1.6, marginTop: 14 }}>
                One secure checkout through Stripe covering every invoice above. Prefer to pay by bank transfer, Venmo, or check? Open any invoice number for those details, or pay each invoice on its own page.
              </p>
              {error && (
                <div role="alert" style={{ marginTop: 10, fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--amber)", opacity: 0.9 }}>{error}</div>
              )}
            </div>
          </>
        )}

        <div style={{ marginTop: 64, paddingTop: 22, borderTop: "0.5px solid rgba(15,15,14,0.08)", ...eyebrow, opacity: 0.25 }}>
          Studio Cinq · portal.studiocinq.com
        </div>
      </main>
    </div>
  )
}
