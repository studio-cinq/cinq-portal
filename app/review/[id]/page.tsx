"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"

interface Annotation {
  id: string
  x_percent: number
  y_percent: number
  comment: string
  resolved: boolean
  created_at: string
}

interface PendingPin {
  x: number
  y: number
}

export default function ReviewPage({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<any>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [mode, setMode] = useState<"browse" | "comment">("browse")
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [openPin, setOpenPin] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("review_sessions")
        .select("*, clients(name, contact_name), projects(title)")
        .eq("id", params.id)
        .single()

      if (data) {
        setSession(data)
        const { data: pins } = await supabase
          .from("review_annotations")
          .select("*")
          .eq("session_id", data.id)
          .eq("round", (data as any).current_round)
          .order("created_at")
        setAnnotations(pins ?? [])

        fetch("/api/review/track-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: params.id }),
        }).catch(() => {})
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "comment") return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPendingPin({ x, y })
    setOpenPin(null)
  }, [mode])

  async function savePin(comment: string) {
    if (!session || !pendingPin) return
    const res = await fetch("/api/review/save-annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        xPercent: pendingPin.x,
        yPercent: pendingPin.y,
        comment,
      }),
    })
    const { annotation } = await res.json()
    if (annotation) setAnnotations(prev => [...prev, annotation])
    setPendingPin(null)
  }

  async function deletePin(id: string) {
    await fetch("/api/review/delete-annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annotationId: id }),
    })
    setAnnotations(prev => prev.filter(a => a.id !== id))
    setOpenPin(null)
  }

  async function handleSubmit() {
    if (!session || annotations.length === 0) return
    setSubmitting(true)
    await fetch("/api/review/submit-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    })
    setSession((s: any) => s ? { ...s, status: "revising" } : s)
    setSubmitting(false)
  }

  async function handleApprove() {
    if (!session) return
    setApproving(true)
    await fetch("/api/review/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    })
    setSession((s: any) => s ? { ...s, status: "approved" } : s)
    setApproving(false)
  }

  // Loading state
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.4 }}>Loading review…</div>
    </div>
  )

  if (!session) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-lg)", opacity: 0.5 }}>Review not found.</div>
    </div>
  )

  // Post-submit state
  if (session.status === "revising") return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--cream)", padding: 40, textAlign: "center" }}>
      <CinqLogo width={20} />
      <div style={{ marginTop: 32 }}>
        <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", fontWeight: 400, opacity: 0.85, margin: "0 0 12px" }}>Feedback received</h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.5, maxWidth: 400, lineHeight: 1.7 }}>
          Your notes are being reviewed and changes are underway. You'll receive an email when the next round is ready.
        </p>
        <div style={{ marginTop: 24, fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.35 }}>
          Round {session.current_round} · {annotations.length} note{annotations.length !== 1 ? "s" : ""} submitted
        </div>
      </div>
    </div>
  )

  // Approved state
  if (session.status === "approved") return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--cream)", padding: 40, textAlign: "center" }}>
      <CinqLogo width={20} />
      <div style={{ marginTop: 32 }}>
        <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", fontWeight: 400, opacity: 0.85, margin: "0 0 12px" }}>Site approved</h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.5, maxWidth: 400, lineHeight: 1.7 }}>
          This website has been approved. Thank you for your review!
        </p>
      </div>
    </div>
  )

  const project = session.projects as any

  return (
    <div style={{ minHeight: "100vh", background: "#E8E0D4" }}>

      {/* Screenshot with pin overlay */}
      <div style={{ maxWidth: 1440, margin: "0 auto", position: "relative" }}>
        <div
          onClick={handleImageClick}
          style={{ position: "relative", cursor: mode === "comment" ? "crosshair" : "default" }}
        >
          {/* The screenshot image */}
          <img
            ref={imgRef}
            src={session.screenshot_url}
            alt="Website screenshot"
            style={{ width: "100%", display: "block" }}
            draggable={false}
          />

          {/* Comment mode border indicator */}
          {mode === "comment" && (
            <div style={{ position: "absolute", inset: 0, border: "2px solid var(--amber)", pointerEvents: "none", opacity: 0.3 }} />
          )}

          {/* Placed pins */}
          {annotations.map((ann, i) => (
            <div key={ann.id} style={{ position: "absolute", left: `${ann.x_percent}%`, top: `${ann.y_percent}%`, transform: "translate(-50%, -50%)", zIndex: 10 }}>
              <button
                onClick={e => { e.stopPropagation(); setOpenPin(openPin === ann.id ? null : ann.id) }}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: ann.resolved ? "rgba(15,15,14,0.35)" : "var(--ink)",
                  color: "#EDE8E0", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2.5px solid rgba(255,255,255,0.9)", cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)", padding: 0,
                  transition: "transform 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.15)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                {i + 1}
              </button>

              {/* Pin tooltip */}
              {openPin === ann.id && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: "absolute", top: 36, left: "50%", transform: "translateX(-50%)",
                  background: "rgba(250,248,245,0.98)", border: "0.5px solid rgba(15,15,14,0.12)",
                  padding: "14px 18px", minWidth: 220, maxWidth: 300,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.1)", backdropFilter: "blur(12px)", zIndex: 20,
                }}>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.85, margin: 0, lineHeight: 1.6 }}>
                    {ann.comment}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.35 }}>
                      {new Date(ann.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                    <button onClick={() => deletePin(ann.id)} style={{
                      fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase",
                      color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: 0, opacity: 0.7,
                    }}>Remove</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Pending pin input */}
          {pendingPin && (
            <PinInput
              x={pendingPin.x}
              y={pendingPin.y}
              onSave={savePin}
              onCancel={() => setPendingPin(null)}
            />
          )}
        </div>
      </div>

      {/* Floating bottom bar */}
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 60,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}>
        {/* Info panel */}
        {showInfo && (
          <div style={{
            background: "rgba(250,248,245,0.98)", border: "0.5px solid rgba(15,15,14,0.12)",
            backdropFilter: "blur(12px)", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            padding: "14px 18px", width: 380,
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.35, marginBottom: 8 }}>
              How to review
            </div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.55, margin: 0, lineHeight: 1.6 }}>
              Switch to <strong>Comment</strong> mode, then click anywhere on the page to drop a pin and leave a note. When you're done, hit <strong>Submit</strong> to send your feedback. If everything looks good, hit <strong>Approve</strong>.
            </p>
            {session.notes && (
              <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)", paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.35, marginBottom: 4 }}>Note from Kacie</div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.6, margin: 0, lineHeight: 1.6 }}>{session.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Pill bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 2,
          background: "rgba(250,248,245,0.98)", border: "0.5px solid rgba(15,15,14,0.12)",
          backdropFilter: "blur(12px)", boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
          padding: "6px 6px", borderRadius: 40,
        }}>
          {/* Project name + info toggle */}
          <button onClick={() => setShowInfo(!showInfo)} style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--ink)", opacity: 0.4, background: "none", border: "none", cursor: "pointer",
            padding: "6px 12px", whiteSpace: "nowrap",
          }}>
            {project?.title ?? "Website Review"} · R{session.current_round}
            {session.notes && <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "var(--amber)", marginLeft: 6, verticalAlign: "middle" }} />}
          </button>

          <span style={{ width: 0.5, height: 16, background: "rgba(15,15,14,0.1)" }} />

          {/* Browse / Comment toggle */}
          <div style={{ display: "flex", borderRadius: 20, overflow: "hidden" }}>
            {(["browse", "comment"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setPendingPin(null); setOpenPin(null) }} style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "6px 14px", border: "none", cursor: "pointer", borderRadius: 20,
                background: mode === m ? "var(--ink)" : "transparent",
                color: mode === m ? "#EDE8E0" : "var(--ink)",
                opacity: mode === m ? 1 : 0.4, transition: "all 0.15s",
              }}>
                {m === "browse" ? "Browse" : `Comment${annotations.length > 0 ? ` (${annotations.length})` : ""}`}
              </button>
            ))}
          </div>

          <span style={{ width: 0.5, height: 16, background: "rgba(15,15,14,0.1)" }} />

          {/* Submit */}
          <button onClick={handleSubmit} disabled={submitting || annotations.length === 0} style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
            background: "var(--ink)", color: "#EDE8E0", padding: "6px 14px",
            border: "none", cursor: "pointer", borderRadius: 20,
            opacity: submitting || annotations.length === 0 ? 0.25 : 1, transition: "opacity 0.2s", whiteSpace: "nowrap",
          }}>
            {submitting ? "Sending…" : "Submit"}
          </button>

          {/* Approve */}
          <button onClick={handleApprove} disabled={approving} style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
            background: "none", color: "var(--ink)", padding: "6px 12px",
            cursor: "pointer", border: "0.5px solid rgba(15,15,14,0.15)", borderRadius: 20,
            opacity: approving ? 0.25 : 0.5, transition: "opacity 0.2s", whiteSpace: "nowrap",
          }}>
            {approving ? "Approving…" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  )
}


function PinInput({ x, y, onSave, onCancel }: { x: number; y: number; onSave: (comment: string) => void; onCancel: () => void }) {
  const [comment, setComment] = useState("")

  function handleSave() {
    if (comment.trim()) onSave(comment.trim())
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute",
        left: `${Math.min(Math.max(x, 15), 85)}%`,
        top: `${y}%`,
        transform: "translate(-50%, 16px)",
        background: "rgba(250,248,245,0.98)", border: "0.5px solid rgba(15,15,14,0.12)",
        padding: 16, width: 280,
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)", backdropFilter: "blur(12px)", zIndex: 30,
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: "50%", background: "var(--ink)", color: "#EDE8E0",
        fontFamily: "var(--font-mono)", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 10, border: "2px solid rgba(255,255,255,0.9)", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}>+</div>

      <label style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, display: "block", marginBottom: 6 }}>
        Your note
      </label>
      <textarea
        autoFocus
        value={comment}
        onChange={e => setComment(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave() } if (e.key === "Escape") onCancel() }}
        placeholder="What would you like changed here?"
        rows={3}
        style={{
          width: "100%", padding: "10px 12px",
          fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
          color: "var(--ink)", background: "rgba(255,255,255,0.4)",
          border: "0.5px solid rgba(15,15,14,0.1)", outline: "none",
          resize: "vertical", boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={handleSave} disabled={!comment.trim()} style={{
          fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
          background: "var(--ink)", color: "#EDE8E0", padding: "8px 16px",
          border: "none", cursor: "pointer", opacity: comment.trim() ? 1 : 0.3,
        }}>Save pin</button>
        <button onClick={onCancel} style={{
          fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
          background: "none", color: "var(--ink)", padding: "8px 12px",
          cursor: "pointer", border: "0.5px solid rgba(15,15,14,0.15)", opacity: 0.6,
        }}>Cancel</button>
      </div>
    </div>
  )
}
