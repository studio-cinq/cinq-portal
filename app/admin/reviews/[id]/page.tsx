"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"
import type { ReviewAnnotation } from "@/types/database"

export default function AdminReviewDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [session, setSession]         = useState<any>(null)
  const [annotations, setAnnotations] = useState<ReviewAnnotation[]>([])
  const [allAnnotations, setAllAnnotations] = useState<ReviewAnnotation[]>([])
  const [selectedRound, setSelectedRound] = useState<number>(1)
  const [loading, setLoading]         = useState(true)
  const [sending, setSending]         = useState(false)
  const [sendNotes, setSendNotes]     = useState("")
  const [copied, setCopied]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [adminScroll, setAdminScroll] = useState<{ scrollY: number; pageHeight: number }>({ scrollY: 0, pageHeight: 0 })
  const [iframeRect, setIframeRect]   = useState<{ width: number; height: number }>({ width: 0, height: 0 })

  // Listen for scroll position from admin iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "cinq-scroll") {
        setAdminScroll({ scrollY: e.data.y ?? 0, pageHeight: e.data.h ?? 0 })
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  // Track iframe container size
  const iframeContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const rect = node.getBoundingClientRect()
      setIframeRect({ width: rect.width, height: rect.height })
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          setIframeRect({ width: entry.contentRect.width, height: entry.contentRect.height })
        }
      })
      observer.observe(node)
      return () => observer.disconnect()
    }
  }, [])

  useEffect(() => {
    async function load() {
      const { data: sess } = await supabase
        .from("review_sessions")
        .select("*, clients(name, contact_name, contact_email), projects(title)")
        .eq("id", params.id)
        .single()

      if (sess) {
        setSession(sess)
        setSelectedRound(sess.current_round)

        const { data: annots } = await supabase
          .from("review_annotations")
          .select("*")
          .eq("session_id", sess.id)
          .order("created_at")

        setAllAnnotations(annots ?? [])
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  // Filter annotations by selected round
  useEffect(() => {
    setAnnotations(allAnnotations.filter(a => a.round === selectedRound))
  }, [allAnnotations, selectedRound])

  async function handleResolveToggle(annotationId: string, resolved: boolean) {
    await fetch("/api/admin/resolve-annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annotationId, resolved }),
    })
    setAllAnnotations(prev =>
      prev.map(a => a.id === annotationId ? { ...a, resolved } : a)
    )
  }

  async function handleSendBack() {
    if (!session) return
    setSending(true)
    const res = await fetch("/api/admin/send-review-back", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, notes: sendNotes || undefined }),
    })
    const data = await res.json()
    if (data.ok) {
      setSession((s: any) => ({
        ...s,
        current_round: data.newRound,
        status: "in_review",
        submitted_at: null,
        viewed_at: null,
      }))
      setSelectedRound(data.newRound)
      setSendNotes("")
    }
    setSending(false)
  }

  function copyLink() {
    const url = `${window.location.origin}/review/${params.id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete() {
    if (!confirm("Delete this review and all its annotations? This cannot be undone.")) return
    setDeleting(true)
    await fetch("/api/admin/delete-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: params.id }),
    })
    router.push("/admin/reviews")
  }

  if (loading) {
    return (
      <>
        <PortalNav isAdmin />
        <main style={{ padding: "clamp(32px, 5vw, 48px)" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase" }}>Loading…</p>
        </main>
      </>
    )
  }

  if (!session) {
    return (
      <>
        <PortalNav isAdmin />
        <main style={{ padding: "clamp(32px, 5vw, 48px)" }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-body)", opacity: 0.65 }}>Review not found.</p>
        </main>
      </>
    )
  }

  const statusLabel: Record<string, string> = {
    in_review: "In review",
    revising: "Revising",
    approved: "Approved",
  }
  const statusColor: Record<string, string> = {
    in_review: "var(--amber)",
    revising: "var(--sage)",
    approved: "rgba(15,15,14,0.45)",
  }

  const rounds = Array.from({ length: session.current_round }, (_, i) => i + 1)
  const groupedByPage = annotations.reduce<Record<string, ReviewAnnotation[]>>((acc, a) => {
    const key = a.page_url
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 8,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: "var(--ink)", opacity: 0.4,
  }

  return (
    <>
      <PortalNav isAdmin />
      <main style={{ padding: "clamp(32px, 5vw, 48px)" }}>
        {/* Back link */}
        <Link href="/admin/reviews" style={{
          fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "var(--ink)", opacity: 0.4, textDecoration: "none",
          display: "block", marginBottom: 16,
        }}>← Reviews</Link>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{
              fontFamily: "var(--font-serif)", fontSize: "var(--text-title)",
              fontWeight: 400, color: "var(--ink)", opacity: 0.88, margin: "0 0 8px",
            }}>{session.clients?.name ?? "Review"}</h1>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <span style={labelStyle}>{session.projects?.title}</span>
              <span style={{ width: 0.5, height: 14, background: "rgba(15,15,14,0.12)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor[session.status] }} />
                <span style={labelStyle}>{statusLabel[session.status]}</span>
              </div>
              <span style={{ width: 0.5, height: 14, background: "rgba(15,15,14,0.12)" }} />
              <span style={{ ...labelStyle, opacity: 0.3 }}>{session.site_url}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copyLink} style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
              letterSpacing: "0.14em", textTransform: "uppercase",
              background: "none", color: "var(--ink)",
              padding: "10px 16px", cursor: "pointer",
              border: "0.5px solid rgba(15,15,14,0.15)",
              opacity: 0.55, transition: "opacity 0.2s",
            }}>{copied ? "Copied!" : "Copy review link"}</button>
            <button onClick={handleDelete} disabled={deleting} style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
              letterSpacing: "0.14em", textTransform: "uppercase",
              background: "none", color: "var(--danger, #c44)",
              padding: "10px 16px", cursor: "pointer",
              border: "0.5px solid rgba(200,60,60,0.2)",
              opacity: deleting ? 0.3 : 0.55, transition: "opacity 0.2s",
            }}>{deleting ? "Deleting…" : "Delete"}</button>
          </div>
        </div>

        {/* Round tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24 }}>
          {rounds.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRound(r)}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 8,
                letterSpacing: "0.14em", textTransform: "uppercase",
                padding: "8px 18px",
                border: "0.5px solid rgba(15,15,14,0.12)",
                borderRight: r < session.current_round ? "none" : undefined,
                cursor: "pointer",
                background: selectedRound === r ? "var(--ink)" : "transparent",
                color: selectedRound === r ? "#EDE8E0" : "var(--ink)",
                opacity: selectedRound === r ? 1 : 0.4,
                transition: "all 0.15s",
              }}
            >Round {r}</button>
          ))}
        </div>

        {/* Full-width iframe with annotation pin overlay */}
        <div
          ref={iframeContainerRef}
          style={{
            border: "0.5px solid rgba(15,15,14,0.1)",
            background: "#fff",
            overflow: "hidden",
            marginBottom: 32,
            height: "70vh",
            position: "relative",
          }}
        >
          <iframe
            src={session.site_url}
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
          {/* Pin overlay — shows pins at correct absolute positions based on iframe scroll */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
            {annotations.map((a, i) => {
              // Only show pins that have scroll tracking data
              if (a.scroll_y == null || a.viewport_h == null) {
                // Fallback: show at viewport-relative position (old annotations)
                return (
                  <div key={a.id} style={{
                    position: "absolute",
                    left: `${a.x_percent}%`,
                    top: `${a.y_percent}%`,
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "all",
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: a.resolved ? "rgba(15,15,14,0.35)" : "var(--ink)",
                      color: "#EDE8E0", fontFamily: "var(--font-mono)", fontSize: 9,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "2px solid rgba(255,255,255,0.9)",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                    }}>{i + 1}</div>
                  </div>
                )
              }

              // Calculate absolute Y position on the page (in pixels from top)
              const absY = a.scroll_y + (a.y_percent / 100 * a.viewport_h)
              // Check if pin is within the admin's current visible area
              const adminVH = iframeRect.height
              if (adminVH === 0) return null
              if (absY < adminScroll.scrollY || absY > adminScroll.scrollY + adminVH) return null

              // Calculate position on the overlay
              const topPx = absY - adminScroll.scrollY
              const topPercent = (topPx / adminVH) * 100

              return (
                <div key={a.id} style={{
                  position: "absolute",
                  left: `${a.x_percent}%`,
                  top: `${topPercent}%`,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "all",
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: a.resolved ? "rgba(15,15,14,0.35)" : "var(--ink)",
                    color: "#EDE8E0", fontFamily: "var(--font-mono)", fontSize: 9,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid rgba(255,255,255,0.9)",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                    cursor: "pointer",
                  }}>{i + 1}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Annotations list below */}
        <div style={{ maxWidth: 640 }}>
          <p style={{
            ...labelStyle, margin: "0 0 16px",
          }}>{annotations.length} annotation{annotations.length !== 1 ? "s" : ""} — Round {selectedRound}</p>

          {annotations.length === 0 ? (
            <p style={{
              fontFamily: "var(--font-serif)", fontSize: "var(--text-sm)",
              color: "var(--ink)", opacity: 0.45,
            }}>No annotations for this round yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {Object.entries(groupedByPage).map(([pageUrl, annots]) => (
                <div key={pageUrl}>
                  <p style={{
                    fontFamily: "var(--font-mono)", fontSize: 9,
                    color: "var(--ink)", opacity: 0.3, margin: "16px 0 8px",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{pageUrl}</p>
                  {annots.map((a) => {
                    const globalIndex = annotations.findIndex(ann => ann.id === a.id)
                    // Position labels
                    const xLabel = a.x_percent < 33 ? "Left" : a.x_percent > 66 ? "Right" : "Center"
                    // Use absolute position if scroll data is available
                    const absY = a.scroll_y != null && a.viewport_h
                      ? a.scroll_y + (a.y_percent / 100 * a.viewport_h)
                      : null
                    const posLabel = absY != null
                      ? `${Math.round(absY)}px from top · ${xLabel.toLowerCase()}`
                      : `${a.y_percent < 33 ? "Top" : a.y_percent > 66 ? "Bottom" : "Middle"} ${xLabel.toLowerCase()}`
                    return (
                      <div
                        key={a.id}
                        style={{
                          display: "flex", gap: 12, alignItems: "flex-start",
                          padding: "12px 0",
                          borderBottom: "0.5px solid rgba(15,15,14,0.06)",
                          opacity: a.resolved ? 0.4 : 1,
                          transition: "opacity 0.2s",
                        }}
                      >
                        {/* Pin number + position mini-map */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: a.resolved ? "rgba(15,15,14,0.3)" : "var(--ink)",
                            color: "#EDE8E0",
                            fontFamily: "var(--font-mono)", fontSize: 9,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>{globalIndex + 1}</div>
                          {/* Mini position indicator */}
                          <div style={{
                            width: 28, height: 18,
                            border: "0.5px solid rgba(15,15,14,0.15)",
                            background: "rgba(255,255,255,0.4)",
                            position: "relative",
                          }}>
                            <div style={{
                              position: "absolute",
                              left: `${a.x_percent}%`,
                              top: `${a.y_percent}%`,
                              transform: "translate(-50%, -50%)",
                              width: 4, height: 4, borderRadius: "50%",
                              background: a.resolved ? "rgba(15,15,14,0.3)" : "var(--ink)",
                            }} />
                          </div>
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontFamily: "var(--font-serif)", fontSize: "var(--text-body)",
                            color: "var(--ink)", opacity: 0.8, margin: 0, lineHeight: 1.6,
                            textDecoration: a.resolved ? "line-through" : "none",
                          }}>{a.comment}</p>
                          <p style={{
                            fontFamily: "var(--font-mono)", fontSize: 8,
                            color: "var(--ink)", opacity: 0.3, margin: "4px 0 0",
                          }}>
                            {posLabel} · {a.viewport_w}×{a.viewport_h} · {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>

                        {/* Resolve toggle */}
                        <button
                          onClick={() => handleResolveToggle(a.id, !a.resolved)}
                          style={{
                            fontFamily: "var(--font-mono)", fontSize: 8,
                            letterSpacing: "0.1em", textTransform: "uppercase",
                            background: "none", border: "none", cursor: "pointer",
                            color: a.resolved ? "var(--sage)" : "var(--ink)",
                            opacity: a.resolved ? 0.8 : 0.35,
                            padding: "2px 0", whiteSpace: "nowrap",
                          }}
                        >{a.resolved ? "Done" : "Resolve"}</button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Send back section */}
          {session.status === "revising" && (
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
              <p style={{ ...labelStyle, margin: "0 0 10px" }}>Send back for review</p>
              <textarea
                value={sendNotes}
                onChange={e => setSendNotes(e.target.value)}
                placeholder="Optional note to client about what changed…"
                rows={2}
                style={{
                  width: "100%", padding: "10px 12px",
                  fontFamily: "var(--font-serif)", fontSize: "var(--text-sm)",
                  color: "var(--ink)", background: "rgba(255,255,255,0.35)",
                  border: "0.5px solid rgba(15,15,14,0.1)", outline: "none",
                  boxSizing: "border-box", resize: "vertical",
                  marginBottom: 12,
                }}
              />
              <button
                onClick={handleSendBack}
                disabled={sending}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 8,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  background: "var(--ink)", color: "#EDE8E0",
                  padding: "12px 24px", border: "none", cursor: "pointer",
                  opacity: sending ? 0.3 : 1, transition: "opacity 0.2s",
                }}
              >{sending ? "Sending…" : "Send back to client"}</button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
