"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { ReviewSession, ReviewAnnotation } from "@/types/database"
import ReviewToolbar from "@/components/portal/ReviewToolbar"
import AnnotationOverlay from "@/components/portal/AnnotationOverlay"

export default function ReviewPage({ params }: { params: { id: string } }) {
  const [session, setSession]         = useState<(ReviewSession & { clients?: any; projects?: any }) | null>(null)
  const [annotations, setAnnotations] = useState<ReviewAnnotation[]>([])
  const [mode, setMode]               = useState<"browse" | "comment">("browse")
  const [pendingPin, setPendingPin]   = useState<{ x: number; y: number } | null>(null)
  const [currentPageUrl, setCurrentPageUrl] = useState("")
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [approving, setApproving]     = useState(false)

  // Load session + annotations
  useEffect(() => {
    async function load() {
      const { data: sess } = await supabase
        .from("review_sessions")
        .select("*, clients(name, contact_name), projects(title)")
        .eq("id", params.id)
        .single()

      if (sess) {
        setSession(sess as any)
        setCurrentPageUrl(sess.site_url)

        // Load annotations for current round
        const { data: annots } = await supabase
          .from("review_annotations")
          .select("*")
          .eq("session_id", sess.id)
          .eq("round", sess.current_round)
          .order("created_at")

        setAnnotations(annots ?? [])

        // Track view
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

  const handleClickOverlay = useCallback((x: number, y: number) => {
    setPendingPin({ x, y })
  }, [])

  async function handleSavePin(comment: string) {
    if (!session || !pendingPin) return

    const res = await fetch("/api/review/save-annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        pageUrl: currentPageUrl,
        xPercent: pendingPin.x,
        yPercent: pendingPin.y,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        comment,
      }),
    })
    const data = await res.json()
    if (data.annotation) {
      setAnnotations(prev => [...prev, data.annotation])
    }
    setPendingPin(null)
  }

  async function handleDeletePin(id: string) {
    await fetch("/api/review/delete-annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annotationId: id }),
    })
    setAnnotations(prev => prev.filter(a => a.id !== id))
  }

  async function handleSubmit() {
    if (!session) return
    setSubmitting(true)
    await fetch("/api/review/submit-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    })
    setSession(s => s ? { ...s, status: "revising" as const } : s)
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
    setSession(s => s ? { ...s, status: "approved" as const } : s)
    setApproving(false)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--cream)",
      }}>
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
          letterSpacing: "0.14em", textTransform: "uppercase",
          color: "var(--ink)", opacity: 0.4,
        }}>Loading review…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--cream)",
      }}>
        <p style={{
          fontFamily: "var(--font-serif)", fontSize: "var(--text-lg)",
          color: "var(--ink)", opacity: 0.65,
        }}>Review not found.</p>
      </div>
    )
  }

  // Waiting state — feedback submitted, admin is revising
  if (session.status === "revising") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "var(--cream)", padding: 40, textAlign: "center",
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: "50%",
          background: "var(--sage)", marginBottom: 16,
        }} />
        <h1 style={{
          fontFamily: "var(--font-serif)", fontSize: "var(--text-title)",
          fontWeight: 400, color: "var(--ink)", opacity: 0.85, margin: "0 0 12px",
        }}>Feedback received</h1>
        <p style={{
          fontFamily: "var(--font-serif)", fontSize: "var(--text-body)",
          color: "var(--ink)", opacity: 0.55, maxWidth: 400, lineHeight: 1.7,
        }}>
          Your notes are being reviewed and changes are underway.
          You'll receive an email when the next round is ready.
        </p>
        <div style={{
          marginTop: 32, padding: "12px 20px",
          background: "rgba(255,255,255,0.3)",
          border: "0.5px solid rgba(15,15,14,0.08)",
        }}>
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 8,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--ink)", opacity: 0.35, margin: "0 0 4px",
          }}>Round {session.current_round} — {annotations.length} note{annotations.length !== 1 ? "s" : ""} submitted</p>
        </div>
      </div>
    )
  }

  // Approved state
  if (session.status === "approved") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "var(--cream)", padding: 40, textAlign: "center",
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: "50%",
          background: "var(--sage)", marginBottom: 16,
        }} />
        <h1 style={{
          fontFamily: "var(--font-serif)", fontSize: "var(--text-title)",
          fontWeight: 400, color: "var(--ink)", opacity: 0.85, margin: "0 0 12px",
        }}>Site approved</h1>
        <p style={{
          fontFamily: "var(--font-serif)", fontSize: "var(--text-body)",
          color: "var(--ink)", opacity: 0.55, maxWidth: 400, lineHeight: 1.7,
        }}>
          This website has been approved. Thank you for your review!
        </p>
      </div>
    )
  }

  // Active review state
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--cream)" }}>
      <ReviewToolbar
        projectTitle={session.projects?.title ?? "Website Review"}
        clientName={session.clients?.name ?? ""}
        siteUrl={session.site_url}
        currentPageUrl={currentPageUrl}
        onPageUrlChange={setCurrentPageUrl}
        mode={mode}
        onModeChange={setMode}
        round={session.current_round}
        pinCount={annotations.length}
        onSubmit={handleSubmit}
        onApprove={handleApprove}
        submitting={submitting}
        approving={approving}
        notes={session.notes ?? undefined}
      />

      {/* Iframe + overlay container */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <iframe
          src={session.site_url}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
          }}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
        <AnnotationOverlay
          annotations={annotations}
          mode={mode}
          pendingPin={pendingPin}
          onClickOverlay={handleClickOverlay}
          onSavePin={handleSavePin}
          onCancelPin={() => setPendingPin(null)}
          onDeletePin={handleDeletePin}
        />
      </div>
    </div>
  )
}
