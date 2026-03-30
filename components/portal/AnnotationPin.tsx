"use client"

import { useState } from "react"
import type { ReviewAnnotation } from "@/types/database"

interface AnnotationPinProps {
  annotation: ReviewAnnotation
  index: number
  onDelete?: (id: string) => void
  readOnly?: boolean
}

export default function AnnotationPin({ annotation, index, onDelete, readOnly }: AnnotationPinProps) {
  const [showComment, setShowComment] = useState(false)

  return (
    <div
      style={{
        position: "absolute",
        left: `${annotation.x_percent}%`,
        top: `${annotation.y_percent}%`,
        transform: "translate(-50%, -50%)",
        zIndex: 10,
      }}
    >
      {/* Pin circle */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowComment(!showComment) }}
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: annotation.resolved ? "rgba(15,15,14,0.35)" : "var(--ink)",
          color: "#EDE8E0",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid rgba(255,255,255,0.9)",
          cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          transition: "transform 0.15s",
          padding: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.15)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        {index + 1}
      </button>

      {/* Comment popover */}
      {showComment && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 32,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(250,248,245,0.98)",
            border: "0.5px solid rgba(15,15,14,0.12)",
            padding: "12px 16px",
            minWidth: 200,
            maxWidth: 280,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            backdropFilter: "blur(12px)",
            zIndex: 20,
          }}
        >
          <p style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-body)",
            color: "var(--ink)",
            opacity: 0.85,
            margin: 0,
            lineHeight: 1.5,
          }}>{annotation.comment}</p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink)",
              opacity: 0.35,
            }}>
              {new Date(annotation.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
            {!readOnly && onDelete && (
              <button
                onClick={() => onDelete(annotation.id)}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--danger)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  opacity: 0.7,
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
