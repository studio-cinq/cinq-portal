"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import CinqLogo from "@/components/CinqLogo"

export default function ProposalPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [proposal, setProposal]   = useState<any>(null)
  const [items, setItems]         = useState<any[]>([])
  const [checked, setChecked]     = useState<boolean[]>([])
  const [phases, setPhases]       = useState<("now" | "later")[]>([])
  const [note, setNote]           = useState("")
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: prop } = await supabase
        .from("proposals")
        .select("*, clients(name)")
        .eq("id", params.id)
        .single()

      if (!prop) { setLoading(false); return }
      setProposal(prop)

      const { data: propItems } = await supabase
        .from("proposal_items")
        .select("*")
        .eq("proposal_id", params.id)
        .order("sort_order")

      const its = propItems ?? []
      setItems(its)
      setChecked(its.map(() => true))
      setPhases(its.map((i: any) => i.phase ?? "now"))
      setLoading(false)
    }
    load()
  }, [params.id])

  function toggleItem(i: number) {
    setChecked(c => c.map((v, idx) => idx === i ? !v : v))
  }

  function setPhase(i: number, phase: "now" | "later") {
    setPhases(p => p.map((v, idx) => idx === i ? phase : v))
  }

  const phase1Total = items.reduce((sum, item, i) => {
    if (!checked[i] || phases[i] !== "now") return sum
    return sum + (item.price ?? 0)
  }, 0)

  const deposit = Math.round(phase1Total * 0.5)

  async function handleConfirm() {
    if (phase1Total === 0) return
    setSubmitting(true)

    // Save note and mark accepted
    await supabase
      .from("proposals")
      .update({ status: "accepted", client_note: note || null })
      .eq("id", params.id)

    // Create Stripe checkout
    const res = await fetch("/api/proposal-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposalId: params.id,
        amount:     deposit,
        clientName: proposal?.clients?.name ?? "",
        title:      proposal?.title ?? "Proposal deposit",
      }),
    })

    const { url } = await res.json()
    if (url) window.location.href = url
    else setSubmitting(false)
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #EDE8E0 0%, #DDD4C6 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>Loading…</div>
    </div>
  )

  if (!proposal) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #EDE8E0 0%, #DDD4C6 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 12, opacity: 0.45 }}>Proposal not found.</div>
    </div>
  )

  const isExpired = proposal.expires_at && new Date(proposal.expires_at) < new Date()
  const isAccepted = proposal.status === "accepted"

  return (
    <div style={{ background: "linear-gradient(160deg, #EDE8E0 0%, #DDD4C6 100%)", minHeight: "100vh", fontFamily: "'Jost', sans-serif" }}>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: 64, borderBottom: "0.5px solid rgba(15,15,14,0.1)", background: "rgba(237,232,224,0.9)" }}>
        <CinqLogo width={20} />
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {proposal.expires_at && !isExpired && (
            <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B07D3A", opacity: 0.8 }}>
              Expires {new Date(proposal.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {isExpired && (
            <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c0392b", opacity: 0.7 }}>Expired</span>
          )}
          <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0F0F0E", opacity: 0.35 }}>
            {proposal.clients?.name}
          </span>
        </div>
      </nav>

      {isAccepted && (
        <div style={{ background: "#6B8F71", padding: "12px 48px", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#EDE8E0", textAlign: "center" }}>
          Proposal accepted — thank you. We'll be in touch shortly.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Left */}
        <div style={{ padding: "48px 40px 48px 48px", borderRight: "0.5px solid rgba(15,15,14,0.1)" }}>
          <div style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.35, marginBottom: 10 }}>
            Proposal
          </div>
          <h1 style={{ fontWeight: 300, fontSize: 26, opacity: 0.88, letterSpacing: "-0.01em", marginBottom: 6 }}>
            {proposal.title}
          </h1>
          {proposal.subtitle && (
            <p style={{ fontSize: 11, opacity: 0.45, marginBottom: 36, lineHeight: 1.6 }}>{proposal.subtitle}</p>
          )}

          {/* Items */}
          <div>
            {items.map((item, i) => (
              <div key={item.id} onClick={() => !isAccepted && !isExpired && toggleItem(i)} style={{
                borderTop: "0.5px solid rgba(15,15,14,0.08)",
                padding: "20px 0",
                cursor: isAccepted || isExpired ? "default" : "pointer",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flex: 1 }}>
                    {/* Checkbox */}
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%",
                      border: `0.5px solid ${checked[i] ? "#0F0F0E" : "rgba(15,15,14,0.25)"}`,
                      background: checked[i] ? "#0F0F0E" : "transparent",
                      flexShrink: 0, marginTop: 2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s",
                    }}>
                      {checked[i] && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#EDE8E0" }} />}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 300, opacity: checked[i] ? 0.88 : 0.35, marginBottom: 4, letterSpacing: "-0.01em", transition: "opacity 0.2s" }}>
                        {item.name}
                        {item.is_recommended && (
                          <span style={{ fontSize: 7, letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", border: "0.5px solid rgba(107,143,113,0.4)", color: "#6B8F71", marginLeft: 10, verticalAlign: "middle" }}>
                            Recommended
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 10, opacity: 0.45, lineHeight: 1.6 }}>{item.description}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 300, opacity: checked[i] ? 0.82 : 0.3, letterSpacing: "-0.01em" }}>
                      ${(item.price / 100).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 9, opacity: 0.35, marginTop: 3, letterSpacing: "0.06em" }}>
                      {item.timeline_weeks_min}–{item.timeline_weeks_max} weeks
                    </div>
                  </div>
                </div>

                {/* Phase selector */}
                {checked[i] && !isAccepted && !isExpired && (
                  <div style={{ display: "flex", marginTop: 14, marginLeft: 32 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setPhase(i, "now") }}
                      style={{
                        fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                        padding: "7px 14px", border: "0.5px solid rgba(15,15,14,0.15)",
                        borderRight: "none", cursor: "pointer",
                        background: phases[i] === "now" ? "#0F0F0E" : "transparent",
                        color: phases[i] === "now" ? "#EDE8E0" : "#0F0F0E",
                        opacity: phases[i] === "now" ? 1 : 0.45,
                        fontFamily: "'Jost', sans-serif",
                      }}
                    >
                      Start now
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setPhase(i, "later") }}
                      style={{
                        fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                        padding: "7px 14px", border: "0.5px solid rgba(15,15,14,0.15)",
                        cursor: "pointer",
                        background: phases[i] === "later" ? "#0F0F0E" : "transparent",
                        color: phases[i] === "later" ? "#EDE8E0" : "#0F0F0E",
                        opacity: phases[i] === "later" ? 1 : 0.45,
                        fontFamily: "'Jost', sans-serif",
                      }}
                    >
                      Schedule for later
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }} />
          </div>
        </div>

        {/* Right */}
        <div style={{ padding: "48px 32px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35, marginBottom: 28 }}>
            Your selection
          </div>

          <div style={{ flex: 1, marginBottom: 24 }}>
            {items.map((item, i) => checked[i] && (
              <div key={item.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)",
                fontSize: 11, opacity: phases[i] === "later" ? 0.35 : 0.7,
              }}>
                <span>{item.name}{phases[i] === "later" ? " — Later" : ""}</span>
                <span>${(item.price / 100).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div style={{ height: "0.5px", background: "rgba(15,15,14,0.12)", marginBottom: 20 }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4 }}>Phase 1 total</span>
            <span style={{ fontWeight: 300, fontSize: 20, opacity: 0.88, letterSpacing: "-0.01em" }}>
              ${(phase1Total / 100).toLocaleString()}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
            <span style={{ fontSize: 9, opacity: 0.35 }}>50% deposit due now</span>
            <span style={{ fontSize: 13, opacity: 0.55 }}>${(deposit / 100).toLocaleString()}</span>
          </div>

          {!isAccepted && !isExpired && (
            <>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note to Kacie (optional)"
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.3)",
                  border: "0.5px solid rgba(15,15,14,0.12)",
                  padding: "11px 14px",
                  fontFamily: "'Jost', sans-serif", fontSize: 11, fontWeight: 300,
                  color: "#0F0F0E", resize: "none", outline: "none",
                  marginBottom: 12,
                }}
              />

              <button
                onClick={handleConfirm}
                disabled={phase1Total === 0 || submitting}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#0F0F0E", border: "none", padding: 14,
                  fontFamily: "'Jost', sans-serif", fontSize: 9,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: "#EDE8E0", cursor: phase1Total === 0 || submitting ? "default" : "pointer",
                  opacity: phase1Total === 0 || submitting ? 0.25 : 1,
                  marginBottom: 12, transition: "opacity 0.2s",
                }}
              >
                {submitting ? "Redirecting…" : "Confirm & pay deposit"}
              </button>

              <div style={{ fontSize: 9, opacity: 0.25, letterSpacing: "0.04em", lineHeight: 1.6 }}>
                Remaining 50% is invoiced at project completion.<br />
                Scheduled items are confirmed at no cost today.
              </div>
            </>
          )}

          {isAccepted && (
            <div style={{ fontSize: 11, opacity: 0.55, lineHeight: 1.6 }}>
              Thank you for confirming. We'll be in touch to get started.
            </div>
          )}

          {isExpired && (
            <div style={{ fontSize: 11, opacity: 0.45, lineHeight: 1.6 }}>
              This proposal has expired. Please reach out to request an updated version.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
