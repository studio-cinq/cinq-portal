"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export type OverflowItem =
  | { kind: "link"; label: string; href: string; tone?: "default" | "danger" }
  | { kind: "action"; label: string; onClick: () => Promise<void> | void; tone?: "default" | "danger"; busyLabel?: string }
  | { kind: "delete"; label?: string; endpoint: string; id: string; confirm: string; redirectTo?: string }
  | { kind: "divider" }

/**
 * Reusable per-row overflow popover. Holds rare or destructive actions
 * behind ··· so list rows stay scannable. Pattern is the same as the
 * invoice list — Edit / Download / Delete tucked away, with Delete in
 * the alarm tone behind a confirm.
 */
export default function RowOverflowMenu({
  ariaLabel, items,
}: {
  /** e.g. "More actions for {client.name}" */
  ariaLabel: string
  items: OverflowItem[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  async function runAction(i: number, run: () => Promise<void> | void) {
    if (busy != null) return
    setBusy(i)
    try { await run() } finally { setBusy(null); setOpen(false) }
  }

  async function runDelete(i: number, item: Extract<OverflowItem, { kind: "delete" }>) {
    if (busy != null) return
    if (!confirm(item.confirm)) return
    setBusy(i)
    try {
      const res = await fetch(item.endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      if (!res.ok) throw new Error("Delete failed")
      setOpen(false)
      if (item.redirectTo) {
        window.location.href = item.redirectTo
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error("[overflow delete]", err)
      alert("Couldn't delete that.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", zIndex: open ? 20 : "auto" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          fontFamily: "var(--font-mono)", fontSize: 14, letterSpacing: "0.1em",
          color: "var(--ink)", background: "transparent", border: "none",
          opacity: 0.45, cursor: "pointer", padding: "6px 10px", lineHeight: 1,
        }}
      >
        •••
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 180,
            background: "#FFFCF4",
            border: "0.5px solid rgba(26,24,21,0.18)",
            boxShadow: "0 8px 24px rgba(26,24,21,0.12)",
            padding: "4px 0",
            zIndex: 30,
          }}
        >
          {items.map((item, i) => {
            if (item.kind === "divider") {
              return <div key={`d-${i}`} style={{ height: 1, background: "var(--hairline, rgba(26,24,21,0.08))", margin: "4px 0" }} />
            }
            const tone = ("tone" in item ? item.tone : item.kind === "delete" ? "danger" : "default") as "default" | "danger" | undefined
            if (item.kind === "link") {
              return (
                <Link
                  key={i}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  style={itemStyle(tone)}
                >
                  {item.label}
                </Link>
              )
            }
            if (item.kind === "action") {
              return (
                <button
                  key={i}
                  role="menuitem"
                  onClick={() => runAction(i, item.onClick)}
                  disabled={busy === i}
                  style={itemStyle(tone)}
                >
                  {busy === i ? item.busyLabel ?? "Working…" : item.label}
                </button>
              )
            }
            // delete
            return (
              <button
                key={i}
                role="menuitem"
                onClick={() => runDelete(i, item)}
                disabled={busy === i}
                style={itemStyle("danger")}
              >
                {busy === i ? "Deleting…" : item.label ?? "Delete"}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function itemStyle(tone: "default" | "danger" | undefined): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    boxSizing: "border-box",
    padding: "8px 14px",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: tone === "danger" ? "var(--alarm)" : "var(--ink)",
    opacity: tone === "danger" ? 0.95 : 0.78,
    background: "transparent",
    border: "none",
    textDecoration: "none",
    cursor: "pointer",
    lineHeight: 1.4,
  }
}
