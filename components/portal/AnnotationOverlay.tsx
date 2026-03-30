"use client"

import type { ReviewAnnotation } from "@/types/database"
import AnnotationPin from "./AnnotationPin"
import AnnotationForm from "./AnnotationForm"

interface AnnotationOverlayProps {
  annotations: ReviewAnnotation[]
  mode: "browse" | "comment"
  pendingPin: { x: number; y: number } | null
  onClickOverlay: (x: number, y: number, pxX?: number, pxY?: number) => void
  onSavePin: (comment: string) => void
  onCancelPin: () => void
  onDeletePin?: (id: string) => void
  readOnly?: boolean
}

export default function AnnotationOverlay({
  annotations,
  mode,
  pendingPin,
  onClickOverlay,
  onSavePin,
  onCancelPin,
  onDeletePin,
  readOnly,
}: AnnotationOverlayProps) {
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "comment" || readOnly) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    // Pass raw pixel positions relative to the iframe for position querying
    const pxX = e.clientX - rect.left
    const pxY = e.clientY - rect.top
    onClickOverlay(x, y, pxX, pxY)
  }

  return (
    <div
      onClick={handleClick}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: mode === "comment" ? "all" : "none",
        cursor: mode === "comment" ? "crosshair" : "default",
        zIndex: mode === "comment" ? 5 : 1,
      }}
    >
      {/* Existing pins — always visible */}
      {annotations.map((a, i) => (
        <AnnotationPin
          key={a.id}
          annotation={a}
          index={i}
          onDelete={onDeletePin}
          readOnly={readOnly}
        />
      ))}

      {/* Pending pin form */}
      {pendingPin && (
        <AnnotationForm
          x={pendingPin.x}
          y={pendingPin.y}
          onSave={onSavePin}
          onCancel={onCancelPin}
        />
      )}

      {/* Comment mode visual indicator */}
      {mode === "comment" && !readOnly && (
        <div style={{
          position: "absolute",
          inset: 0,
          border: "2px solid var(--amber)",
          pointerEvents: "none",
          opacity: 0.4,
        }} />
      )}
    </div>
  )
}
