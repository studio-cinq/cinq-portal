import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

export default function AdminProposalsPage() {
  return (
    <>
      <PortalNav isAdmin />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>
        <div style={{ fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 36 }}>
          Proposals
        </div>
        <div style={{ padding: "64px 0", textAlign: "center", opacity: 0.35, fontSize: 12 }}>
          Proposals coming soon.
        </div>
      </main>
    </>
  )
}
