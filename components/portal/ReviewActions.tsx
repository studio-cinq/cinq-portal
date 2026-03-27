"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

interface Props {
  projectId:          string
  deliverableId:      string
  revisionsRemaining: number
}

export default function ReviewActions({ projectId, deliverableId, revisionsRemaining }: Props) {
  const router              = useRouter()
  const [feedback, setFeedback] = useState("")
  const [loading, setLoading]   = useState(false)

  async function handleApprove() {
    setLoading(true)
    await supabase
      .from("deliverables")
      .update({ status: "approved" })
      .eq("id", deliverableId)

    if (feedback.trim()) {
      await supabase.from("messages").insert({
        project_id:  projectId,
        from_client: true,
        sender_name: "Client",
        body:        `Approved. Notes: ${feedback}`,
        read:        false,
      })
    }

    // Log to decision log
    await supabase.from("decision_log").insert({
      project_id: projectId,
      entry:      `${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })} — Deliverable approved by client.`,
      logged_at:  new Date().toISOString(),
    })

    setLoading(false)
    router.push(`/projects/${projectId}`)
    router.refresh()
  }

  async function handleRevision() {
    if (!feedback.trim()) return
    setLoading(true)
  
    const { data: current } = await supabase
      .from("deliverables")
      .select("revision_used")
      .eq("id", deliverableId)
      .single()
  
    await supabase
      .from("deliverables")
      .update({ revision_used: ((current as any)?.revision_used ?? 0) + 1, status: "in_progress" })
      .eq("id", deliverableId)

    await supabase.from("messages").insert({
      project_id:  projectId,
      from_client: true,
      sender_name: "Client",
      body:        `Revision requested: ${feedback}`,
      read:        false,
    })

    setLoading(false)
    router.push(`/projects/${projectId}`)
    router.refresh()
  }

  return (
    <>
      {/* Feedback col */}
      <div style={{ padding: "24px 28px", borderRight: "0.5px solid rgba(15,15,14,0.08)" }}>
        <div style={barLabel}>Leave feedback</div>
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          placeholder="Share specific notes, questions, or direction for the next round…"
          rows={3}
          style={{
            width: "100%", boxSizing: "border-box",
            background: "rgba(255,255,255,0.35)",
            border: "0.5px solid rgba(15,15,14,0.12)",
            padding: "10px 12px",
            fontFamily: "var(--font-sans)",
            fontSize: 11, fontWeight: 300,
            color: "var(--ink)", resize: "none", outline: "none",
            marginBottom: 8,
          }}
        />
        <div style={{ fontSize: 8, color: "var(--ink)", opacity: 0.22, letterSpacing: "0.04em", lineHeight: 1.6 }}>
          {revisionsRemaining} revision round{revisionsRemaining !== 1 ? "s" : ""} remaining after this one.
        </div>
      </div>

      {/* Approve col */}
      <div style={{ padding: "24px 28px" }}>
        <div style={barLabel}>Your decision</div>
        <div style={{ fontSize: 10, color: "var(--ink)", opacity: 0.38, lineHeight: 1.6, marginBottom: 16 }}>
          Approving confirms this direction and moves the project to the next deliverable.
        </div>
        <button
          onClick={handleApprove}
          disabled={loading}
          style={{
            width: "100%", boxSizing: "border-box",
            background: "var(--ink)", border: "none", padding: 13,
            fontFamily: "var(--font-sans)", fontSize: 9,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: "#EDE8E0", cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.4 : 1, marginBottom: 8,
          }}
        >
          Approve this direction
        </button>
        <button
          onClick={handleRevision}
          disabled={loading || !feedback.trim() || revisionsRemaining <= 0}
          style={{
            width: "100%", boxSizing: "border-box",
            background: "transparent",
            border: "0.5px solid rgba(15,15,14,0.15)",
            padding: 11,
            fontFamily: "var(--font-sans)", fontSize: 9,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--ink)",
            opacity: loading || !feedback.trim() || revisionsRemaining <= 0 ? 0.22 : 0.42,
            cursor: loading || !feedback.trim() || revisionsRemaining <= 0 ? "default" : "pointer",
          }}
        >
          {revisionsRemaining <= 0 ? "No revisions remaining" : "Request a revision instead"}
        </button>
      </div>
    </>
  )
}

const barLabel: React.CSSProperties = {
  fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase",
  color: "var(--ink)", opacity: 0.28, marginBottom: 12,
}
