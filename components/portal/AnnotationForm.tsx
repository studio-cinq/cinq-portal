"use client"

import { useState } from "react"

interface AnnotationFormProps {
  x: number
  y: number
  onSave: (comment: string) => void
  onCancel: () => void
}

export default function AnnotationForm({ x, y, onSave, onCancel }: AnnotationFormProps) {
  const [comment, setComment] = useState("")

  function handleSave() {
    if (!comment.trim()) return
    onSave(comment.trim())
  }

  // Position the form near the click, but keep it within bounds
  const formStyle: React.CSSProperties = {
    position: "absolute",
    left: `${Math.min(x, 75)}%`,
    top: `${y}%`,
    transform: "translate(-50%, 16px)",
    background: "rgba(250,248,245,0.98)",
    border: "0.5px solid rgba(15,15,14,0.12)",
    padding: "16px",
    width: 260,
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    backdropFilter: "blur(12px)",
    zIndex: 30,
  }

  return (
    <div style={formStyle} onClick={e => e.stopPropagation()}>
      {/* Small pin indicator */}
      <div style={{
        width: 20, height: 20, borderRadius: "50%",
        background: "var(--ink)", color: "#EDE8E0",
        fontFamily: "var(--font-mono)", fontSize: 9,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 10,
        border: "2px solid rgba(255,255,255,0.9)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}>+</div>

      <label style={{
        fontFamily: "var(--font-mono)",
        fontSize: 8,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--ink)",
        opacity: 0.4,
        display: "block",
        marginBottom: 6,
      }}>Your note</label>

      <textarea
        autoFocus
        value={comment}
        onChange={e => setComment(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave() }
          if (e.key === "Escape") onCancel()
        }}
        placeholder="What would you like changed here?"
        rows={3}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-body)",
          color: "var(--ink)",
          background: "rgba(255,255,255,0.4)",
          border: "0.5px solid rgba(15,15,14,0.1)",
          outline: "none",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={handleSave}
          disabled={!comment.trim()}
          style={{
            fontFamily: "var(--font-mono)", fontSize: 8,
            letterSpacing: "0.14em", textTransform: "uppercase",
            background: "var(--ink)", color: "#EDE8E0",
            padding: "8px 16px", border: "none", cursor: "pointer",
            opacity: !comment.trim() ? 0.3 : 1, transition: "opacity 0.2s",
          }}
        >Save pin</button>
        <button
          onClick={onCancel}
          style={{
            fontFamily: "var(--font-mono)", fontSize: 8,
            letterSpacing: "0.14em", textTransform: "uppercase",
            background: "none", color: "var(--ink)",
            padding: "8px 12px", cursor: "pointer",
            border: "0.5px solid rgba(15,15,14,0.15)",
            opacity: 0.6,
          }}
        >Cancel</button>
      </div>
    </div>
  )
}
