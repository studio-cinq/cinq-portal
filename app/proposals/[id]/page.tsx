"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"

const mono: React.CSSProperties = {
  fontFamily: "'Matter SemiMono', 'DM Mono', monospace",
}

const serif: React.CSSProperties = {
  fontFamily: "'PP Writer', 'Cormorant Garamond', Georgia, serif",
}

export default function ProposalPage({ params }: { params: { id: string } }) {
  const [proposal, setProposal]     = useState<any>(null)
  const [items, setItems]           = useState<any[]>([])
  const [checked, setChecked]       = useState<boolean[]>([])
  const [phases, setPhases]         = useState<("now" | "later")[]>([])
  const [note, setNote]             = useState("")
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: prop } = await supabase
        .from("proposals")
        .select("*, clients(name, contact_name)")
        .eq("id", params.id)
        .single()

      if (!prop) { setLoading(false); return }
      setProposal(prop)

      // Log first view
if (!prop.viewed_at) {
  await supabase
    .from("proposals")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", params.id)
}

      const { data: propItems } = await supabase
        .from("proposal_items")
        .select("*")
        .eq("proposal_id", params.id)
        .order("sort_order")

      const its = propItems ?? []
      setItems(its)
      setChecked(its.map((i: any) => !i.is_optional))
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
  const baseItems     = items.filter(i => !i.is_optional)
  const optionalItems = items.filter(i => i.is_optional)
  const baseTotal     = baseItems.reduce((s, i) => s + (i.price ?? 0), 0)
  const optionalTotal = optionalItems.reduce((s, i) => s + (i.price ?? 0), 0)

  async function handleConfirm() {
    if (phase1Total === 0) return
    setSubmitting(true)

    await supabase
      .from("proposals")
      .update({ status: "accepted", client_note: note || null })
      .eq("id", params.id)

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
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #F4F1EC 0%, #E8E0D4 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>Loading…</div>
    </div>
  )

  if (!proposal) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #F4F1EC 0%, #E8E0D4 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...serif, fontSize: 14, opacity: 0.5 }}>Proposal not found.</div>
    </div>
  )

  const isExpired  = proposal.expires_at && new Date(proposal.expires_at) < new Date()
  const isAccepted = proposal.status === "accepted"
  const canInteract = !isAccepted && !isExpired

  function renderItem(item: any) {
    const globalIndex = items.indexOf(item)
    return (
      <div
        key={item.id}
        onClick={() => canInteract && toggleItem(globalIndex)}
        style={{
          borderTop: "0.5px solid rgba(15,15,14,0.08)",
          padding: "22px 0",
          cursor: canInteract ? "pointer" : "default",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flex: 1 }}>
            {/* Checkbox */}
            <div style={{
              width: 17, height: 17, borderRadius: "50%",
              border: `0.5px solid ${checked[globalIndex] ? "#0F0F0E" : "rgba(15,15,14,0.2)"}`,
              background: checked[globalIndex] ? "#0F0F0E" : "transparent",
              flexShrink: 0, marginTop: 3,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
            }}>
              {checked[globalIndex] && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#F4F1EC" }} />}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ ...serif, fontSize: 16, fontWeight: 400, opacity: checked[globalIndex] ? 0.88 : 0.3, letterSpacing: "-0.01em", transition: "opacity 0.2s" }}>
                  {item.name}
                </span>
                {item.is_recommended && (
                  <span style={{ ...mono, fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", border: "0.5px solid rgba(107,143,113,0.5)", color: "#6B8F71" }}>
                    Recommended
                  </span>
                )}
              </div>
              {item.description && (
              <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.75, letterSpacing: "0.01em" }}>
              {item.description.split(/\r?\n/).map((line: string, i: number) => (
                <div key={i} style={{ ...serif, display: "flex", gap: 8, marginBottom: line.trim() ? 4 : 0 }}>
                  {line.trim().startsWith('—') || line.trim().startsWith('-') || line.trim().startsWith('•')
                    ? <><span style={{ opacity: 0.4, flexShrink: 0 }}>—</span><span>{line.replace(/^[\-—•]\s*/, '')}</span></>
                    : <span>{line}</span>
                  }
                </div>
              ))}
            </div>
              )}
            </div>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ ...serif, fontSize: 16, opacity: checked[globalIndex] ? 0.82 : 0.25, letterSpacing: "-0.01em" }}>
              ${(item.price / 100).toLocaleString()}
            </div>
            <div style={{ ...mono, fontSize: 8, opacity: 0.35, marginTop: 4, letterSpacing: "0.06em" }}>
              {item.timeline_weeks_min}–{item.timeline_weeks_max} weeks
            </div>
          </div>
        </div>

        {/* Phase toggle */}
        {checked[globalIndex] && canInteract && (
          <div style={{ display: "flex", marginTop: 14, marginLeft: 33 }}>
            {(["now", "later"] as const).map((p, pi) => (
              <button
                key={p}
                onClick={e => { e.stopPropagation(); setPhase(globalIndex, p) }}
                style={{
                  ...mono,
                  fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                  padding: "7px 16px",
                  border: "0.5px solid rgba(15,15,14,0.15)",
                  borderRight: pi === 0 ? "none" : undefined,
                  cursor: "pointer",
                  background: phases[globalIndex] === p ? "#0F0F0E" : "transparent",
                  color: phases[globalIndex] === p ? "#F4F1EC" : "#0F0F0E",
                  opacity: phases[globalIndex] === p ? 1 : 0.45,
                  transition: "all 0.18s",
                }}
              >
                {p === "now" ? "Start now" : "Schedule for later"}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: "linear-gradient(160deg, #F4F1EC 0%, #E8E0D4 100%)", minHeight: "100vh", ...serif }}>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: 64, borderBottom: "0.5px solid rgba(15,15,14,0.1)", background: "rgba(244,241,236,0.95)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(8px)" }}>
        <CinqLogo width={20} />
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {proposal.expires_at && !isExpired && (
            <span style={{ ...mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B07D3A", opacity: 0.85 }}>
              Expires {new Date(proposal.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {isExpired && <span style={{ ...mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c0392b", opacity: 0.7 }}>Expired</span>}
          {isAccepted && <span style={{ ...mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B8F71", opacity: 0.8 }}>Accepted</span>}
          <span style={{ ...mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0F0F0E", opacity: 0.38 }}>
            {proposal.clients?.name}
          </span>
        </div>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Left */}
        <div style={{ padding: "56px 48px 80px 56px", borderRight: "0.5px solid rgba(15,15,14,0.08)" }}>

          {/* Header */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ ...mono, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.38, marginBottom: 14 }}>
              Proposal · Studio Cinq
            </div>
            <h1 style={{ ...serif, fontWeight: 400, fontSize: 30, opacity: 0.9, letterSpacing: "-0.015em", marginBottom: 10, lineHeight: 1.2 }}>
              {proposal.title}
            </h1>
            {proposal.subtitle && (
              <p style={{ ...serif, fontSize: 15, opacity: 0.55, lineHeight: 1.65 }}>
                {proposal.subtitle}
              </p>
            )}
          </div>

          {/* Overview */}
          {proposal.overview && (
            <div style={{ marginBottom: 52 }}>
              <div style={{ ...mono, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 18 }}>
                Overview
              </div>
              <div style={{ ...serif, fontSize: 14, lineHeight: 1.85, opacity: 0.72, whiteSpace: "pre-wrap" }}>
                {proposal.overview}
              </div>
            </div>
          )}

          {/* Base scope */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <div style={{ ...mono, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38 }}>Scope</div>
              <div style={{ ...mono, fontSize: 8, opacity: 0.38 }}>Base estimate: ${(baseTotal / 100).toLocaleString()}</div>
            </div>
            {baseItems.map(item => renderItem(item))}
            <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }} />
          </div>

          {/* Optional add-ons */}
          {optionalItems.length > 0 && (
            <div style={{ marginBottom: 52 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <div style={{ ...mono, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38 }}>Optional add-ons</div>
                <div style={{ ...mono, fontSize: 8, opacity: 0.38 }}>+${(optionalTotal / 100).toLocaleString()} if added</div>
              </div>
              {optionalItems.map(item => renderItem(item))}
              <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }} />
            </div>
          )}

          {/* Closing */}
          {proposal.closing && (
            <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)", paddingTop: 40 }}>
              <div style={{ ...serif, fontSize: 14, lineHeight: 1.85, opacity: 0.65, whiteSpace: "pre-wrap", marginBottom: 20 }}>
                {proposal.closing}
              </div>
              <div style={{ ...mono, fontSize: 10, opacity: 0.4 }}>
                Kacie Yates · Studio Cinq
              </div>
            </div>
          )}

        </div>

        {/* Right — white panel */}
        <div style={{
          padding: "48px 32px",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 64,
          height: "fit-content",
          background: "rgba(255,255,255,0.55)",
          borderLeft: "0.5px solid rgba(15,15,14,0.08)",
        }}>
          <div style={{ ...mono, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.4, marginBottom: 24 }}>
            Your selection
          </div>

          {/* Line items */}
          <div style={{ marginBottom: 24, minHeight: 60 }}>
            {items.map((item, i) => checked[i] && (
              <div key={item.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                padding: "9px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)",
              }}>
                <span style={{ ...serif, fontSize: 13, opacity: phases[i] === "later" ? 0.35 : 0.7 }}>
                  {item.name}
                  {phases[i] === "later" && <span style={{ ...mono, fontSize: 8, marginLeft: 6, opacity: 0.5 }}>later</span>}
                </span>
                <span style={{ ...serif, fontSize: 13, opacity: phases[i] === "later" ? 0.3 : 0.65 }}>
                  ${(item.price / 100).toLocaleString()}
                </span>
              </div>
            ))}
            {items.every((_, i) => !checked[i]) && (
              <div style={{ ...serif, fontSize: 13, opacity: 0.3, paddingTop: 8 }}>No items selected.</div>
            )}
          </div>

          <div style={{ height: "0.5px", background: "rgba(15,15,14,0.12)", marginBottom: 20 }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ ...mono, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.45 }}>Phase 1 total</span>
            <span style={{ ...serif, fontSize: 22, opacity: 0.88, letterSpacing: "-0.01em" }}>
              ${(phase1Total / 100).toLocaleString()}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28 }}>
            <span style={{ ...mono, fontSize: 8, opacity: 0.38 }}>50% deposit due now</span>
            <span style={{ ...serif, fontSize: 15, opacity: 0.6 }}>${(deposit / 100).toLocaleString()}</span>
          </div>

          {canInteract && (
            <>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note to Kacie (optional)"
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.5)",
                  border: "0.5px solid rgba(15,15,14,0.12)",
                  padding: "10px 12px",
                  fontFamily: "'PP Writer', Georgia, serif",
                  fontSize: 13, color: "#0F0F0E",
                  resize: "none", outline: "none",
                  marginBottom: 14, lineHeight: 1.5,
                }}
              />
              <button
                onClick={handleConfirm}
                disabled={phase1Total === 0 || submitting}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#0F0F0E", border: "none", padding: "15px",
                  fontFamily: "'Matter SemiMono', monospace",
                  fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
                  color: "#F4F1EC",
                  cursor: phase1Total === 0 || submitting ? "default" : "pointer",
                  opacity: phase1Total === 0 || submitting ? 0.25 : 1,
                  marginBottom: 16, transition: "opacity 0.2s",
                }}
              >
                {submitting ? "Redirecting…" : "Confirm & pay deposit"}
              </button>
              <div style={{ ...mono, fontSize: 8, opacity: 0.3, letterSpacing: "0.03em", lineHeight: 1.8 }}>
                Remaining 50% invoiced at project completion.<br />
                Scheduled items confirmed at no cost today.
              </div>
            </>
          )}

          {isAccepted && (
            <div style={{ ...serif, fontSize: 13, opacity: 0.6, lineHeight: 1.7 }}>
              Proposal accepted — thank you. We'll be in touch shortly.
            </div>
          )}

          {isExpired && (
            <div style={{ ...serif, fontSize: 13, opacity: 0.5, lineHeight: 1.7 }}>
              This proposal has expired. Please reach out to request an updated version.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
