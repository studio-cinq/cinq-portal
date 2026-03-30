"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"

interface Comment {
  id: string
  comment: string
  page_url: string
  created_at: string
  resolved: boolean
}

export default function ReviewPage({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<any>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [draft, setDraft] = useState("")
  const [panelOpen, setPanelOpen] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
        setComments((pins ?? []).map((p: any) => ({
          id: p.id,
          comment: p.comment,
          page_url: p.page_url || "",
          created_at: p.created_at,
          resolved: p.resolved,
        })))

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

  async function addComment() {
    if (!session || !draft.trim()) return

    // Try to get current iframe URL
    let pageUrl = session.site_url
    try {
      pageUrl = iframeRef.current?.contentWindow?.location.href ?? session.site_url
    } catch {
      // Cross-origin — can't read, use base URL
    }

    const res = await fetch("/api/review/save-annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        xPercent: 0,
        yPercent: 0,
        comment: draft.trim(),
        pageUrl,
      }),
    })
    const { annotation } = await res.json()
    if (annotation) {
      setComments(prev => [...prev, {
        id: annotation.id,
        comment: annotation.comment,
        page_url: annotation.page_url || pageUrl,
        created_at: annotation.created_at,
        resolved: false,
      }])
    }
    setDraft("")
    textareaRef.current?.focus()
  }

  async function deleteComment(id: string) {
    await fetch("/api/review/delete-annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annotationId: id }),
    })
    setComments(prev => prev.filter(c => c.id !== id))
  }

  async function handleSubmit() {
    if (!session || comments.length === 0) return
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
    if (!confirm("Approve this site? This confirms the current direction.")) return
    setApproving(true)
    await fetch("/api/review/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    })
    setSession((s: any) => s ? { ...s, status: "approved" } : s)
    setApproving(false)
  }

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

  // Post-submit
  if (session.status === "revising") return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--cream)", padding: 40, textAlign: "center" }}>
      <CinqLogo width={20} />
      <div style={{ marginTop: 32 }}>
        <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", fontWeight: 400, opacity: 0.85, margin: "0 0 12px" }}>Feedback received</h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.5, maxWidth: 400, lineHeight: 1.7 }}>
          Your notes are being reviewed and changes are underway. You'll receive an email when the next round is ready.
        </p>
        <div style={{ marginTop: 24, fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.35 }}>
          Round {session.current_round} · {comments.length} note{comments.length !== 1 ? "s" : ""} submitted
        </div>
      </div>
    </div>
  )

  // Approved
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--cream)", overflow: "hidden" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 48, flexShrink: 0,
        background: "rgba(250,248,245,0.98)", borderBottom: "0.5px solid rgba(15,15,14,0.1)",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <CinqLogo width={16} />
          <span style={{ width: 0.5, height: 16, background: "rgba(15,15,14,0.12)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4 }}>
            {project?.title ?? "Website Review"} · Round {session.current_round}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {session.notes && (
            <button onClick={() => setShowInfo(!showInfo)} style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase",
              opacity: 0.4, background: "none", border: "none", cursor: "pointer", color: "var(--ink)", padding: "4px 8px",
            }}>
              Note from Kacie
              <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "var(--amber)", marginLeft: 6, verticalAlign: "middle" }} />
            </button>
          )}
          <button onClick={() => setPanelOpen(!panelOpen)} style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase",
            opacity: 0.4, background: "none", border: "0.5px solid rgba(15,15,14,0.15)", padding: "4px 12px",
            cursor: "pointer", color: "var(--ink)",
          }}>
            {panelOpen ? "Hide comments" : `Comments (${comments.length})`}
          </button>
        </div>
      </div>

      {/* Kacie's note banner */}
      {showInfo && session.notes && (
        <div style={{
          padding: "12px 20px", background: "rgba(250,248,245,0.95)",
          borderBottom: "0.5px solid rgba(15,15,14,0.08)", flexShrink: 0,
        }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.6, margin: 0, lineHeight: 1.6, maxWidth: 600 }}>
            {session.notes}
          </p>
        </div>
      )}

      {/* Main content: iframe + sidebar */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Live site iframe */}
        <div style={{ flex: 1, position: "relative" }}>
          <iframe
            ref={iframeRef}
            src={session.site_url}
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>

        {/* Comment sidebar */}
        {panelOpen && (
          <div style={{
            width: 340, flexShrink: 0, display: "flex", flexDirection: "column",
            background: "rgba(250,248,245,0.98)", borderLeft: "0.5px solid rgba(15,15,14,0.1)",
          }}>

            {/* Comment list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
              {comments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px" }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.45, marginBottom: 8 }}>No comments yet</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.3, lineHeight: 1.6 }}>
                    Browse the site and add comments below for anything you'd like changed.
                  </div>
                </div>
              ) : comments.map((c, i) => (
                <div key={c.id} style={{
                  padding: "14px 0",
                  borderBottom: "0.5px solid rgba(15,15,14,0.07)",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    {/* Number */}
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      background: "var(--ink)", color: "#EDE8E0",
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginTop: 1,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.82, margin: 0, lineHeight: 1.55 }}>
                        {c.comment}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.3 }}>
                          {new Date(c.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <button onClick={() => deleteComment(c.id)} style={{
                          fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", textTransform: "uppercase",
                          color: "var(--ink)", opacity: 0.25, background: "none", border: "none", cursor: "pointer", padding: 0,
                        }}>✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add comment input */}
            <div style={{ padding: "12px 16px", borderTop: "0.5px solid rgba(15,15,14,0.1)", flexShrink: 0 }}>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment() } }}
                placeholder="Add a comment…"
                rows={2}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "10px 12px",
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                  color: "var(--ink)", background: "rgba(255,255,255,0.5)",
                  border: "0.5px solid rgba(15,15,14,0.1)", outline: "none",
                  resize: "none", lineHeight: 1.55,
                }}
              />
              <button onClick={addComment} disabled={!draft.trim()} style={{
                width: "100%", marginTop: 8,
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
                background: "var(--ink)", color: "#EDE8E0",
                border: "none", padding: "10px 0", cursor: "pointer",
                opacity: draft.trim() ? 1 : 0.25, transition: "opacity 0.2s",
              }}>
                Add comment
              </button>
            </div>

            {/* Actions */}
            <div style={{ padding: "12px 16px", borderTop: "0.5px solid rgba(15,15,14,0.1)", flexShrink: 0, display: "flex", gap: 8 }}>
              <button onClick={handleSubmit} disabled={submitting || comments.length === 0} style={{
                flex: 1,
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
                background: "var(--ink)", color: "#EDE8E0",
                border: "none", padding: "10px 0", cursor: "pointer",
                opacity: submitting || comments.length === 0 ? 0.25 : 1, transition: "opacity 0.2s",
              }}>
                {submitting ? "Sending…" : "Submit feedback"}
              </button>
              <button onClick={handleApprove} disabled={approving} style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
                background: "none", color: "var(--ink)",
                border: "0.5px solid rgba(15,15,14,0.15)", padding: "10px 16px", cursor: "pointer",
                opacity: approving ? 0.25 : 0.5, transition: "opacity 0.2s",
              }}>
                {approving ? "…" : "Approve"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
