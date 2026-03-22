"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import PortalNav from "@/components/portal/Nav"
import Link from "next/link"

const mono: React.CSSProperties = { fontFamily: "'Matter SemiMono', 'DM Mono', monospace" }
const serif: React.CSSProperties = { fontFamily: "'PP Writer', 'Cormorant Garamond', Georgia, serif" }

const TABS = ["Project", "Presentation", "Invoices", "Proposal"]

const statusColors: Record<string, string> = {
  not_started:      "rgba(15,15,14,0.3)",
  in_progress:      "#B07D3A",
  awaiting_approval:"#B07D3A",
  approved:         "#6B8F71",
  complete:         "#6B8F71",
}
const statusLabels: Record<string, string> = {
  not_started:      "Not started",
  in_progress:      "In progress",
  awaiting_approval:"Awaiting approval",
  approved:         "Approved",
  complete:         "Complete",
}

export default function AdminClientWorkspacePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading]               = useState(true)
  const [client, setClient]                 = useState<any>(null)
  const [projects, setProjects]             = useState<any[]>([])
  const [invoices, setInvoices]             = useState<any[]>([])
  const [messages, setMessages]             = useState<any[]>([])
  const [proposals, setProposals]           = useState<any[]>([])
  const [decisionLog, setDecisionLog]       = useState<any[]>([])
  const [slides, setSlides]                 = useState<any[]>([])
  const [activeTab, setActiveTab]           = useState(0)
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [logInput, setLogInput]             = useState("")
  const [replyText, setReplyText]           = useState("")
  const [replyProjectId, setReplyProjectId] = useState<string>("")
  const [sendingReply, setSendingReply]     = useState(false)
  const [inviting, setInviting]             = useState(false)
const [inviteStatus, setInviteStatus]     = useState<"idle" | "sent">("idle")

  useEffect(() => { loadAll() }, [params.id])

  useEffect(() => {
    if (selectedProject) {
      loadDecisionLog(selectedProject.id)
      loadSlides(selectedProject.id)
      setReplyProjectId(selectedProject.id)
    }
  }, [selectedProject?.id])

  async function loadAll() {
    setLoading(true)

    const { data: c } = await supabase.from("clients").select("*").eq("id", params.id).single()
    if (!c) { setLoading(false); return }
    setClient(c)

    const { data: proj } = await supabase
      .from("projects")
      .select("*, deliverables(*)")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false })
    const ps = proj ?? []
    setProjects(ps)
    if (ps.length > 0) setSelectedProject(ps[0])

    const { data: inv } = await supabase
      .from("invoices")
      .select("*")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false })
    setInvoices(inv ?? [])

    const projectIds = ps.map((p: any) => p.id)
    if (projectIds.length > 0) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*, projects(title)")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(30)
      setMessages(msgs ?? [])
    }

    const { data: props } = await supabase
      .from("proposals")
      .select("*, proposal_items(*)")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false })
    setProposals(props ?? [])

    setLoading(false)
  }

  async function loadDecisionLog(projectId: string) {
    const { data } = await supabase
      .from("decision_log")
      .select("*")
      .eq("project_id", projectId)
      .order("logged_at", { ascending: false })
    setDecisionLog(data ?? [])
  }

  async function loadSlides(projectId: string) {
    const { data } = await supabase
      .from("presentation_slides")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order")
    setSlides(data ?? [])
  }

  async function updateDeliverableStatus(deliverableId: string, status: string) {
    await supabase.from("deliverables").update({ status }).eq("id", deliverableId)
    setProjects(ps => ps.map(p => ({
      ...p,
      deliverables: p.deliverables?.map((d: any) =>
        d.id === deliverableId ? { ...d, status } : d
      )
    })))
  }

  async function addLogEntry() {
    if (!logInput.trim() || !selectedProject) return
    const { data } = await supabase
      .from("decision_log")
      .insert({ project_id: selectedProject.id, entry: logInput.trim() })
      .select()
      .single()
    if (data) setDecisionLog(prev => [data, ...prev])
    setLogInput("")
  }

  async function deleteLogEntry(id: string) {
    await supabase.from("decision_log").delete().eq("id", id)
    setDecisionLog(prev => prev.filter(e => e.id !== id))
  }

  async function sendReply() {
    if (!replyText.trim() || !replyProjectId) return
    setSendingReply(true)
    const { data } = await supabase
      .from("messages")
      .insert({
        project_id:  replyProjectId,
        from_client: false,
        sender_name: "Studio Cinq",
        body:        replyText.trim(),
        read:        true,
      })
      .select("*, projects(title)")
      .single()
    if (data) setMessages(prev => [data, ...prev])
    setReplyText("")
    setSendingReply(false)
  }

  if (loading) return (
    <>
      <PortalNav isAdmin />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ ...mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>Loading…</div>
      </div>
    </>
  )

  if (!client) return (
    <>
      <PortalNav isAdmin />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ ...serif, fontSize: 14, opacity: 0.5 }}>Client not found.</div>
      </div>
    </>
  )

  // Financials
  const collected   = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0)
  const outstanding = invoices.filter(i => ["sent","overdue"].includes(i.status)).reduce((s, i) => s + i.amount, 0)
  const onDelivery  = invoices.filter(i => i.status === "draft").reduce((s, i) => s + i.amount, 0)
  const contractVal = collected + outstanding + onDelivery

  // Selected project deliverables
  const deliverables = (selectedProject?.deliverables ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)

  // Latest proposal
  const latestProposal = proposals[0]
  const acceptedItems  = latestProposal?.proposal_items?.filter((i: any) => i.accepted) ?? []
  const laterItems     = latestProposal?.proposal_items?.filter((i: any) => i.phase === "later") ?? []

  return (
    <>
      <PortalNav isAdmin />

      {/* Client header */}
      <div style={{
        borderBottom: "0.5px solid rgba(15,15,14,0.08)",
        background: "rgba(244,241,236,0.5)",
        padding: "20px 48px 0",
      }}>
        <Link href="/admin/clients" style={{ ...mono, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.35, textDecoration: "none", display: "inline-block", marginBottom: 12 }}>
          ← Clients
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <h1 style={{ ...serif, fontWeight: 400, fontSize: 24, opacity: 0.9, letterSpacing: "-0.015em", marginBottom: 4 }}>
              {client.name}
            </h1>
            <div style={{ ...mono, fontSize: 9, opacity: 0.45 }}>
              {client.contact_name} &nbsp;·&nbsp; {client.contact_email}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, paddingBottom: 20 }}>
            <Link href={`/admin/invoices/new?client=${params.id}`} style={actionBtn}>
              + Invoice
            </Link>
            <Link href={`/admin/proposals/new?client=${params.id}`} style={{ ...actionBtn, background: "#0F0F0E", color: "#F4F1EC", opacity: 1 }}>
              + Proposal
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              style={{
                ...mono,
                fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                padding: "10px 20px",
                background: "transparent", border: "none",
                borderBottom: activeTab === i ? "1.5px solid #0F0F0E" : "1.5px solid transparent",
                cursor: "pointer",
                opacity: activeTab === i ? 0.88 : 0.5,
                color: "#0F0F0E",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", minHeight: "calc(100vh - 180px)", maxWidth: 1400, margin: "0 auto" }}>

        {/* Left — tab content */}
        <div style={{ padding: "32px 40px 60px", borderRight: "0.5px solid rgba(15,15,14,0.08)" }}>

          {/* Project selector if multiple projects */}
          {projects.length > 1 && (
            <div style={{ marginBottom: 24 }}>
              <select
                value={selectedProject?.id ?? ""}
                onChange={e => setSelectedProject(projects.find(p => p.id === e.target.value))}
                style={{ ...mono, fontSize: 9, background: "transparent", border: "0.5px solid rgba(15,15,14,0.15)", padding: "7px 12px", color: "#0F0F0E", outline: "none", cursor: "pointer" }}
              >
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          )}

          {/* ── Tab 0: Project ── */}
          {activeTab === 0 && (
            <div>
              {!selectedProject ? (
                <div style={{ ...serif, fontSize: 13, opacity: 0.4, paddingTop: 32 }}>
                  No projects yet. <Link href={`/admin/projects/new?client=${params.id}`} style={{ opacity: 0.6 }}>Create one →</Link>
                </div>
              ) : (
                <>
                  {/* Project info */}
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <div style={{ ...serif, fontSize: 18, opacity: 0.88, letterSpacing: "-0.01em" }}>{selectedProject.title}</div>
                      <ProjectStatusBadge status={selectedProject.status} />
                    </div>
                    {selectedProject.scope && (
                      <div style={{ ...serif, fontSize: 13, opacity: 0.5, lineHeight: 1.6 }}>{selectedProject.scope}</div>
                    )}
                    {selectedProject.total_weeks && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ ...mono, fontSize: 8, opacity: 0.4 }}>Week {selectedProject.current_week ?? 0} of {selectedProject.total_weeks}</span>
                          <span style={{ ...mono, fontSize: 8, opacity: 0.4 }}>{Math.round(((selectedProject.current_week ?? 0) / selectedProject.total_weeks) * 100)}%</span>
                        </div>
                        <div style={{ height: 1.5, background: "rgba(15,15,14,0.1)" }}>
                          <div style={{ height: 1.5, width: `${Math.round(((selectedProject.current_week ?? 0) / selectedProject.total_weeks) * 100)}%`, background: "#0F0F0E", opacity: 0.4 }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Deliverables */}
                  <div style={{ marginBottom: 40 }}>
                    <SectionHeader label="Deliverables" />
                    {deliverables.length === 0 ? (
                      <div style={{ ...serif, fontSize: 13, opacity: 0.35, padding: "16px 0" }}>No deliverables yet.</div>
                    ) : deliverables.map((del: any) => (
                      <div key={del.id} style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)", padding: "14px 0" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ ...serif, fontSize: 14, opacity: 0.85, marginBottom: 4 }}>{del.name}</div>
                            {del.description && (
                              <div style={{ ...serif, fontSize: 12, opacity: 0.45, lineHeight: 1.6 }}>{del.description}</div>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                            {/* Revision dots */}
                            <div style={{ display: "flex", gap: 3 }}>
                              {Array.from({ length: del.revision_max ?? 3 }).map((_: any, i: number) => (
                                <div key={i} style={{
                                  width: 6, height: 6, borderRadius: "50%",
                                  background: i < (del.revision_used ?? 0) ? "#0F0F0E" : "transparent",
                                  border: "0.5px solid rgba(15,15,14,0.3)",
                                  opacity: i < (del.revision_used ?? 0) ? 0.7 : 0.3,
                                }} />
                              ))}
                            </div>
                            {/* Status dropdown */}
                            <select
                              value={del.status}
                              onChange={e => updateDeliverableStatus(del.id, e.target.value)}
                              style={{
                                ...mono,
                                fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase",
                                background: "transparent",
                                border: "0.5px solid rgba(15,15,14,0.15)",
                                padding: "5px 8px",
                                color: statusColors[del.status] ?? "#0F0F0E",
                                outline: "none", cursor: "pointer",
                              }}
                            >
                              {Object.entries(statusLabels).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }} />
                  </div>

                  {/* Decision log */}
                  <div>
                    <SectionHeader label="Decision log" />
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      <input
                        value={logInput}
                        onChange={e => setLogInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addLogEntry()}
                        placeholder="Log an approved direction, decision, or note…"
                        style={{
                          flex: 1,
                          ...serif,
                          fontSize: 13,
                          background: "rgba(255,255,255,0.4)",
                          border: "0.5px solid rgba(15,15,14,0.12)",
                          padding: "9px 12px",
                          color: "#0F0F0E", outline: "none",
                        }}
                      />
                      <button
                        onClick={addLogEntry}
                        style={{
                          ...mono,
                          fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                          background: "#0F0F0E", color: "#F4F1EC",
                          border: "none", padding: "0 16px",
                          cursor: "pointer", whiteSpace: "nowrap",
                        }}
                      >
                        Add
                      </button>
                    </div>
                    {decisionLog.map(entry => (
                      <div key={entry.id} style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.06)" }}>
                        <div style={{ ...mono, fontSize: 9, opacity: 0.40, minWidth: 52, paddingTop: 1 }}>
                          {new Date(entry.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                        <div style={{ ...serif, fontSize: 13, opacity: 0.65, lineHeight: 1.55, flex: 1 }}>{entry.entry}</div>
                        <button
                          onClick={() => deleteLogEntry(entry.id)}
                          style={{ ...mono, fontSize: 9, opacity: 0.30, background: "none", border: "none", cursor: "pointer", color: "#0F0F0E", flexShrink: 0, paddingTop: 1 }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {decisionLog.length === 0 && (
                      <div style={{ ...serif, fontSize: 13, opacity: 0.3, padding: "12px 0" }}>No decisions logged yet.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Tab 1: Presentation ── */}
          {activeTab === 1 && (
            <div>
              <SectionHeader label={selectedProject ? `${selectedProject.title} — slides` : "Presentation"} />
              {slides.length === 0 ? (
                <div style={{ ...serif, fontSize: 13, opacity: 0.4, padding: "16px 0" }}>
                  No slides yet. Upload presentation files to get started.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {slides.map((slide, i) => (
                    <div key={slide.id} style={{ position: "relative", border: "0.5px solid rgba(15,15,14,0.12)", background: "rgba(255,255,255,0.3)", aspectRatio: "4/3", overflow: "hidden" }}>
                      <img src={slide.image_url} alt={slide.caption ?? `Slide ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(15,15,14,0.5)", padding: "6px 8px" }}>
                        <div style={{ ...mono, fontSize: 7, color: "#F4F1EC", opacity: 0.7 }}>
                          {slide.caption ?? `Slide ${i + 1}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ ...mono, fontSize: 8, opacity: 0.3, marginTop: 16, lineHeight: 1.7 }}>
                Slide upload coming soon. Client sees slides in this order on the review screen.
              </div>
            </div>
          )}

          {/* ── Tab 2: Invoices ── */}
          {activeTab === 2 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <SectionHeader label="Invoices" />
                <Link href={`/admin/invoices/new?client=${params.id}`} style={{ ...mono, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none" }}>
                  + New invoice
                </Link>
              </div>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 100px", gap: 16, padding: "8px 0", borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
                {["#", "Description", "Amount", "Status"].map(h => (
                  <div key={h} style={{ ...mono, fontSize: 7, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.50 }}>{h}</div>
                ))}
              </div>
              {invoices.map(inv => (
                <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 100px", gap: 16, padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)", alignItems: "center" }}>
                  <div style={{ ...mono, fontSize: 10, opacity: 0.4 }}>#{inv.invoice_number}</div>
                  <div>
                    <div style={{ ...serif, fontSize: 13, opacity: 0.82 }}>{inv.description}</div>
                    {inv.due_date && (
                      <div style={{ ...mono, fontSize: 9, opacity: 0.4, marginTop: 2 }}>
                        Due {new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    )}
                  </div>
                  <div style={{ ...mono, fontSize: 13, opacity: 0.75 }}>${(inv.amount / 100).toLocaleString()}</div>
                  <InvStatusBadge status={inv.status} />
                </div>
              ))}
              {invoices.length === 0 && (
                <div style={{ ...serif, fontSize: 13, opacity: 0.50, padding: "32px 0" }}>No invoices yet.</div>
              )}
            </div>
          )}

          {/* ── Tab 3: Proposal ── */}
          {activeTab === 3 && (
            <div>
              {!latestProposal ? (
                <div style={{ ...serif, fontSize: 13, opacity: 0.4, paddingTop: 16 }}>
                  No proposals yet. <Link href={`/admin/proposals/new?client=${params.id}`} style={{ opacity: 0.6 }}>Create one →</Link>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
                    <div>
                      <div style={{ ...serif, fontSize: 18, opacity: 0.88, letterSpacing: "-0.01em", marginBottom: 4 }}>{latestProposal.title}</div>
                      <div style={{ ...mono, fontSize: 8, opacity: 0.4 }}>
                        Sent {new Date(latestProposal.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        {latestProposal.viewed_at && ` · Viewed ${new Date(latestProposal.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </div>
                    </div>
                    <Link href={`/admin/proposals/${latestProposal.id}`} style={{ ...mono, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none", border: "0.5px solid rgba(15,15,14,0.2)", padding: "7px 14px" }}>
                      View detail →
                    </Link>
                  </div>

                  {/* Line items */}
                  <div style={{ background: "rgba(255,255,255,0.3)", border: "0.5px solid rgba(15,15,14,0.1)", padding: "20px 24px", marginBottom: 16 }}>
                    {(latestProposal.proposal_items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((item: any) => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <span style={{ ...serif, fontSize: 13, opacity: item.accepted ? 0.82 : 0.35 }}>{item.name}</span>
                          {item.accepted && item.phase === "now" && <span style={{ ...mono, fontSize: 7, color: "#6B8F71", letterSpacing: "0.08em" }}>accepted</span>}
                          {item.accepted && item.phase === "later" && <span style={{ ...mono, fontSize: 7, color: "#B07D3A", letterSpacing: "0.08em" }}>phase 2</span>}
                          {!item.accepted && <span style={{ ...mono, fontSize: 7, opacity: 0.3, letterSpacing: "0.08em" }}>declined</span>}
                        </div>
                        <span style={{ ...mono, fontSize: 12, opacity: item.accepted ? 0.7 : 0.25 }}>${(item.price / 100).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {latestProposal.client_note && (
                    <div style={{ ...serif, fontSize: 13, opacity: 0.6, lineHeight: 1.7, fontStyle: "italic", padding: "12px 0" }}>
                      "{latestProposal.client_note}"
                    </div>
                  )}

                  {latestProposal.stripe_session_id && (
                    <div style={{ ...mono, fontSize: 9, opacity: 0.35, marginTop: 8 }}>
                      Stripe session: {latestProposal.stripe_session_id}
                    </div>
                  )}

                  {/* Other proposals */}
                  {proposals.length > 1 && (
                    <div style={{ marginTop: 32 }}>
                      <SectionHeader label="Previous proposals" />
                      {proposals.slice(1).map(p => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
                          <span style={{ ...serif, fontSize: 13, opacity: 0.65 }}>{p.title}</span>
                          <Link href={`/admin/proposals/${p.id}`} style={{ ...mono, fontSize: 8, opacity: 0.4, textDecoration: "none" }}>View →</Link>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>

        {/* Right sidebar */}
        <div style={{ padding: "32px 28px", borderLeft: "0.5px solid rgba(15,15,14,0.08)" }}>

          {/* Client info */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ ...mono, fontSize: 7, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 12 }}>Client</div>
            {[
              { label: "Contact",  value: client.contact_name },
              { label: "Email",    value: client.contact_email },
              { label: "Projects", value: String(projects.length) },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid rgba(15,15,14,0.06)" }}>
                <span style={{ ...mono, fontSize: 9, opacity: 0.50 }}>{row.label}</span>
                <span style={{ ...serif, fontSize: 12, opacity: 0.7, textAlign: "right", maxWidth: 160, wordBreak: "break-all" }}>{row.value}</span>
              </div>
            ))}
            {client.notes && (
              <div style={{ ...serif, fontSize: 12, opacity: 0.45, lineHeight: 1.6, marginTop: 10 }}>{client.notes}</div>
            )}
            <Link
  href={`/library`}
  target="_blank"
  style={{
    ...mono,
    display: "inline-block",
    marginTop: 14,
    fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
    color: "#0F0F0E", opacity: 0.45, textDecoration: "none",
    border: "0.5px solid rgba(15,15,14,0.2)", padding: "7px 14px",
  }}
>
  Preview brand library ↗
</Link>
          </div>

          {/* Financials */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ ...mono, fontSize: 7, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.50, marginBottom: 12 }}>Financials</div>
            {[
              { label: "Contract value", value: `$${(contractVal / 100).toLocaleString()}`,   color: undefined },
              { label: "Collected",      value: `$${(collected / 100).toLocaleString()}`,     color: "#6B8F71" },
              { label: "Outstanding",    value: `$${(outstanding / 100).toLocaleString()}`,   color: outstanding > 0 ? "#B07D3A" : undefined },
              { label: "On delivery",    value: `$${(onDelivery / 100).toLocaleString()}`,    color: undefined },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid rgba(15,15,14,0.06)" }}>
                <span style={{ ...mono, fontSize: 9, opacity: 0.50 }}>{row.label}</span>
                <span style={{ ...mono, fontSize: 12, color: row.color ?? "#0F0F0E", opacity: row.color ? 1 : 0.65 }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Messages */}
          <div>
            <div style={{ ...mono, fontSize: 7, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.50, marginBottom: 12 }}>Messages</div>

            {/* Reply form */}
            {projects.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {projects.length > 1 && (
                  <select
                    value={replyProjectId}
                    onChange={e => setReplyProjectId(e.target.value)}
                    style={{ ...mono, fontSize: 8, background: "transparent", border: "0.5px solid rgba(15,15,14,0.12)", padding: "5px 8px", color: "#0F0F0E", outline: "none", width: "100%", marginBottom: 6 }}
                  >
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                )}
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={`Reply to ${client.contact_name}…`}
                  rows={3}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    ...serif, fontSize: 12,
                    background: "rgba(255,255,255,0.4)",
                    border: "0.5px solid rgba(15,15,14,0.12)",
                    padding: "9px 12px", color: "#0F0F0E",
                    resize: "none", outline: "none",
                    marginBottom: 6, lineHeight: 1.5,
                  }}
                />
                <button
                  onClick={sendReply}
                  disabled={sendingReply || !replyText.trim()}
                  style={{
                    width: "100%", ...mono,
                    fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                    background: "transparent", border: "0.5px solid rgba(15,15,14,0.15)",
                    padding: "9px", color: "#0F0F0E",
                    opacity: sendingReply || !replyText.trim() ? 0.3 : 0.6,
                    cursor: sendingReply || !replyText.trim() ? "default" : "pointer",
                  }}
                >
                  {sendingReply ? "Sending…" : "Send reply"}
                </button>
              </div>
            )}

            {/* Message thread */}
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ ...mono, fontSize: 8, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {msg.from_client ? msg.sender_name : "Studio Cinq"}
                    </span>
                    <span style={{ ...mono, fontSize: 8, opacity: 0.25 }}>
                      {new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {msg.projects?.title && (
                    <div style={{ ...mono, fontSize: 8, opacity: 0.35, marginBottom: 3 }}>{msg.projects.title}</div>
                  )}
                  <div style={{ ...serif, fontSize: 12, opacity: 0.7, lineHeight: 1.55 }}>{msg.body}</div>
                </div>
              ))}
              {messages.length === 0 && (
                <div style={{ ...serif, fontSize: 12, opacity: 0.3, paddingTop: 8 }}>No messages yet.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontFamily: "'Matter SemiMono', monospace",
      fontSize: 7, letterSpacing: "0.16em", textTransform: "uppercase",
      opacity: 0.5, marginBottom: 14,
    }}>
      {label}
    </div>
  )
}

function ProjectStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { active: "#6B8F71", complete: "rgba(15,15,14,0.4)", on_hold: "#B07D3A", proposal_sent: "#B07D3A" }
  const labels: Record<string, string> = { active: "Active", complete: "Complete", on_hold: "On hold", proposal_sent: "Proposal sent" }
  return (
    <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)" }}>
      {labels[status] ?? status}
    </span>
  )
}

function InvStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { paid: "#6B8F71", sent: "#B07D3A", overdue: "#c0392b", draft: "rgba(15,15,14,0.35)" }
  return (
    <span style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)" }}>
      {status}
    </span>
  )
}

const actionBtn: React.CSSProperties = {
  fontFamily: "'Matter SemiMono', monospace",
  fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
  color: "#0F0F0E", opacity: 0.6, textDecoration: "none",
  border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
  display: "inline-block",
}