"use client"

import { useState } from "react"

interface ReviewToolbarProps {
  projectTitle: string
  clientName: string
  siteUrl: string
  currentPageUrl: string
  onPageUrlChange: (url: string) => void
  mode: "browse" | "comment"
  onModeChange: (mode: "browse" | "comment") => void
  round: number
  pinCount: number
  onSubmit: () => void
  onApprove: () => void
  submitting: boolean
  approving: boolean
  notes?: string
}

export default function ReviewToolbar({
  projectTitle,
  currentPageUrl,
  onPageUrlChange,
  mode,
  onModeChange,
  round,
  pinCount,
  onSubmit,
  onApprove,
  submitting,
  approving,
  notes,
}: ReviewToolbarProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      {/* Floating bottom bar */}
      <div style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}>
        {/* Expanded panel — URL field */}
        {expanded && (
          <div style={{
            background: "rgba(250,248,245,0.98)",
            border: "0.5px solid rgba(15,15,14,0.12)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            padding: "12px 16px",
            width: 420,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "var(--ink)", opacity: 0.35, whiteSpace: "nowrap",
              }}>Page URL</span>
              <input
                type="text"
                value={currentPageUrl}
                onChange={e => onPageUrlChange(e.target.value)}
                style={{
                  flex: 1, padding: "6px 10px",
                  fontFamily: "var(--font-mono)", fontSize: 10,
                  color: "var(--ink)", opacity: 0.6,
                  background: "rgba(255,255,255,0.4)",
                  border: "0.5px solid rgba(15,15,14,0.08)",
                  outline: "none", boxSizing: "border-box",
                }}
                placeholder="Paste URL if you navigated"
              />
            </div>
            <p style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              color: "var(--ink)", opacity: 0.3, margin: 0,
            }}>If you navigated to a different page, paste the URL above so we know which page your notes are on.</p>

            {/* Notes from admin */}
            {notes && (
              <div style={{
                borderTop: "0.5px solid rgba(15,15,14,0.08)",
                paddingTop: 8, marginTop: 4,
              }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "var(--ink)", opacity: 0.35,
                }}>Note from Kacie</span>
                <p style={{
                  fontFamily: "var(--font-serif)", fontSize: "var(--text-sm)",
                  color: "var(--ink)", opacity: 0.6, margin: "4px 0 0", lineHeight: 1.5,
                }}>{notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Main pill bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: "rgba(250,248,245,0.98)",
          border: "0.5px solid rgba(15,15,14,0.12)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
          padding: "6px 6px",
          borderRadius: 40,
        }}>
          {/* Project + round label */}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--ink)", opacity: 0.4,
              background: "none", border: "none", cursor: "pointer",
              padding: "6px 12px", whiteSpace: "nowrap",
            }}
          >
            {projectTitle} · R{round}
            {notes && <span style={{
              display: "inline-block", width: 5, height: 5, borderRadius: "50%",
              background: "var(--amber)", marginLeft: 6, verticalAlign: "middle",
            }} />}
          </button>

          <span style={{ width: 0.5, height: 16, background: "rgba(15,15,14,0.1)" }} />

          {/* Mode toggle */}
          <div style={{ display: "flex", overflow: "hidden", borderRadius: 20 }}>
            {(["browse", "comment"] as const).map(m => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 9,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  padding: "6px 14px",
                  border: "none", cursor: "pointer",
                  borderRadius: 20,
                  background: mode === m ? "var(--ink)" : "transparent",
                  color: mode === m ? "#EDE8E0" : "var(--ink)",
                  opacity: mode === m ? 1 : 0.4,
                  transition: "all 0.15s",
                }}
              >{m === "browse" ? "Browse" : `Comment${pinCount > 0 ? ` (${pinCount})` : ""}`}</button>
            ))}
          </div>

          <span style={{ width: 0.5, height: 16, background: "rgba(15,15,14,0.1)" }} />

          {/* Submit */}
          <button
            onClick={onSubmit}
            disabled={submitting || pinCount === 0}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              letterSpacing: "0.12em", textTransform: "uppercase",
              background: "var(--ink)", color: "#EDE8E0",
              padding: "6px 14px", border: "none", cursor: "pointer",
              borderRadius: 20,
              opacity: submitting || pinCount === 0 ? 0.25 : 1,
              transition: "opacity 0.2s", whiteSpace: "nowrap",
            }}
          >{submitting ? "Sending…" : "Submit"}</button>

          {/* Approve */}
          <button
            onClick={onApprove}
            disabled={approving}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              letterSpacing: "0.12em", textTransform: "uppercase",
              background: "none", color: "var(--ink)",
              padding: "6px 12px", cursor: "pointer",
              border: "0.5px solid rgba(15,15,14,0.15)",
              borderRadius: 20,
              opacity: approving ? 0.25 : 0.5,
              transition: "opacity 0.2s", whiteSpace: "nowrap",
            }}
          >{approving ? "Approving…" : "Approve"}</button>
        </div>
      </div>
    </>
  )
}
