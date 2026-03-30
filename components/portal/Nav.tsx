"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import CinqLogo from "@/components/CinqLogo"
import { supabase } from "@/lib/supabase"

interface NavProps {
  clientName?: string
  isAdmin?: boolean
}

const CLIENT_LINKS = [
  { href: "/dashboard", label: "Projects" },
  { href: "/invoices",  label: "Invoices" },
  { href: "/library",   label: "Files"    },
]

const ADMIN_LINKS = [
  { href: "/admin/studio",    label: "Studio"    },
  { href: "/admin/clients",   label: "Clients"   },
  { href: "/admin/proposals", label: "Proposals" },
  { href: "/admin/invoices",  label: "Invoices"  },
  { href: "/admin/calendar",  label: "Calendar"  },
  { href: "/admin/reviews",   label: "Reviews"   },
]

export default function PortalNav({ clientName, isAdmin }: NavProps) {
  const pathname  = usePathname()
  const links     = isAdmin ? ADMIN_LINKS : CLIENT_LINKS
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <>
      <nav style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: "var(--nav-h)",
        borderBottom: "0.5px solid rgba(15,15,14,0.1)",
        background: "rgba(244,241,236,0.95)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxSizing: "border-box",
      }}>
        <Link href={isAdmin ? "/admin/studio" : "/dashboard"} style={{ display: "flex" }}>
          <CinqLogo width={20} />
        </Link>

        {/* Desktop nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }} className="nav-links-desktop">
          {links.map(link => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/")
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-eyebrow)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--ink)",
                  opacity: active ? 0.75 : "var(--op-faint)",
                  textDecoration: "none",
                  borderBottom: active ? "0.5px solid rgba(15,15,14,0.45)" : "0.5px solid transparent",
                  paddingBottom: 1,
                  transition: "opacity 0.2s",
                }}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Desktop right */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }} className="nav-right-desktop">
          {isAdmin && (
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-eyebrow)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink)",
              opacity: 0.35,
              border: "0.5px solid rgba(15,15,14,0.15)",
              padding: "4px 10px",
            }}>
              Studio admin
            </span>
          )}
          {clientName && (
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-eyebrow)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink)",
              opacity: 0.35,
            }}>
              {clientName}
            </span>
          )}
          <button
            onClick={handleSignOut}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-eyebrow)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink)",
              opacity: "var(--op-ghost)" as any,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Sign out
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setOpen(o => !o)}
          style={{
            display: "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            flexDirection: "column",
            gap: 5,
          }}
        >
          <span style={{ display: "block", width: 20, height: 0.5, background: "var(--ink)", opacity: open ? 0 : 0.6, transition: "opacity 0.2s" }} />
          <span style={{ display: "block", width: 20, height: 0.5, background: "var(--ink)", opacity: 0.6 }} />
          <span style={{ display: "block", width: 20, height: 0.5, background: "var(--ink)", opacity: open ? 0 : 0.6, transition: "opacity 0.2s" }} />
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div
          className="nav-mobile-menu"
          style={{
            display: "none",
            position: "fixed", top: "var(--nav-h)", left: 0, right: 0, zIndex: 99,
            background: "rgba(244,241,236,0.98)",
            borderBottom: "0.5px solid rgba(15,15,14,0.1)",
            backdropFilter: "blur(8px)",
            padding: "12px 0 20px",
          }}
        >
          {links.map(link => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/")
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                style={{
                  fontFamily: "var(--font-mono)",
                  display: "block",
                  padding: "14px 24px",
                  fontSize: "var(--text-sm)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--ink)",
                  opacity: active ? 0.88 : "var(--op-faint)" as any,
                  textDecoration: "none",
                  borderBottom: "0.5px solid rgba(15,15,14,0.06)",
                }}
              >
                {link.label}
              </Link>
            )
          })}
          <button
            onClick={handleSignOut}
            style={{
              fontFamily: "var(--font-mono)",
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "14px 24px",
              fontSize: "var(--text-sm)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--ink)",
              opacity: 0.32,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </>
  )
}