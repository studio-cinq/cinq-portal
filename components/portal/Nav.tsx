"use client"
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
]

const mono: React.CSSProperties = {
  fontFamily: "'Matter SemiMono', 'DM Mono', monospace",
}

export default function PortalNav({ clientName, isAdmin }: NavProps) {
  const pathname = usePathname()
  const links    = isAdmin ? ADMIN_LINKS : CLIENT_LINKS

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 48px",
      height: 64,
      borderBottom: "0.5px solid rgba(15,15,14,0.1)",
      background: "rgba(244,241,236,0.95)",
      backdropFilter: "blur(8px)",
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxSizing: "border-box",
    }}>

      {/* Logo */}
      <Link href={isAdmin ? "/admin/studio" : "/dashboard"} style={{ display: "flex" }}>
        <CinqLogo width={20} />
      </Link>

      {/* Nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        {links.map(link => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/")
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                ...mono,
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#0F0F0E",
                opacity: active ? 0.75 : 0.38,
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

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {isAdmin && (
          <span style={{
            ...mono,
            fontSize: 8,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#0F0F0E",
            opacity: 0.35,
            border: "0.5px solid rgba(15,15,14,0.15)",
            padding: "4px 10px",
          }}>
            Studio admin
          </span>
        )}
        {clientName && (
          <span style={{
            ...mono,
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#0F0F0E",
            opacity: 0.35,
          }}>
            {clientName}
          </span>
        )}
        <button
          onClick={handleSignOut}
          style={{
            ...mono,
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#0F0F0E",
            opacity: 0.32,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
