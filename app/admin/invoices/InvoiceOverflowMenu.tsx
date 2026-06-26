"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

/**
 * Per-row overflow popover for the invoices index. Holds the rare actions
 * (Edit, Download PDF, Delete). Menu items are plain rows that share one
 * visual treatment; we don't reuse the standalone button components here
 * because their built-in styling fights the menu layout.
 */
export default function InvoiceOverflowMenu({
  invoiceId, invoiceNumber,
}: { invoiceId: string; invoiceNumber: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  async function handleDownload() {
    setOpen(false)
    window.open(`/api/pdf/invoice/${invoiceId}`, "_blank", "noopener,noreferrer")
  }

  async function handleCopyLink() {
    const base = typeof window !== "undefined" ? window.location.origin : "https://portal.studiocinq.com"
    try {
      await navigator.clipboard.writeText(`${base}/invoice/${invoiceId}`)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setOpen(false)
      }, 1100)
    } catch {
      // clipboard not available (insecure context) — fall back silently
      setOpen(false)
    }
  }

  async function handleDuplicate() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/admin/duplicate/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceId }),
      })
      const json = await res.json()
      if (!res.ok || !json.id) throw new Error(json.error ?? "Duplicate failed")
      setOpen(false)
      // Land on the edit page so Kacie can set the new invoice_number + due date.
      window.location.href = `/admin/invoices/${json.id}/edit`
    } catch (err) {
      console.error("[invoice duplicate]", err)
      alert("Couldn't duplicate that invoice.")
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (busy) return
    if (!confirm(`Delete invoice #${invoiceNumber}? This cannot be undone.`)) return
    setBusy(true)
    try {
      const res = await fetch("/api/admin/delete/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceId }),
      })
      if (!res.ok) throw new Error("Delete failed")
      setOpen(false)
      router.refresh()
    } catch (err) {
      console.error("[invoice delete]", err)
      alert("Couldn't delete that invoice.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        // Raise the row this menu lives in above sibling rows while the
        // popover is open so absolutely-positioned items render on top.
        zIndex: open ? 20 : "auto",
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={`More actions for invoice #${invoiceNumber}`}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          letterSpacing: "0.1em",
          color: "var(--ink)",
          background: "transparent",
          border: "none",
          opacity: 0.45,
          cursor: "pointer",
          padding: "6px 10px",
          lineHeight: 1,
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
            // Solid surface — distinct from the page cream so rows behind
            // don't bleed through.
            background: "#FFFCF4",
            border: "0.5px solid rgba(15,15,14,0.18)",
            boxShadow: "0 8px 24px rgba(15,15,14,0.12)",
            padding: "4px 0",
            zIndex: 30,
          }}
        >
          <Link
            href={`/admin/invoices/${invoiceId}/edit`}
            role="menuitem"
            onClick={() => setOpen(false)}
            style={itemStyle()}
          >
            Edit
          </Link>
          <Link
            href={`/invoice/${invoiceId}`}
            role="menuitem"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={itemStyle()}
          >
            View as client ↗
          </Link>
          <button role="menuitem" onClick={handleCopyLink} style={itemStyle()}>
            {copied ? "Link copied ✓" : "Copy client link"}
          </button>
          <button role="menuitem" onClick={handleDownload} style={itemStyle()}>
            Download PDF
          </button>
          <div style={{ height: 1, background: "rgba(15,15,14,0.08)", margin: "4px 0" }} />
          <button
            role="menuitem"
            onClick={handleDuplicate}
            disabled={busy}
            style={itemStyle()}
          >
            {busy ? "Duplicating…" : "Duplicate as draft"}
          </button>
          <div style={{ height: 1, background: "rgba(15,15,14,0.08)", margin: "4px 0" }} />
          <button
            role="menuitem"
            onClick={handleDelete}
            disabled={busy}
            style={itemStyle("danger")}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}
    </div>
  )
}

function itemStyle(tone?: "danger"): React.CSSProperties {
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
    color: tone === "danger" ? "var(--danger)" : "var(--ink)",
    opacity: tone === "danger" ? 0.95 : 0.78,
    background: "transparent",
    border: "none",
    textDecoration: "none",
    cursor: "pointer",
    lineHeight: 1.4,
  }
}
