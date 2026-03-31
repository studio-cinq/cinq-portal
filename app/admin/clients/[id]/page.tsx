"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import PortalNav from "@/components/portal/Nav"
import MarkPaidButton from "@/components/portal/MarkPaidButton"
import Calendar from "@/components/portal/Calendar"
import { useToast } from "@/components/portal/Toast"
import Link from "next/link"

const TABS = ["Project", "Presentation", "Invoices", "Proposal", "Calendar", "Brand Library"]

const statusColors: Record<string, string> = {
  not_started:       "rgba(15,15,14,0.3)",
  in_progress:       "var(--amber)",
  awaiting_approval: "var(--amber)",
  approved:          "var(--sage)",
  complete:          "var(--sage)",
}
const statusLabels: Record<string, string> = {
  not_started:       "Not started",
  in_progress:       "In progress",
  awaiting_approval: "Awaiting approval",
  approved:          "Approved",
  complete:          "Complete",
}

export default function AdminClientWorkspacePage({ params }: { params: { id: string } }) {
  const [loading, setLoading]                 = useState(true)
  const [client, setClient]                   = useState<any>(null)
  const [projects, setProjects]               = useState<any[]>([])
  const [invoices, setInvoices]               = useState<any[]>([])
  const [messages, setMessages]               = useState<any[]>([])
  const [proposals, setProposals]             = useState<any[]>([])
  const [decisionLog, setDecisionLog]         = useState<any[]>([])
  const [slides, setSlides]                   = useState<any[]>([])
  const [timeEntries, setTimeEntries]         = useState<any[]>([])
  const [activeTab, setActiveTab]             = useState(0)
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [timerRunning, setTimerRunning]       = useState(false)
  const [timerStart, setTimerStart]           = useState<Date | null>(null)
  const [timerSeconds, setTimerSeconds]       = useState(0)
  const [timerNote, setTimerNote]             = useState("")
  const [logInput, setLogInput]               = useState("")
  const [replyText, setReplyText]             = useState("")
  const [replyProjectId, setReplyProjectId]   = useState<string>("")
  const [sendingReply, setSendingReply]       = useState(false)
  const [inviting, setInviting]               = useState(false)
  const [inviteStatus, setInviteStatus]       = useState<"idle" | "sent">("idle")
  const [events, setEvents]                   = useState<any[]>([])
  const [brandAssets, setBrandAssets]           = useState<any[]>([])
  const [colorSwatches, setColorSwatches]       = useState<any[]>([])
  const [typefaceEntries, setTypefaceEntries]   = useState<any[]>([])
  const [colorForm, setColorForm]               = useState({ name: "", hex: "#" })
  const [typefaceForm, setTypefaceForm]         = useState({ name: "", weight: "", role: "" })
  const [savingEvent, setSavingEvent]         = useState(false)
  const [eventForm, setEventForm]             = useState({
    title: "", event_date: "", event_time: "", duration_minutes: "",
    type: "meeting", project_id: "", notes: "",
  })
  const { show: showToast, ToastContainer }   = useToast()

  useEffect(() => { loadAll() }, [params.id])

  useEffect(() => {
    if (selectedProject) {
      loadDecisionLog(selectedProject.id)
      loadSlides(selectedProject.id)
      loadTimeEntries(selectedProject.id)
      loadBrandAssets(selectedProject.id)
      loadColorSwatches(selectedProject.id)
      loadTypefaceEntries(selectedProject.id)
      setReplyProjectId(selectedProject.id)
    }
  }, [selectedProject?.id])

  useEffect(() => {
    if (!timerRunning) return
    const interval = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [timerRunning])

  async function loadAll() {
    setLoading(true)
    const { data: c } = await supabase.from("clients").select("*").eq("id", params.id).single()
    if (!c) { setLoading(false); return }
    setClient(c)

    const { data: proj } = await supabase.from("projects").select("*, deliverables(*)")
      .eq("client_id", params.id).order("created_at", { ascending: false })
    const ps = proj ?? []
    setProjects(ps)
    if (ps.length > 0) setSelectedProject(ps[0])

    const { data: inv } = await supabase.from("invoices").select("*")
      .eq("client_id", params.id).order("created_at", { ascending: false })
    setInvoices(inv ?? [])

    const projectIds = ps.map((p: any) => p.id)
    if (projectIds.length > 0) {
      const { data: msgs } = await supabase.from("messages").select("*, projects(title)")
        .in("project_id", projectIds).order("created_at", { ascending: false }).limit(30)
      setMessages(msgs ?? [])
    }

    const { data: props } = await supabase.from("proposals").select("*, proposal_items(*)")
      .eq("client_id", params.id).order("created_at", { ascending: false })
    setProposals(props ?? [])

    const { data: evts } = await supabase.from("events").select("*, projects(title)")
      .eq("client_id", params.id).order("event_date")
    setEvents(evts ?? [])

    setLoading(false)
  }

  async function loadDecisionLog(projectId: string) {
    const { data } = await supabase.from("decision_log").select("*")
      .eq("project_id", projectId).order("logged_at", { ascending: false })
    setDecisionLog(data ?? [])
  }

  async function loadSlides(projectId: string) {
    const { data } = await supabase.from("presentation_slides").select("*")
      .eq("project_id", projectId).order("sort_order")
    setSlides(data ?? [])
  }

  async function loadTimeEntries(projectId: string) {
    const { data } = await supabase.from("time_entries").select("*")
      .eq("project_id", projectId).order("started_at", { ascending: false })
    setTimeEntries(data ?? [])
  }

  async function loadBrandAssets(projectId: string) {
    const { data } = await supabase.from("brand_assets").select("*")
      .eq("project_id", projectId).order("sort_order")
    setBrandAssets(data ?? [])
  }

  async function loadColorSwatches(projectId: string) {
    const { data } = await supabase.from("color_swatches").select("*")
      .eq("project_id", projectId).order("sort_order")
    setColorSwatches(data ?? [])
  }

  async function loadTypefaceEntries(projectId: string) {
    const { data } = await supabase.from("typeface_entries").select("*")
      .eq("project_id", projectId).order("sort_order")
    setTypefaceEntries(data ?? [])
  }

  async function updateDeliverableStatus(deliverableId: string, status: string) {
    await supabase.from("deliverables").update({ status }).eq("id", deliverableId)
    setProjects(ps => ps.map(p => ({
      ...p,
      deliverables: p.deliverables?.map((d: any) => d.id === deliverableId ? { ...d, status } : d)
    })))
    showToast(`Status → ${statusLabels[status] ?? status}`)
  }

  async function deleteDeliverable(deliverableId: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await supabase.from("deliverables").delete().eq("id", deliverableId)
    setProjects(ps => ps.map(p => ({
      ...p,
      deliverables: p.deliverables?.filter((d: any) => d.id !== deliverableId)
    })))
    showToast("Deliverable deleted")
  }

  async function addLogEntry() {
    if (!logInput.trim() || !selectedProject) return
    const { data } = await supabase.from("decision_log")
      .insert({ project_id: selectedProject.id, entry: logInput.trim() }).select().single()
    if (data) setDecisionLog(prev => [data, ...prev])
    setLogInput("")
    showToast("Decision logged")
  }

  async function deleteLogEntry(id: string) {
    await supabase.from("decision_log").delete().eq("id", id)
    setDecisionLog(prev => prev.filter(e => e.id !== id))
    showToast("Entry removed", "info")
  }

  async function uploadBrandAssets(files: FileList, category: string) {
    if (!selectedProject) return
    let uploaded = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split(".").pop() ?? "bin"
      const path = `${selectedProject.id}/${Date.now()}-${i}.${ext}`
      const { error: uploadErr } = await supabase.storage.from("brand-assets").upload(path, file)
      if (uploadErr) { console.error("[upload]", uploadErr); showToast("Upload failed — check storage permissions", "error"); continue }
      const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path)
      const { data: asset } = await supabase.from("brand_assets").insert({
        project_id: selectedProject.id,
        name: file.name.replace(/\.[^.]+$/, ""),
        file_url: urlData.publicUrl,
        file_type: ext.toUpperCase(),
        file_size_bytes: file.size,
        category,
        sort_order: brandAssets.length + i,
      }).select().single()
      if (asset) { setBrandAssets(prev => [...prev, asset]); uploaded++ }
    }
    if (uploaded > 0) showToast(`${uploaded} asset${uploaded > 1 ? "s" : ""} uploaded`)
  }

  async function deleteBrandAsset(id: string) {
    await supabase.from("brand_assets").delete().eq("id", id)
    setBrandAssets(prev => prev.filter(a => a.id !== id))
    showToast("Asset removed", "info")
  }

  async function addColorSwatch() {
    if (!colorForm.name.trim() || !colorForm.hex.trim() || !selectedProject) return
    const { data } = await supabase.from("color_swatches").insert({
      project_id: selectedProject.id,
      name: colorForm.name.trim(),
      hex: colorForm.hex.trim(),
      sort_order: colorSwatches.length,
    }).select().single()
    if (data) setColorSwatches(prev => [...prev, data])
    setColorForm({ name: "", hex: "#" })
    showToast("Color added")
  }

  async function deleteColorSwatch(id: string) {
    await supabase.from("color_swatches").delete().eq("id", id)
    setColorSwatches(prev => prev.filter(c => c.id !== id))
    showToast("Color removed", "info")
  }

  async function addTypefaceEntry() {
    if (!typefaceForm.name.trim() || !selectedProject) return
    const { data } = await supabase.from("typeface_entries").insert({
      project_id: selectedProject.id,
      name: typefaceForm.name.trim(),
      weight: typefaceForm.weight.trim() || null,
      role: typefaceForm.role.trim() || null,
      sort_order: typefaceEntries.length,
    }).select().single()
    if (data) setTypefaceEntries(prev => [...prev, data])
    setTypefaceForm({ name: "", weight: "", role: "" })
    showToast("Typeface added")
  }

  async function deleteTypefaceEntry(id: string) {
    await supabase.from("typeface_entries").delete().eq("id", id)
    setTypefaceEntries(prev => prev.filter(t => t.id !== id))
    showToast("Typeface removed", "info")
  }

  async function sendReply() {
    if (!replyText.trim() || !replyProjectId) return
    setSendingReply(true)
    const messageBody = replyText.trim()
    const { data } = await supabase.from("messages").insert({
      project_id: replyProjectId, from_client: false,
      sender_name: "Studio Cinq", body: messageBody, read: true,
    }).select("*, projects(title)").single()
    if (data) setMessages(prev => [data, ...prev])
    setReplyText("")
    setSendingReply(false)
    showToast("Reply sent")

    // Fire email notification to client (non-blocking)
    fetch("/api/admin/notify-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: params.id,
        projectId: replyProjectId,
        messageBody,
      }),
    }).catch(err => console.error("[notify-reply]", err))
  }

  async function inviteClient() {
    setInviting(true)
    const res = await fetch("/api/admin/invite-client", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: client.contact_email, clientName: client.contact_name }),
    })
    setInviting(false)
    if (res.ok) {
      setInviteStatus("sent")
      showToast("Invite email sent")
    } else {
      showToast("Invite failed — try again", "error")
    }
  }

  async function addEvent() {
    if (!eventForm.title.trim() || !eventForm.event_date) return
    setSavingEvent(true)
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: params.id,
        project_id: eventForm.project_id || null,
        title: eventForm.title.trim(),
        event_date: eventForm.event_date,
        event_time: eventForm.event_time || null,
        duration_minutes: eventForm.duration_minutes ? parseInt(eventForm.duration_minutes) : null,
        type: eventForm.type,
        notes: eventForm.notes.trim() || null,
      }),
    })
    const json = await res.json()
    setSavingEvent(false)
    if (res.ok && json.event) {
      // Re-fetch with project title join
      const { data } = await supabase.from("events").select("*, projects(title)").eq("id", json.event.id).single()
      if (data) setEvents(prev => [...prev, data].sort((a, b) => a.event_date.localeCompare(b.event_date)))
      setEventForm({ title: "", event_date: "", event_time: "", duration_minutes: "", type: "meeting", project_id: "", notes: "" })
      showToast("Event added")
    } else {
      showToast("Failed to add event", "error")
    }
  }

  async function deleteEvent(id: string) {
    const res = await fetch("/api/admin/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setEvents(prev => prev.filter(e => e.id !== id))
      showToast("Event removed", "info")
    }
  }

  async function startTimer() {
    setTimerStart(new Date())
    setTimerSeconds(0)
    setTimerRunning(true)
    showToast("Timer started", "info")
  }

  async function stopTimer() {
    if (!timerStart || !selectedProject) return
    setTimerRunning(false)
    const stopped = new Date()
    const durationMinutes = Math.round((stopped.getTime() - timerStart.getTime()) / 60000)
    const { data } = await supabase.from("time_entries").insert({
      project_id: selectedProject.id,
      started_at: timerStart.toISOString(),
      stopped_at: stopped.toISOString(),
      duration_minutes: durationMinutes,
      note: timerNote.trim() || null,
    }).select().single()
    if (data) setTimeEntries(prev => [data, ...prev])
    setTimerStart(null)
    setTimerSeconds(0)
    setTimerNote("")
    showToast(`Time logged — ${formatMinutes(durationMinutes)}`)
  }

  if (loading) return (
    <>
      <PortalNav isAdmin />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>Loading…</div>
      </div>
    </>
  )

  if (!client) return (
    <>
      <PortalNav isAdmin />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.5 }}>Client not found.</div>
      </div>
    </>
  )

  const collected   = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0)
  const outstanding = invoices.filter(i => ["sent","overdue"].includes(i.status)).reduce((s, i) => s + i.amount, 0)
  const onDelivery  = invoices.filter(i => i.status === "draft").reduce((s, i) => s + i.amount, 0)
  const contractVal = collected + outstanding + onDelivery
  const deliverables  = (selectedProject?.deliverables ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const latestProposal = proposals[0]
  const totalMinutes   = timeEntries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0)

  return (
    <>
      <PortalNav isAdmin />

      {/* Client header */}
      <div className="client-header-pad" style={{ borderBottom: "0.5px solid rgba(15,15,14,0.08)", background: "rgba(244,241,236,0.5)", padding: "20px 48px 0" }}>
        <Link href="/admin/clients" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.35, textDecoration: "none", display: "inline-block", marginBottom: 12 }}>
          ← Clients
        </Link>
        <div className="client-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", opacity: "var(--op-full)" as any, letterSpacing: "-0.015em", marginBottom: 4 }}>{client.name}</h1>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any }}>{client.contact_name} &nbsp;·&nbsp; {client.contact_email}</div>
          </div>
          <div className="client-actions" style={{ display: "flex", gap: 8, paddingBottom: 20 }}>
            <Link href={`/admin/clients/${params.id}/edit`} style={actionBtn}>Edit</Link>
            <Link href={`/admin/projects/new?client=${params.id}`} style={actionBtn}>+ Project</Link>
            <button onClick={inviteClient} disabled={inviting} style={{ ...actionBtn, opacity: inviting ? 0.4 : 0.6, cursor: inviting ? "default" : "pointer", border: "0.5px solid rgba(15,15,14,0.2)", background: "transparent", color: "var(--ink)" }}>
              {inviting ? "Sending…" : inviteStatus === "sent" ? "Invite sent ✓" : "Invite to portal"}
            </button>
            <Link href={`/admin/invoices/new?client=${params.id}`} style={actionBtn}>+ Invoice</Link>
            <Link href={`/admin/proposals/new?client=${params.id}`} style={{ ...actionBtn, background: "var(--ink)", color: "var(--cream)", opacity: 1 }}>+ Proposal</Link>
          </div>
        </div>
        <div className="client-tabs" style={{ display: "flex" }}>
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase", padding: "10px 20px", background: "transparent", border: "none", borderBottom: activeTab === i ? "1.5px solid var(--ink)" : "1.5px solid transparent", cursor: "pointer", opacity: activeTab === i ? 0.88 : 0.5, color: "var(--ink)" }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div className="admin-studio-grid" style={{ display: "grid", gridTemplateColumns: "1fr 280px", minHeight: "calc(100vh - 180px)", maxWidth: 1400, margin: "0 auto" }}>

        {/* Left */}
        <div className="admin-studio-left" style={{ padding: "32px 40px 60px", borderRight: "0.5px solid rgba(15,15,14,0.08)" }}>

          {projects.length > 1 && (
            <div style={{ marginBottom: 24 }}>
              <select value={selectedProject?.id ?? ""} onChange={e => setSelectedProject(projects.find(p => p.id === e.target.value))} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", background: "transparent", border: "0.5px solid rgba(15,15,14,0.15)", padding: "7px 12px", color: "var(--ink)", outline: "none", cursor: "pointer" }}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          )}

          {/* ── Tab 0: Project ── */}
          {activeTab === 0 && (
            <div>
              {!selectedProject ? (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.4, paddingTop: 32 }}>
                  No projects yet. <Link href={`/admin/projects/new?client=${params.id}`} style={{ opacity: 0.6 }}>Create one →</Link>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, opacity: "var(--op-full)" as any, letterSpacing: "-0.01em" }}>{selectedProject.title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Link href={`/admin/projects/${selectedProject.id}/edit`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.35, textDecoration: "none" }}>Edit</Link>
                        <ProjectStatusBadge status={selectedProject.status} />
                      </div>
                    </div>
                    {selectedProject.scope && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-muted)" as any, lineHeight: 1.6 }}>{selectedProject.scope}</div>}
                    {selectedProject.total_weeks && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4 }}>Week {selectedProject.current_week ?? 0} of {selectedProject.total_weeks}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4 }}>{Math.round(((selectedProject.current_week ?? 0) / selectedProject.total_weeks) * 100)}%</span>
                        </div>
                        <div style={{ height: 1.5, background: "rgba(15,15,14,0.1)" }}>
                          <div style={{ height: 1.5, width: `${Math.round(((selectedProject.current_week ?? 0) / selectedProject.total_weeks) * 100)}%`, background: "var(--ink)", opacity: 0.4 }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Deliverables */}
                  <div style={{ marginBottom: 40 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                      <SectionHeader label="Deliverables" />
                      <button onClick={() => {
                        const name = window.prompt("Deliverable name:")
                        if (!name?.trim() || !selectedProject) return
                        supabase.from("deliverables").insert({ project_id: selectedProject.id, name: name.trim(), status: "not_started", sort_order: deliverables.length }).select().single().then(({ data }) => {
                          if (data) setProjects(ps => ps.map(p => p.id === selectedProject.id ? { ...p, deliverables: [...(p.deliverables ?? []), data] } : p))
                        })
                      }} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, background: "none", border: "0.5px solid rgba(15,15,14,0.2)", padding: "5px 10px", cursor: "pointer", color: "var(--ink)" }}>
                        + Add
                      </button>
                    </div>
                    {deliverables.length === 0 ? (
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.35, padding: "16px 0" }}>No deliverables yet.</div>
                    ) : deliverables.map((del: any) => (
                      <div key={del.id} style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)", padding: "14px 0" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-full)" as any, marginBottom: 4 }}>{del.name}</div>
                            {del.description && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-muted)" as any, lineHeight: 1.6 }}>{del.description}</div>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                            <div style={{ display: "flex", gap: 3 }}>
                              {Array.from({ length: del.revision_max ?? 3 }).map((_: any, i: number) => (
                                <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i < (del.revision_used ?? 0) ? "var(--ink)" : "transparent", border: "0.5px solid rgba(15,15,14,0.3)", opacity: i < (del.revision_used ?? 0) ? 0.7 : 0.3 }} />
                              ))}
                            </div>
                            <select value={del.status} onChange={e => updateDeliverableStatus(del.id, e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", textTransform: "uppercase", background: "transparent", border: "0.5px solid rgba(15,15,14,0.15)", padding: "5px 8px", color: statusColors[del.status] ?? "var(--ink)", outline: "none", cursor: "pointer" }}>
                              {Object.entries(statusLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                            </select>
                            <button onClick={() => deleteDeliverable(del.id, del.name)} style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "none", border: "none", cursor: "pointer", color: "var(--ink)", opacity: 0.25, padding: "4px" }}>✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }} />
                  </div>

                  {/* Decision log */}
                  <div style={{ marginBottom: 40 }}>
                    <SectionHeader label="Decision log" />
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      <input value={logInput} onChange={e => setLogInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addLogEntry()} placeholder="Log an approved direction, decision, or note…" style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", background: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(15,15,14,0.12)", padding: "9px 12px", color: "var(--ink)", outline: "none" }} />
                      <button onClick={addLogEntry} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", background: "var(--ink)", color: "var(--cream)", border: "none", padding: "0 16px", cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
                    </div>
                    {decisionLog.map(entry => (
                      <div key={entry.id} style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.06)" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4, minWidth: 52, paddingTop: 1 }}>{new Date(entry.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-muted)" as any, lineHeight: 1.55, flex: 1 }}>{entry.entry}</div>
                        <button onClick={() => deleteLogEntry(entry.id)} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.3, background: "none", border: "none", cursor: "pointer", color: "var(--ink)", flexShrink: 0, paddingTop: 1 }}>×</button>
                      </div>
                    ))}
                    {decisionLog.length === 0 && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.4, padding: "12px 0", lineHeight: 1.7 }}>No decisions logged yet — add notes here as you and the client align on direction.</div>}
                  </div>

                  {/* Time tracking */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                      <SectionHeader label="Time tracking" />
                      {totalMinutes > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any }}>Total: {formatMinutes(totalMinutes)}</div>}
                    </div>
                    <div style={{ border: "0.5px solid rgba(15,15,14,0.12)", padding: "16px 20px", background: timerRunning ? "rgba(107,143,113,0.06)" : "rgba(255,255,255,0.35)", marginBottom: 16, transition: "background 0.3s" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: timerRunning ? 12 : 0 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: timerRunning ? 22 : "var(--text-body)", opacity: timerRunning ? 0.9 : 0.45 }}>
                          {timerRunning ? formatDuration(timerSeconds) : "Ready to track"}
                        </div>
                        <button onClick={timerRunning ? stopTimer : startTimer} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase", background: timerRunning ? "var(--danger)" : "var(--ink)", color: "var(--cream)", border: "none", padding: "8px 16px", cursor: "pointer", transition: "background 0.2s" }}>
                          {timerRunning ? "Stop" : "Start timer"}
                        </button>
                      </div>
                      {timerRunning && (
                        <input value={timerNote} onChange={e => setTimerNote(e.target.value)} placeholder="What are you working on? (optional)" style={{ width: "100%", boxSizing: "border-box", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", background: "transparent", border: "none", borderBottom: "0.5px solid rgba(15,15,14,0.15)", padding: "6px 0", color: "var(--ink)", outline: "none" }} />
                      )}
                    </div>
                    {timeEntries.map(entry => (
                      <div key={entry.id} style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.06)", alignItems: "baseline" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4, minWidth: 52 }}>{new Date(entry.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", opacity: 0.7, minWidth: 48 }}>{formatMinutes(entry.duration_minutes ?? 0)}</div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-muted)" as any, flex: 1 }}>{entry.note ?? "—"}</div>
                      </div>
                    ))}
                    {timeEntries.length === 0 && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.4, padding: "8px 0" }}>No time tracked yet. Start the timer above when you begin working.</div>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Tab 1: Presentation ── */}
          {activeTab === 1 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <SectionHeader label={selectedProject ? `${selectedProject.title} — slides` : "Presentation"} />
                {selectedProject && (
                  <label style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    opacity: 0.6, cursor: "pointer",
                    border: "0.5px solid rgba(15,15,14,0.2)", padding: "7px 14px",
                  }}>
                    + Upload slides
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const files = e.target.files
                        if (!files || !selectedProject) return
                        for (let i = 0; i < files.length; i++) {
                          const file = files[i]
                          const ext = file.name.split(".").pop() ?? "png"
                          const path = `${selectedProject.id}/${Date.now()}-${i}.${ext}`
                          const { error: uploadErr } = await supabase.storage.from("presentations").upload(path, file)
                          if (uploadErr) { console.error("[upload]", uploadErr); continue }
                          const { data: urlData } = supabase.storage.from("presentations").getPublicUrl(path)
                          const imageUrl = urlData.publicUrl
                          const { data: slide } = await supabase.from("presentation_slides").insert({
                            project_id: selectedProject.id,
                            image_url: imageUrl,
                            caption: file.name.replace(/\.[^.]+$/, ""),
                            sort_order: slides.length + i,
                          }).select().single()
                          if (slide) setSlides(prev => [...prev, slide])
                        }
                        showToast(`${files.length} slide${files.length > 1 ? "s" : ""} uploaded`)
                        e.target.value = ""
                      }}
                    />
                  </label>
                )}
              </div>

              {slides.length === 0 ? (
                <div style={{
                  border: "1px dashed rgba(15,15,14,0.12)", padding: "48px 24px",
                  textAlign: "center", background: "rgba(255,255,255,0.2)",
                }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.4, marginBottom: 8, lineHeight: 1.7 }}>
                    No presentation slides yet.
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.38, lineHeight: 1.7 }}>
                    Upload images to build out the presentation for this project.
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {slides.map((slide, i) => (
                    <div key={slide.id} style={{ position: "relative", border: "0.5px solid rgba(15,15,14,0.12)", background: "rgba(255,255,255,0.3)", aspectRatio: "4/3", overflow: "hidden" }}>
                      <img src={slide.image_url} alt={slide.caption ?? `Slide ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(15,15,14,0.5)", padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--cream)", opacity: 0.7 }}>{slide.caption ?? `Slide ${i + 1}`}</div>
                        <button
                          onClick={async () => {
                            await supabase.from("presentation_slides").delete().eq("id", slide.id)
                            setSlides(prev => prev.filter(s => s.id !== slide.id))
                            showToast("Slide removed", "info")
                          }}
                          style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--cream)", opacity: 0.5, background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab 2: Invoices ── */}
          {activeTab === 2 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <SectionHeader label="Invoices" />
                <Link href={`/admin/invoices/new?client=${params.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none" }}>+ New invoice</Link>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 100px 80px 50px", gap: 16, padding: "8px 0", borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
                {["#", "Description", "Amount", "Status", "", ""].map((h, i) => <div key={`${h}-${i}`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5 }}>{h}</div>)}
              </div>
              {invoices.map(inv => (
                <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 100px 80px 50px", gap: 16, padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)", alignItems: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4 }}>
                    #{inv.invoice_number}
                    {inv.viewed_at && (
                      <span style={{ color: "var(--sage)", opacity: 0.8, marginLeft: 6 }}>·&nbsp;viewed</span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-full)" as any }}>{inv.description}</div>
                    {inv.due_date && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4, marginTop: 2 }}>Due {new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body)", opacity: "var(--op-body)" as any }}>${(inv.amount / 100).toLocaleString()}</div>
                  <InvStatusBadge status={inv.status} />
                  <div>
                    {["sent", "overdue"].includes(inv.status) && (
                      <MarkPaidButton
                        invoiceId={inv.id}
                        invoiceNumber={inv.invoice_number}
                        onMarked={() => setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: "paid", paid_at: new Date().toISOString() } : i))}
                      />
                    )}
                  </div>
                  <Link href={`/admin/invoices/${inv.id}/edit`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.35, textDecoration: "none" }}>
                    Edit
                  </Link>
                </div>
              ))}
              {invoices.length === 0 && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.42, padding: "32px 0", lineHeight: 1.7 }}>No invoices for this client yet. <Link href={`/admin/invoices/new?client=${params.id}`} style={{ opacity: 0.6, textDecoration: "none", borderBottom: "0.5px solid rgba(15,15,14,0.2)" }}>Send one →</Link></div>}
            </div>
          )}

          {/* ── Tab 3: Proposal ── */}
          {activeTab === 3 && (
            <div>
              {!latestProposal ? (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.4, paddingTop: 16 }}>
                  No proposals for this client yet. <Link href={`/admin/proposals/new?client=${params.id}`} style={{ opacity: 0.6, textDecoration: "none", borderBottom: "0.5px solid rgba(15,15,14,0.2)" }}>Create one →</Link>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, opacity: "var(--op-full)" as any, letterSpacing: "-0.01em", marginBottom: 4 }}>{latestProposal.title}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4 }}>
                        Sent {new Date(latestProposal.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        {latestProposal.viewed_at && ` · Viewed ${new Date(latestProposal.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </div>
                    </div>
                    <Link href={`/admin/proposals/${latestProposal.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none", border: "0.5px solid rgba(15,15,14,0.2)", padding: "7px 14px" }}>View detail →</Link>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.3)", border: "0.5px solid rgba(15,15,14,0.1)", padding: "20px 24px", marginBottom: 16 }}>
                    {(latestProposal.proposal_items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((item: any) => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: item.accepted ? "var(--op-full)" as any : 0.35 }}>{item.name}</span>
                          {item.accepted && item.phase === "now"   && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--sage)" }}>accepted</span>}
                          {item.accepted && item.phase === "later" && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--amber)" }}>phase 2</span>}
                          {!item.accepted && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.4 }}>declined</span>}
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body)", opacity: item.accepted ? "var(--op-body)" as any : 0.38 }}>${(item.price / 100).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {latestProposal.client_note && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-muted)" as any, lineHeight: 1.7, fontStyle: "italic", padding: "12px 0" }}>"{latestProposal.client_note}"</div>}
                  {proposals.length > 1 && (
                    <div style={{ marginTop: 32 }}>
                      <SectionHeader label="Previous proposals" />
                      {proposals.slice(1).map(p => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)" }}>
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-muted)" as any }}>{p.title}</span>
                          <Link href={`/admin/proposals/${p.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4, textDecoration: "none" }}>View →</Link>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Tab 4: Calendar ── */}
          {activeTab === 4 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
                <SectionHeader label="Calendar" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 32 }} className="form-grid-2col">
                {/* Month calendar */}
                <div>
                  <Calendar
                    events={[
                      ...events.map((e: any) => ({ id: e.id, event_date: e.event_date, type: e.type, title: e.title })),
                      ...invoices.filter(i => i.due_date && ["sent", "overdue"].includes(i.status)).map((i: any) => ({
                        id: `inv-${i.id}`, event_date: i.due_date, type: "invoice_due", title: `Invoice #${i.invoice_number}`,
                      })),
                    ]}
                  />
                  {/* Legend */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16, paddingTop: 12, borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
                    {[
                      { label: "Meeting", color: "var(--amber)" },
                      { label: "Presentation", color: "var(--amber)" },
                      { label: "Milestone", color: "var(--sage)" },
                      { label: "Invoice due", color: "var(--ink)" },
                    ].map(l => (
                      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: l.color, opacity: 0.7 }} />
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.45 }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Event list */}
                <div>
                  {/* All events sorted by date */}
                  {(() => {
                    const allCalEvents = [
                      ...events.map((e: any) => ({
                        id: e.id, title: e.title, event_date: e.event_date, event_time: e.event_time,
                        duration_minutes: e.duration_minutes ?? null,
                        type: e.type, project_title: e.projects?.title ?? null, notes: e.notes, is_auto: false,
                      })),
                      ...invoices.filter(i => i.due_date && ["sent", "overdue"].includes(i.status)).map((i: any) => ({
                        id: `inv-${i.id}`, title: `Invoice #${i.invoice_number} — $${(i.amount / 100).toLocaleString()}`,
                        event_date: i.due_date, event_time: null, duration_minutes: null, type: "invoice_due",
                        project_title: null, notes: null, is_auto: true,
                      })),
                    ].sort((a, b) => a.event_date.localeCompare(b.event_date))

                    return allCalEvents.length > 0 ? (
                      <div>
                        {allCalEvents.map(evt => (
                          <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.4, minWidth: 60 }}>
                                  {new Date(evt.event_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                                {evt.event_time && (
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.3 }}>
                                    {(() => { const [h, m] = evt.event_time.split(":"); const hr = parseInt(h); return `${hr === 0 ? 12 : hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? "PM" : "AM"}`; })()}{evt.duration_minutes ? ` · ${evt.duration_minutes}m` : ""}
                                  </span>
                                )}
                                <span style={{
                                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
                                  padding: "2px 7px",
                                  border: `0.5px solid ${evt.type === "milestone" ? "rgba(107,143,113,0.3)" : evt.type === "invoice_due" || evt.type === "work" ? "rgba(15,15,14,0.15)" : "rgba(176,125,58,0.3)"}`,
                                  color: evt.type === "milestone" ? "var(--sage)" : evt.type === "invoice_due" || evt.type === "work" ? "var(--ink)" : "var(--amber)",
                                  opacity: evt.type === "invoice_due" ? 0.5 : evt.type === "work" ? 0.55 : 1,
                                }}>
                                  {evt.type === "meeting" ? "Meeting" : evt.type === "presentation" ? "Presentation" : evt.type === "milestone" ? "Milestone" : evt.type === "work" ? "Work" : "Invoice"}
                                </span>
                              </div>
                              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-body)" as any }}>{evt.title}</div>
                              {evt.project_title && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.3, marginTop: 2 }}>{evt.project_title}</div>}
                              {evt.notes && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.4, marginTop: 4, lineHeight: 1.5 }}>{evt.notes}</div>}
                            </div>
                            {!evt.is_auto && (
                              <button onClick={() => deleteEvent(evt.id)} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.25, background: "none", border: "none", cursor: "pointer", color: "var(--ink)", flexShrink: 0, padding: "2px 4px" }}>✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.42, paddingTop: 8, lineHeight: 1.7 }}>No events scheduled yet. Add meetings, milestones, or reviews below.</div>
                    )
                  })()}
                </div>
              </div>

              {/* Add event form */}
              <div style={{ marginTop: 32, borderTop: "0.5px solid rgba(15,15,14,0.1)", paddingTop: 24 }}>
                <SectionHeader label="Add event" />
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 100px", gap: 12 }} className="form-grid-3col">
                    <div>
                      <div style={formLabel}>Title *</div>
                      <input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="Brand review call" style={formInput} />
                    </div>
                    <div>
                      <div style={formLabel}>Date *</div>
                      <input type="date" value={eventForm.event_date} onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))} style={formInput} />
                    </div>
                    <div>
                      <div style={formLabel}>Time</div>
                      <input type="time" value={eventForm.event_time} onChange={e => setEventForm(f => ({ ...f, event_time: e.target.value }))} style={formInput} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }} className="form-grid-3col">
                    <div>
                      <div style={formLabel}>Type</div>
                      <select value={eventForm.type} onChange={e => setEventForm(f => ({ ...f, type: e.target.value }))} style={formInput}>
                        <option value="meeting">Meeting / call</option>
                        <option value="presentation">Presentation review</option>
                        <option value="milestone">Milestone deadline</option>
                        <option value="work">Work time</option>
                      </select>
                    </div>
                    <div>
                      <div style={formLabel}>Project</div>
                      <select value={eventForm.project_id} onChange={e => setEventForm(f => ({ ...f, project_id: e.target.value }))} style={formInput}>
                        <option value="">No project</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={formLabel}>Duration (min)</div>
                      <input type="number" value={eventForm.duration_minutes} onChange={e => setEventForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="60" style={formInput} />
                    </div>
                  </div>

                  <div>
                    <div style={formLabel}>Notes</div>
                    <input value={eventForm.notes} onChange={e => setEventForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional details…" style={formInput} />
                  </div>

                  <button onClick={addEvent} disabled={savingEvent || !eventForm.title.trim() || !eventForm.event_date} style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
                    background: "var(--ink)", color: "var(--cream)", border: "none", padding: "11px 24px",
                    cursor: savingEvent || !eventForm.title.trim() || !eventForm.event_date ? "default" : "pointer",
                    opacity: savingEvent || !eventForm.title.trim() || !eventForm.event_date ? 0.35 : 1,
                    alignSelf: "flex-start", transition: "opacity 0.2s",
                  }}>
                    {savingEvent ? "Adding…" : "Add event"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 5: Brand Library ── */}
          {activeTab === 5 && (
            <div>
              {/* ── Brand Assets ── */}
              <div style={{ marginBottom: 40 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                  <SectionHeader label={selectedProject ? `${selectedProject.title} — assets` : "Brand assets"} />
                  {selectedProject && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(["logo", "guidelines", "source", "other"] as const).map(cat => (
                        <label key={cat} style={{
                          fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                          letterSpacing: "0.12em", textTransform: "uppercase",
                          opacity: 0.6, cursor: "pointer",
                          border: "0.5px solid rgba(15,15,14,0.2)", padding: "7px 12px",
                        }}>
                          + {cat}
                          <input type="file" multiple style={{ display: "none" }}
                            onChange={(e) => { if (e.target.files) uploadBrandAssets(e.target.files, cat); e.target.value = "" }}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {brandAssets.length === 0 ? (
                  <div style={{
                    border: "1px dashed rgba(15,15,14,0.12)", padding: "48px 24px",
                    textAlign: "center", background: "rgba(255,255,255,0.2)",
                  }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.4, marginBottom: 8, lineHeight: 1.7 }}>
                      No brand assets yet.
                    </div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.38, lineHeight: 1.7 }}>
                      Upload logo files, guidelines, and source files using the buttons above.
                    </div>
                  </div>
                ) : (
                  <div>
                    {(["logo", "guidelines", "source", "other"] as const).map(cat => {
                      const catAssets = brandAssets.filter(a => a.category === cat)
                      if (catAssets.length === 0) return null
                      return (
                        <div key={cat} style={{ marginBottom: 20 }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.35, marginBottom: 8 }}>
                            {cat}
                          </div>
                          {catAssets.map(asset => (
                            <div key={asset.id} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)",
                            }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {asset.name}
                                </div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.35, marginTop: 2 }}>
                                  {asset.file_type} · {formatFileSize(asset.file_size_bytes)}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                                <a href={asset.file_url} target="_blank" rel="noopener noreferrer" style={{
                                  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                                  opacity: 0.5, textDecoration: "none", color: "var(--ink)", padding: "4px",
                                }}>↓</a>
                                <button onClick={() => deleteBrandAsset(asset.id)} style={{
                                  fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.35,
                                  background: "none", border: "none", cursor: "pointer", color: "var(--ink)", padding: "4px",
                                }}>✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Color Palette ── */}
              <div style={{ marginBottom: 40 }}>
                <SectionHeader label="Color palette" />
                <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "end" }}>
                  <div style={{
                    width: 36, height: 36, flexShrink: 0,
                    background: colorForm.hex.length >= 4 ? colorForm.hex : "#ccc",
                    border: "0.5px solid rgba(15,15,14,0.12)",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={formLabel}>Name</div>
                    <input value={colorForm.name} onChange={e => setColorForm(f => ({ ...f, name: e.target.value }))} placeholder="Sage" style={formInput} />
                  </div>
                  <div style={{ width: 110 }}>
                    <div style={formLabel}>Hex</div>
                    <input value={colorForm.hex} onChange={e => setColorForm(f => ({ ...f, hex: e.target.value }))} placeholder="#7A7F6A" style={{ ...formInput, fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }} />
                  </div>
                  <button onClick={addColorSwatch} disabled={!colorForm.name.trim() || !colorForm.hex.trim()} style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    background: "transparent", border: "0.5px solid rgba(15,15,14,0.2)",
                    padding: "9px 14px", color: "var(--ink)", cursor: "pointer",
                    opacity: !colorForm.name.trim() || !colorForm.hex.trim() ? 0.3 : 0.6,
                    flexShrink: 0,
                  }}>Add</button>
                </div>

                {colorSwatches.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10 }}>
                    {colorSwatches.map(c => (
                      <div key={c.id} style={{ position: "relative" }}>
                        <div style={{
                          height: 52, background: c.hex,
                          border: "0.5px solid rgba(15,15,14,0.08)",
                        }} />
                        <div style={{ padding: "6px 0" }}>
                          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.7 }}>{c.name}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.35 }}>{c.hex}</div>
                        </div>
                        <button onClick={() => deleteColorSwatch(c.id)} style={{
                          position: "absolute", top: 4, right: 4,
                          fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.4,
                          background: "rgba(255,255,255,0.7)", border: "none", cursor: "pointer",
                          color: "var(--ink)", padding: "2px 4px", lineHeight: 1,
                        }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Typography ── */}
              <div style={{ marginBottom: 40 }}>
                <SectionHeader label="Typography" />
                <div className="form-grid-3col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 16, alignItems: "end" }}>
                  <div>
                    <div style={formLabel}>Font name</div>
                    <input value={typefaceForm.name} onChange={e => setTypefaceForm(f => ({ ...f, name: e.target.value }))} placeholder="PP Writer" style={formInput} />
                  </div>
                  <div>
                    <div style={formLabel}>Weight</div>
                    <input value={typefaceForm.weight} onChange={e => setTypefaceForm(f => ({ ...f, weight: e.target.value }))} placeholder="Book" style={formInput} />
                  </div>
                  <div>
                    <div style={formLabel}>Role</div>
                    <input value={typefaceForm.role} onChange={e => setTypefaceForm(f => ({ ...f, role: e.target.value }))} placeholder="Headlines" style={formInput} />
                  </div>
                  <button onClick={addTypefaceEntry} disabled={!typefaceForm.name.trim()} style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    background: "transparent", border: "0.5px solid rgba(15,15,14,0.2)",
                    padding: "9px 14px", color: "var(--ink)", cursor: "pointer",
                    opacity: !typefaceForm.name.trim() ? 0.3 : 0.6, flexShrink: 0,
                  }}>Add</button>
                </div>

                {typefaceEntries.map(tf => (
                  <div key={tf.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)",
                  }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.8 }}>
                        {tf.name}{tf.weight ? ` — ${tf.weight}` : ""}
                      </div>
                      {tf.role && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.35, marginTop: 2 }}>
                          {tf.role}
                        </div>
                      )}
                    </div>
                    <button onClick={() => deleteTypefaceEntry(tf.id)} style={{
                      fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.35,
                      background: "none", border: "none", cursor: "pointer", color: "var(--ink)", padding: "4px",
                    }}>✕</button>
                  </div>
                ))}
              </div>

              {/* Preview link */}
              <Link href={`/admin/library/${params.id}`} target="_blank" style={actionBtn}>
                Preview client view ↗
              </Link>
            </div>
          )}
        </div>
        <div className="admin-studio-right" style={{ padding: "32px 28px", borderLeft: "0.5px solid rgba(15,15,14,0.08)" }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 12 }}>Client</div>
            {[
              { label: "Contact",  value: client.contact_name },
              { label: "Email",    value: client.contact_email },
              { label: "Projects", value: String(projects.length) },
              { label: "Last seen", value: client.last_seen_at ? new Date(client.last_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid rgba(15,15,14,0.06)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any }}>{row.label}</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-body)" as any, textAlign: "right", maxWidth: 160, wordBreak: "break-all" }}>{row.value}</span>
              </div>
            ))}
            {client.notes && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-muted)" as any, lineHeight: 1.6, marginTop: 10 }}>{client.notes}</div>}
            <Link href={`/admin/library/${params.id}`} target="_blank" style={{ fontFamily: "var(--font-mono)", display: "inline-block", marginTop: 14, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink)", opacity: "var(--op-muted)" as any, textDecoration: "none", border: "0.5px solid rgba(15,15,14,0.2)", padding: "7px 14px" }}>
              Preview brand library ↗
            </Link>
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 12 }}>Financials</div>
            {[
              { label: "Contract value", value: `$${(contractVal / 100).toLocaleString()}`,   color: undefined },
              { label: "Collected",      value: `$${(collected / 100).toLocaleString()}`,     color: "var(--sage)" },
              { label: "Outstanding",    value: `$${(outstanding / 100).toLocaleString()}`,   color: outstanding > 0 ? "var(--amber)" : undefined },
              { label: "On delivery",    value: `$${(onDelivery / 100).toLocaleString()}`,    color: undefined },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid rgba(15,15,14,0.06)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any }}>{row.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: row.color ?? "var(--ink)", opacity: row.color ? 1 : "var(--op-body)" as any }}>{row.value}</span>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 12 }}>Messages</div>
            {projects.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {projects.length > 1 && (
                  <select value={replyProjectId} onChange={e => setReplyProjectId(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", background: "transparent", border: "0.5px solid rgba(15,15,14,0.12)", padding: "5px 8px", color: "var(--ink)", outline: "none", width: "100%", marginBottom: 6 }}>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                )}
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={`Reply to ${client.contact_name}…`} rows={3} style={{ width: "100%", boxSizing: "border-box", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", background: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(15,15,14,0.12)", padding: "9px 12px", color: "var(--ink)", resize: "none", outline: "none", marginBottom: 6, lineHeight: 1.5 }} />
                <button onClick={sendReply} disabled={sendingReply || !replyText.trim()} style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", background: "transparent", border: "0.5px solid rgba(15,15,14,0.15)", padding: "9px", color: "var(--ink)", opacity: sendingReply || !replyText.trim() ? 0.3 : 0.6, cursor: sendingReply || !replyText.trim() ? "default" : "pointer" }}>
                  {sendingReply ? "Sending…" : "Send reply"}
                </button>
              </div>
            )}
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ padding: "10px 0", borderBottom: "0.5px solid rgba(15,15,14,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any, textTransform: "uppercase", letterSpacing: "0.08em" }}>{msg.from_client ? msg.sender_name : "Studio Cinq"}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-ghost)" as any }}>{new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                  {msg.projects?.title && <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.35, marginBottom: 3 }}>{msg.projects.title}</div>}
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-body)" as any, lineHeight: 1.55 }}>{msg.body}</div>
                </div>
              ))}
              {messages.length === 0 && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.4, paddingTop: 8, lineHeight: 1.7 }}>No messages yet. Send the first one to start the conversation.</div>}
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  )
}

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const formatFileSize = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`

const formatMinutes = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 14 }}>
      {label}
    </div>
  )
}

function ProjectStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { active: "var(--sage)", complete: "rgba(15,15,14,0.4)", on_hold: "var(--amber)", proposal_sent: "var(--amber)" }
  const labels: Record<string, string> = { active: "Active", complete: "Complete", on_hold: "On hold", proposal_sent: "Proposal sent" }
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)" }}>{labels[status] ?? status}</span>
}

function InvStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { paid: "var(--sage)", sent: "var(--amber)", overdue: "var(--danger)", draft: "rgba(15,15,14,0.35)" }
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em", textTransform: "uppercase", color: colors[status] ?? "rgba(15,15,14,0.4)" }}>{status}</span>
}

const actionBtn: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
  color: "var(--ink)", opacity: 0.6, textDecoration: "none",
  border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
  display: "inline-block",
}

const formLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
  opacity: 0.45, marginBottom: 6,
}

const formInput: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
  background: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(15,15,14,0.12)",
  padding: "9px 12px", color: "var(--ink)", outline: "none",
}