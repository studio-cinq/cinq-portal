"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import DownloadPDFButton from "@/components/portal/DownloadPDFButton"
import DeleteButton from "@/components/portal/DeleteButton"

/**
 * Per-row overflow popover for the invoices index. Holds the rare actions
 * (Edit, Download PDF, Delete) so the inline row keeps only Mark paid +
 * Send reminder + View, depending on status.
 */
export default function InvoiceOverflowMenu({
  invoiceId, invoiceNumber,
}: { invoiceId: string; invoiceNumber: string }) {
  const [open, setOpen] = useState(false)
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

  return (
    <div ref={ref} style={{ position: "relative" }}>
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
            background: "var(--cream, #F5F1EA)",
            border: "0.5px solid rgba(15,15,14,0.18)",
            boxShadow: "0 4px 16px rgba(15,15,14,0.08)",
            padding: "6px 0",
            zIndex: 10,
          }}
        >
          <Link
            href={`/admin/invoices/${invoiceId}/edit`}
            role="menuitem"
            onClick={() => setOpen(false)}
            style={menuItemStyle}
          >
            Edit
          </Link>
          <div role="menuitem" style={{ ...menuItemStyle, padding: 0 }}>
            <DownloadPDFButton type="invoice" id={invoiceId} label="Download PDF" />
          </div>
          <div style={{ height: 1, background: "rgba(15,15,14,0.08)", margin: "4px 0" }} />
          <div role="menuitem" style={{ ...menuItemStyle, padding: "8px 14px" }}>
            <DeleteButton
              endpoint="/api/admin/delete/invoice"
              id={invoiceId}
              confirm={`Delete invoice #${invoiceNumber}? This cannot be undone.`}
              label="Delete"
            />
          </div>
        </div>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  padding: "8px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink)",
  opacity: 0.75,
  textDecoration: "none",
  cursor: "pointer",
}
