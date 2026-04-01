import { createServerComponentClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import CopyLinkButton from "@/components/portal/CopyLinkButton"
import DownloadPDFButton from "@/components/portal/DownloadPDFButton"
import ResendProposalButton from "@/components/portal/ResendProposalButton"

export default async function AdminProposalDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerComponentClient()

  const { data: proposalRaw } = await supabase
    .from("proposals")
    .select("*, clients(name, contact_name, contact_email), proposal_items(*)")
    .eq("id", params.id)
    .single()

  if (!proposalRaw) notFound()

  const proposal = proposalRaw as any
  const client   = proposal.clients as any
  const items    = (proposal.proposal_items as any[]).sort((a, b) => a.sort_order - b.sort_order)

  const baseItems     = items.filter(i => !i.is_optional)
  const optionalItems = items.filter(i => i.is_optional)
  const baseTotal     = baseItems.reduce((s: number, i: any) => s + (i.price ?? 0), 0)
  const optionalTotal = optionalItems.reduce((s: number, i: any) => s + (i.price ?? 0), 0)
  const schedule      = Array.isArray(proposal.payment_schedule) ? proposal.payment_schedule as number[] : [50, 50]
  const depositPct    = schedule[0] ?? 50
  const deposit       = Math.round(baseTotal * (depositPct / 100))

  const isExpired  = proposal.expires_at && new Date(proposal.expires_at) < new Date()
  const isAccepted = proposal.status === "accepted"

  const statusColors: Record<string, string> = {
    draft:    "rgba(15,15,14,0.35)",
    sent:     "#c95a3b",
    accepted: "#8fa7b5",
    declined: "#c0392b",
  }

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 48px 80px" }}>

        {/* Back */}
        <Link href="/admin/proposals" style={{
          fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
          opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 32,
          fontFamily: "'Matter SemiMono', monospace",
        }}>
          ← Proposals
        </Link>

        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.38, marginBottom: 10, fontFamily: "'Matter SemiMono', monospace" }}>
              Proposal
            </div>
            <h1 style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontWeight: 400, fontSize: 26, opacity: 0.9, letterSpacing: "-0.015em", margin: "0 0 6px" }}>
              {proposal.title}
            </h1>
            {proposal.subtitle && (
              <div style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 14, opacity: 0.5 }}>
                {proposal.subtitle}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <Link
              href={`/admin/proposals/${proposal.id}/edit`}
              style={{
                fontFamily: "'Matter SemiMono', monospace",
                fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                color: "#0F0F0E", textDecoration: "none",
                border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
                opacity: 0.6,
              }}
            >
              Edit
            </Link>
            <DownloadPDFButton type="proposal" id={proposal.id} />
            <ResendProposalButton proposalId={proposal.id} />
            <CopyLinkButton id={proposal.id} />
            <Link
              href={`/proposals/${proposal.id}`}
              target="_blank"
              style={{
                fontFamily: "'Matter SemiMono', monospace",
                fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                color: "#0F0F0E", textDecoration: "none",
                border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
                opacity: 0.6,
              }}
            >
              Client view ↗
            </Link>
          </div>
        </div>

        {/* Meta grid */}
        <div className="admin-stats-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 0, marginBottom: 48,
          border: "0.5px solid rgba(15,15,14,0.1)",
        }}>
          {[
            { label: "Client", value: client?.name ?? "—" },
            { label: "Contact", value: client ? `${client.contact_name}` : "—", sub: client?.contact_email },
            {
              label: "Status",
              value: proposal.status,
              color: statusColors[proposal.status],
            },
            {
              label: "First viewed",
              value: proposal.viewed_at
                ? new Date(proposal.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Not yet",
              color: proposal.viewed_at ? "#8fa7b5" : undefined,
            },
            {
              label: "Last viewed",
              value: proposal.last_viewed_at
                ? new Date(proposal.last_viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
                : proposal.viewed_at ? "Same as first" : "—",
              color: proposal.last_viewed_at ? "#8fa7b5" : undefined,
            },
            {
              label: "Sent",
              value: new Date(proposal.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            },
            {
              label: "Expires",
              value: proposal.expires_at
                ? new Date(proposal.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "—",
              color: isExpired ? "#c0392b" : undefined,
            },
            {
              label: "Base total",
              value: `$${(baseTotal / 100).toLocaleString()}`,
            },
            {
              label: `Deposit (${depositPct}%)`,
              value: `$${(deposit / 100).toLocaleString()}`,
            },
          ].map((cell, i, arr) => (
            <div key={i} style={{
              padding: "16px 20px",
              borderRight: (i + 1) % 4 !== 0 ? "0.5px solid rgba(15,15,14,0.1)" : "none",
              borderBottom: i < arr.length - (arr.length % 4 || 4) ? "0.5px solid rgba(15,15,14,0.1)" : "none",
            }}>
              <div style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.4, marginBottom: 6 }}>
                {cell.label}
              </div>
              <div style={{
  textTransform: cell.label === "Status" ? "uppercase" : "none",
  letterSpacing: cell.label === "Status" ? "0.08em" : "-0.01em",
  fontSize: cell.label === "Status" ? 9 : 13,
  fontFamily: cell.label === "Status" ? "'Matter SemiMono', monospace" : "'Söhne', 'Inter', system-ui, sans-serif",
  opacity: (cell as any).color ? 1 : 0.8,
  color: (cell as any).color ?? "#0F0F0E",
} as any}>
  {cell.value}
</div>
              {(cell as any).sub && (
                <div style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, opacity: 0.4, marginTop: 2 }}>
                  {(cell as any).sub}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="layout-grid" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 48, alignItems: "start" }}>

          {/* Left — content */}
          <div>

            {/* Overview */}
            {proposal.overview && (
              <div style={{ marginBottom: 40 }}>
                <SectionLabel>Overview</SectionLabel>
                <div style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 14, lineHeight: 1.85, opacity: 0.7, whiteSpace: "pre-wrap" }}>
                  {proposal.overview}
                </div>
              </div>
            )}

            {/* Base scope */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <SectionLabel>Scope</SectionLabel>
                <div style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, opacity: 0.38 }}>
                  Base estimate: ${(baseTotal / 100).toLocaleString()}
                </div>
              </div>
              {baseItems.map((item: any) => <LineItemRow key={item.id} item={item} />)}
            </div>

            {/* Optional add-ons */}
            {optionalItems.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                  <SectionLabel>Additional add-ons</SectionLabel>
                  <div style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, opacity: 0.38 }}>
                    +${(optionalTotal / 100).toLocaleString()} if added
                  </div>
                </div>
                {optionalItems.map((item: any) => <LineItemRow key={item.id} item={item} />)}
              </div>
            )}

            {/* Closing */}
            {proposal.closing && (
              <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.1)", paddingTop: 32 }}>
                <SectionLabel>Closing</SectionLabel>
                <div style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 14, lineHeight: 1.85, opacity: 0.65, whiteSpace: "pre-wrap" }}>
                  {proposal.closing}
                </div>
              </div>
            )}

          </div>

          {/* Right — summary panel */}
          <div style={{
            border: "0.5px solid rgba(15,15,14,0.1)",
            padding: "24px 24px 28px",
            position: "sticky", top: 80,
          }}>
            <div style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.4, marginBottom: 20 }}>
              Summary
            </div>

            {items.map((item: any) => {
              const declined = isAccepted && !item.accepted && !item.is_required
              return (
                <div key={item.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  padding: "8px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)",
                  opacity: declined ? 0.35 : 1,
                  textDecoration: declined ? "line-through" : "none",
                }}>
                  <div>
                    <span style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 12, opacity: item.is_optional && !declined ? 0.45 : 0.75 }}>
                      {item.name}
                    </span>
                    {isAccepted && item.accepted && item.phase === "later" && (
                      <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, opacity: 0.5, marginLeft: 6, letterSpacing: "0.08em" }}>phase 2</span>
                    )}
                    {isAccepted && item.accepted && item.phase === "now" && !item.is_required && (
                      <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, color: "#8fa7b5", marginLeft: 6, letterSpacing: "0.08em" }}>priority</span>
                    )}
                    {!isAccepted && item.is_optional && (
                      <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, opacity: 0.4, marginLeft: 6, letterSpacing: "0.08em" }}>optional</span>
                    )}
                    {item.is_recommended && !isAccepted && (
                      <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, color: "#b5a042", marginLeft: 6, letterSpacing: "0.08em" }}>rec.</span>
                    )}
                  </div>
                  <span style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 12, opacity: declined ? 0.4 : (item.is_optional ? 0.4 : 0.7) }}>
                    ${(item.price / 100).toLocaleString()}
                  </span>
                </div>
              )
            })}

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "0.5px solid rgba(15,15,14,0.12)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, opacity: 0.45, letterSpacing: "0.08em", textTransform: "uppercase" }}>Base total</span>
                <span style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 18, opacity: 0.88 }}>${(baseTotal / 100).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, opacity: 0.35 }}>Deposit ({depositPct}%)</span>
                <span style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 13, opacity: 0.55 }}>${(deposit / 100).toLocaleString()}</span>
              </div>
              {optionalTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "0.5px solid rgba(15,15,14,0.07)" }}>
                  <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, opacity: 0.35 }}>With add-ons</span>
                  <span style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 13, opacity: 0.45 }}>${((baseTotal + optionalTotal) / 100).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Client note if accepted */}
            {proposal.client_note && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "0.5px solid rgba(15,15,14,0.1)" }}>
                <div style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.4, marginBottom: 8 }}>
                  Client note
                </div>
                <div style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 13, opacity: 0.65, lineHeight: 1.7, fontStyle: "italic" }}>
                  "{proposal.client_note}"
                </div>
              </div>
            )}

            {/* Stripe session if accepted */}
            {proposal.stripe_session_id && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.4, marginBottom: 6 }}>
                  Stripe session
                </div>
                <div style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, opacity: 0.4, wordBreak: "break-all" }}>
                  {proposal.stripe_session_id}
                </div>
              </div>
            )}
          </div>
        </div>

      </main>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'Matter SemiMono', monospace",
      fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
      opacity: 0.38, marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

function LineItemRow({ item }: { item: any }) {
  return (
    <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)", padding: "18px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 15, opacity: 0.85, letterSpacing: "-0.01em" }}>
              {item.name}
            </span>
            {item.is_required && (
              <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink)", border: "0.5px solid rgba(15,15,14,0.2)", padding: "2px 7px" }}>
                Required
              </span>
            )}
            {item.is_recommended && (
              <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#b5a042", border: "0.5px solid rgba(232,200,91,0.4)", padding: "2px 7px" }}>
                Recommended
              </span>
            )}
            {item.is_optional && (
              <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#c95a3b", border: "0.5px solid rgba(201,90,59,0.35)", padding: "2px 7px" }}>
                Optional
              </span>
            )}
          </div>
          {item.description && (
            <div style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 13, opacity: 0.55, lineHeight: 1.75 }}>
              {item.description}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 15, opacity: 0.8, letterSpacing: "-0.01em" }}>
            ${(item.price / 100).toLocaleString()}
          </div>
          <div style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, opacity: 0.35, marginTop: 4 }}>
            {item.timeline_weeks_min === 0 && item.timeline_weeks_max === 0 ? "Ongoing" : `${item.timeline_weeks_min}–${item.timeline_weeks_max} wks`}
          </div>
        </div>
      </div>
    </div>
  )
}