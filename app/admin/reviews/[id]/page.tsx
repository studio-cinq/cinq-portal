"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, useParams } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

interface Annotation {
  id: string
  x_percent: number
  y_percent: number
  comment: string
  resolved: boolean
  created_at: string
  round: number
}

export default function AdminReviewDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [session, setSession] = useState<any>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Next round state
  const [showNextRound, setShowNextRound] = useState(false)
  const [nextNotes, setNextNotes] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("review_sessions")
        .select("*, clients(name, contact_name, contact_email), projects(title)")
        .eq("id", params.id)
        .single()

      if (data) {
        setSession(data)
        setNextNotes((data as any).notes ?? "")
        const { data: pins } = await supabase
          .from("review_annotations")
          .select("*")
          .eq("session_id", data.id)
          .eq("round", (data as any).current_round)
          .order("created_at")
        setAnnotations(pins ?? [])
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  async function toggleResolve(id: string, current: boolean) {
    await fetch("/api/review/resolve-annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annotationId: id, resolved: !current }),
    })
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, resolved: !current } : a))
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/review/${params.id}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete() {
    if (!confirm("Delete this review session and all annotations? This cannot be undone.")) return
    setDeleting(true)
    await fetch("/api/review/delete-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: params.id }),
    })
    router.push("/admin/reviews")
    router.refresh()
  }

  async function handleSendNextRound() {
    setSending(true)
    await fetch("/api/review/next-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: params.id,
        screenshotUrl: session.screenshot_url ?? "",
        notes: nextNotes,
      }),
    })

    // Reload
    const { data } = await supabase
      .from("review_sessions")
      .select("*, clients(name, contact_name, contact_email), projects(title)")
      .eq("id", params.id).single()
    if (data) {
      setSession(data)
      setAnnotations([])
      setShowNextRound(false)
    }
    setSending(false)
  }

  if (loading) return (
    <>
      <PortalNav isAdmin />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>Loading…</div>
      </div>
    </>
  )

  if (!session) return (
    <>
      <PortalNav isAdmin />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-lg)", opacity: 0.5 }}>Review not found.</div>
      </div>
    </>
  )

  const client = session.clients as any
  const project = session.projects as any
  const resolved = annotations.filter(a => a.resolved).length
  const total = annotations.length

  return (
    <>
      <PortalNav isAdmin />
      <main style={{ maxWidth: 1060, margin: "0 auto", padding: "40px 48px 80px" }}>

        <Link href="/admin/reviews" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Reviews
        </Link>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 10 }}>
              {client?.name ?? "—"} · Round {session.current_round}
            </div>
            <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 26, opacity: 0.88, letterSpacing: "-0.015em", margin: 0 }}>
              {project?.title ?? session.site_url}
            </h1>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "6px 12px", border: "0.5px solid rgba(15,15,14,0.15)",
              color: session.status === "approved" ? "var(--sage)" : session.status === "revising" ? "var(--ink)" : "var(--amber)",
            }}>
              {session.status === "in_review" ? "In review" : session.status === "revising" ? "Revising" : "Approved"}
            </span>
            <button onClick={handleCopyLink} style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase",
              background: "none", border: "0.5px solid rgba(15,15,14,0.15)", padding: "6px 12px",
              cursor: "pointer", color: "var(--ink)", opacity: 0.5,
            }}>
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button onClick={handleDelete} disabled={deleting} style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase",
              background: "none", border: "0.5px solid rgba(15,15,14,0.15)", padding: "6px 12px",
              cursor: "pointer", color: "var(--danger)", opacity: 0.6,
            }}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", gap: 32, marginBottom: 32, flexWrap: "wrap" }}>
          {[
            { label: "Client", value: client?.contact_name ?? client?.name ?? "—" },
            { label: "Site", value: session.site_url },
            { label: "Created", value: new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
            ...(session.viewed_at ? [{ label: "Viewed", value: new Date(session.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) }] : []),
            ...(total > 0 ? [{ label: "Progress", value: `${resolved}/${total} resolved` }] : []),
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.7, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Site preview */}
        <div style={{ border: "0.5px solid rgba(15,15,14,0.1)", marginBottom: 32, background: "#fff" }}>
          <iframe
            src={session.site_url}
            style={{ width: "100%", height: "70vh", border: "none", display: "block" }}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>

        {/* Annotations list */}
        {total > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.42, marginBottom: 16 }}>
              Annotations · Round {session.current_round}
            </div>
            {annotations.map((ann, i) => (
              <div key={ann.id} style={{
                display: "flex", alignItems: "flex-start", gap: 16, padding: "16px 0",
                borderBottom: "0.5px solid rgba(15,15,14,0.07)",
                opacity: ann.resolved ? 0.45 : 1, transition: "opacity 0.2s",
              }}>
                {/* Pin number */}
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: ann.resolved ? "var(--sage)" : "var(--ink)",
                  color: "#EDE8E0", fontFamily: "var(--font-mono)", fontSize: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 2,
                }}>
                  {ann.resolved ? "✓" : i + 1}
                </div>

                {/* Comment */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.82, margin: 0, lineHeight: 1.6, textDecoration: ann.resolved ? "line-through" : "none" }}>
                    {ann.comment}
                  </p>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.35, marginTop: 4 }}>
                    {new Date(ann.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>

                {/* Resolve toggle */}
                <button onClick={() => toggleResolve(ann.id, ann.resolved)} style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase",
                  background: "none", border: "0.5px solid rgba(15,15,14,0.15)", padding: "5px 12px",
                  cursor: "pointer", color: ann.resolved ? "var(--sage)" : "var(--ink)", opacity: ann.resolved ? 0.8 : 0.4,
                  flexShrink: 0,
                }}>
                  {ann.resolved ? "Resolved" : "Resolve"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Send next round */}
        {session.status === "revising" && (
          <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)", paddingTop: 32 }}>
            {!showNextRound ? (
              <button onClick={() => setShowNextRound(true)} style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
                background: "var(--ink)", color: "var(--cream)", border: "none", padding: "14px 28px", cursor: "pointer",
              }}>
                Send next round →
              </button>
            ) : (
              <div style={{ maxWidth: 500 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.42, marginBottom: 16 }}>
                  Round {(session.current_round ?? 1) + 1}
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, marginBottom: 8 }}>
                    Note for client <span style={{ opacity: 0.5 }}>(optional)</span>
                  </div>
                  <textarea
                    value={nextNotes}
                    onChange={e => setNextNotes(e.target.value)}
                    placeholder="Here's what changed…"
                    rows={3}
                    style={{
                      width: "100%", boxSizing: "border-box", padding: "10px 12px",
                      fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                      color: "var(--ink)", background: "rgba(255,255,255,0.3)",
                      border: "0.5px solid rgba(15,15,14,0.12)", outline: "none", resize: "none", lineHeight: 1.7,
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={handleSendNextRound} disabled={sending} style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
                    background: "var(--ink)", color: "var(--cream)", border: "none", padding: "14px 28px",
                    cursor: sending ? "default" : "pointer",
                    opacity: sending ? 0.4 : 1,
                  }}>
                    {sending ? "Sending…" : "Send to client"}
                  </button>
                  <button onClick={() => setShowNextRound(false)} style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
                    background: "none", color: "var(--ink)", border: "none", padding: "14px 0", cursor: "pointer", opacity: 0.35,
                  }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}
