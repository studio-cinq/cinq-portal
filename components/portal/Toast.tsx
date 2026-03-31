"use client"

import { useState, useCallback, useEffect } from "react"

interface Toast {
  id: number
  message: string
  type: "success" | "info" | "error"
}

let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, type: "success" | "info" | "error" = "success") => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const ToastContainer = useCallback(() => (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id))
        }} />
      ))}
    </div>
  ), [toasts])

  return { show, ToastContainer }
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true))

    // Start exit animation before removal
    const timer = setTimeout(() => setVisible(false), 2600)
    return () => clearTimeout(timer)
  }, [])

  const colors = {
    success: { bg: "rgba(143,167,181,0.12)", border: "rgba(143,167,181,0.25)", text: "var(--sage)" },
    info:    { bg: "rgba(15,15,14,0.06)", border: "rgba(15,15,14,0.12)", text: "var(--ink)" },
    error:   { bg: "rgba(192,57,43,0.08)", border: "rgba(192,57,43,0.2)", text: "var(--danger)" },
  }

  const c = colors[toast.type]

  return (
    <div
      onClick={onDismiss}
      style={{
        background: c.bg,
        backdropFilter: "blur(12px)",
        border: `0.5px solid ${c.border}`,
        padding: "10px 18px",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-eyebrow)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: c.text,
        opacity: visible ? 0.9 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "all 0.3s ease",
        pointerEvents: "auto",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {toast.type === "success" && "✓ "}{toast.message}
    </div>
  )
}
