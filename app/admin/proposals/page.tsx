"use client"

import { useState } from "react"
import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"

export default async function AdminProposalsPage() {
  const supabase = await createServerComponentClient()

  const { data: proposalsRaw } = await supabase
    .from("proposals")
    .select("*, clients(name), proposal_items(price)")
    .order("created_at", { ascending: false })

  const proposals = proposalsRaw as any[] | null

  return (
    <>
      <PortalNav isAdmin />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }}>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5 }}>
            Proposals — {proposals?.length ?? 0}
          </div>
          <Link href="/admin/proposals/new" style={{
            fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
            color: "#0F0F0E", opacity: 0.6, textDecoration: "none",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
          }}>
            + New proposal
          </Link>
        </div>

        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px 100px 110px 80px 80px", gap: 16, paddingBottom: 10, borderBottom: "0.5px solid rgba(15,15,14,0.12)" }}>
          {["Proposal", "Client", "Value", "Expires", "Viewed", "Status", ""].map(h => (
            <div key={h} style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45 }}>{h}</div>
          ))}
        </div>

        {proposals?.map(proposal => {
          const total = proposal.proposal_items?.reduce((s: number, i: any) => s + (i.price ?? 0), 0) ?? 0
          const isExpired = proposal.expires_at && new Date(proposal.expires_at) < new Date()

          return (
            <div
              key={proposal.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 160px 120px 100px 110px 80px 80px",
                gap: 16, alignItems: "center",
                padding: "16px 0",
                borderBottom: "0.5px solid rgba(15,15,14,0.08)",
              }}
            >
              <Link href={`/admin/proposals/${proposal.id}`} style={{ textDecoration: "none" }}>
                <div style={{ fontSize: 13, fontWeight: 300, opacity: 0.88 }}>{proposal.title}</div>
                {proposal.subtitle && <div style={{ fontSize: 9, opacity: 0.45, marginTop: 2 }}>{proposal.subtitle}</div>}
              </Link>
              <div style={{ fontSize: 11, opacity: 0.65 }}>{proposal.clients?.name}</div>
              <div style={{ fontSize: 13, fontWeight: 300, opacity: 0.75 }}>${Math.round(total / 100).toLocaleString()}</div>
              <div style={{ fontSize: 10, opacity: isExpired ? 0.35 : 0.55, color: isExpired ? "#c0392b" : "#0F0F0E" }}>
                {proposal.expires_at ? new Date(proposal.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
              </div>
              <div style={{ fontSize: 10 }}>
                {proposal.viewed_at
                  ? <span style={{ color: "#6B8F71", opacity: 0.8 }}>Viewed {new Date(proposal.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  : <span style={{ opacity: 0.35 }}>Not yet viewed</span>
                }
              </div>
              <ProposalStatus status={proposal.status} />
              <CopyLinkButton id={proposal.id} />
            </div>
          )
        })}

        {(!proposals || proposals.length === 0) && (
          <div style={{ padding: "48px 0", fontSize: 12, opacity: 0.35, textAlign: "center" }}>
            No proposals yet.
          </div>
        )}

      </main>
    </>
  )
}

function ProposalStatus({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft:    "rgba(15,15,14,0.35)",
    sent:     "#B07D3A",
    accepted: "#6B8F71",
    declined: "#c0392b",
  }
  return (
    <span style={{ fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)" }}>
      {status}
    </span>
  )
}

function CopyLinkButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(`https://portal.studiocinq.com/proposals/${id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
        color: copied ? "#6B8F71" : "#0F0F0E",
        opacity: copied ? 0.8 : 0.4,
        background: "none", border: "0.5px solid rgba(15,15,14,0.15)",
        padding: "5px 10px", cursor: "pointer",
        fontFamily: "inherit", transition: "all 0.2s",
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  )
}
