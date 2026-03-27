import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import CopyLinkButton from "@/components/portal/CopyLinkButton"
import DeleteButton from "@/components/portal/DeleteButton"

export default async function AdminProposalsPage() {
  const supabase = await createServerComponentClient()

  const { data: proposalsRaw } = await supabase
    .from("proposals").select("*, clients(name), proposal_items(price)")
    .order("created_at", { ascending: false })
  const proposals = proposalsRaw as any[] | null

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5 }}>
            Proposals — {proposals?.length ?? 0}
          </div>
          <Link href="/admin/proposals/new" style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--ink)", opacity: 0.6, textDecoration: "none",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
          }}>
            + New proposal
          </Link>
        </div>

        <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px 100px 110px 80px 100px 60px", gap: 16, paddingBottom: 10, borderBottom: "0.5px solid rgba(15,15,14,0.12)" }}>
          {["Proposal", "Client", "Value", "Expires", "Viewed", "Status", "", ""].map(h => (
            <div key={h} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45 }}>{h}</div>
          ))}
        </div>

        {proposals?.map(proposal => {
          const total = proposal.proposal_items?.reduce((s: number, i: any) => s + (i.price ?? 0), 0) ?? 0
          const isExpired = proposal.expires_at && new Date(proposal.expires_at) < new Date()

          return (
            <div
              key={proposal.id}
              className="admin-proposal-row"
              style={{
                display: "grid", gridTemplateColumns: "1fr 160px 120px 100px 110px 80px 100px 60px",
                gap: 16, alignItems: "center", padding: "16px 0",
                borderBottom: "0.5px solid rgba(15,15,14,0.08)",
              }}
            >
              <Link href={`/admin/proposals/${proposal.id}`} style={{ textDecoration: "none" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-full)" as any }}>{proposal.title}</div>
                {proposal.subtitle && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any, marginTop: 2 }}>{proposal.subtitle}</div>}
              </Link>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-muted)" as any }}>{proposal.clients?.name}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-body)" as any }}>${Math.round(total / 100).toLocaleString()}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: isExpired ? 0.35 : "var(--op-muted)" as any, color: isExpired ? "var(--danger)" : "var(--ink)" }}>
                {proposal.expires_at ? new Date(proposal.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)" }}>
                {proposal.viewed_at
                  ? <span style={{ color: "var(--sage)", opacity: 0.8 }}>Viewed {new Date(proposal.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  : <span style={{ opacity: 0.35 }}>Not yet viewed</span>
                }
              </div>
              <ProposalStatus status={proposal.status} />
              <CopyLinkButton id={proposal.id} />
              <DeleteButton endpoint="/api/admin/delete/proposal" id={proposal.id} confirm={`Delete "${proposal.title}"? This cannot be undone.`} />
            </div>
          )
        })}

        {(!proposals || proposals.length === 0) && (
          <div style={{ padding: "48px 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-ghost)" as any, textAlign: "center" }}>
            No proposals yet — <a href="/admin/proposals/new" style={{ opacity: 0.6, textDecoration: "none", borderBottom: "0.5px solid rgba(15,15,14,0.2)" }}>create your first proposal</a> to send to a client.
          </div>
        )}
      </main>
    </>
  )
}

function ProposalStatus({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft:    "rgba(15,15,14,0.35)",
    sent:     "var(--amber)",
    accepted: "var(--sage)",
    declined: "var(--danger)",
  }
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)" }}>
      {status}
    </span>
  )
}