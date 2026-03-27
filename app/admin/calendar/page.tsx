"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import PortalNav from "@/components/portal/Nav"
import Calendar from "@/components/portal/Calendar"
import { useToast } from "@/components/portal/Toast"
import Link from "next/link"

const TYPE_COLORS: Record<string, string> = {
  meeting:      "var(--amber)",
  presentation: "var(--amber)",
  milestone:    "var(--sage)",
  invoice_due:  "var(--ink)",
}

const TYPE_LABELS: Record<string, string> = {
  meeting:      "Meeting",
  presentation: "Presentation",
  milestone:    "Milestone",
  invoice_due:  "Invoice due",
}

export default function AdminCalendarPage() {
  const [events, setEvents]       = useState<any[]>([])
  const [invoices, setInvoices]   = useState<any[]>([])
  const [clients, setClients]     = useState<any[]>([])
  const [projects, setProjects]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [filterClient, setFilterClient] = useState("")
  const [filterType, setFilterType]     = useState("")
  const { show: showToast, ToastContainer } = useToast()

  const [form, setForm] = useState({
    client_id: "", project_id: "", title: "", event_date: "", event_time: "",
    duration_minutes: "", type: "meeting", notes: "",
  })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)

    const [evtRes, invRes, cliRes, projRes] = await Promise.all([
      supabase.from("events").select("*, clients(name), projects(title)").order("event_date"),
      supabase.from("invoices").select("*, clients(name), projects(title)").in("status", ["sent", "overdue"]).not("due_date", "is", null),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("projects").select("id, title, client_id").order("title"),
    ])

    setEvents(evtRes.data ?? [])
    setInvoices(invRes.data ?? [])
    setClients(cliRes.data ?? [])
    setProjects(projRes.data ?? [])
    setLoading(false)
  }

  // Combine manual events + auto invoice events
  const allEvents = [
    ...events.map((e: any) => ({
      id: e.id, title: e.title, event_date: e.event_date, event_time: e.event_time,
      type: e.type, client_name: e.clients?.name ?? "—", client_id: e.client_id,
      project_title: e.projects?.title ?? null, notes: e.notes, is_auto: false,
    })),
    ...invoices.map((inv: any) => ({
      id: `inv-${inv.id}`, title: `Invoice #${inv.invoice_number} — $${(inv.amount / 100).toLocaleString()}`,
      event_date: inv.due_date, event_time: null, type: "invoice_due",
      client_name: (inv.clients as any)?.name ?? "—", client_id: inv.client_id,
      project_title: (inv.projects as any)?.title ?? null, notes: null, is_auto: true,
    })),
  ]

  // Apply filters
  const filteredEvents = allEvents.filter(e => {
    if (filterClient && e.client_id !== filterClient) return false
    if (filterType && e.type !== filterType) return false
    return true
  }).sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.event_time ?? "").localeCompare(b.event_time ?? ""))

  // Filtered projects for the form based on selected client
  const formProjects = form.client_id
    ? projects.filter(p => p.client_id === form.client_id)
    : []

  async function addEvent() {
    if (!form.client_id || !form.title.trim() || !form.event_date) return
    setSaving(true)
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: form.client_id,
        project_id: form.project_id || null,
        title: form.title.trim(),
        event_date: form.event_date,
        event_time: form.event_time || null,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        type: form.type,
        notes: form.notes.trim() || null,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (res.ok && json.event) {
      const { data } = await supabase.from("events").select("*, clients(name), projects(title)").eq("id", json.event.id).single()
      if (data) setEvents(prev => [...prev, data].sort((a: any, b: any) => a.event_date.localeCompare(b.event_date)))
      setForm({ client_id: "", project_id: "", title: "", event_date: "", event_time: "", duration_minutes: "", type: "meeting", notes: "" })
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

  function formatTime(time: string | null) {
    if (!time) return null
    const [h, m] = time.split(":")
    const hour = parseInt(h)
    return `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? "PM" : "AM"}`
  }

  // Upcoming vs past
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const upcoming = filteredEvents.filter(e => e.event_date >= todayStr)
  const past = filteredEvents.filter(e => e.event_date < todayStr).reverse()

  if (loading) return (
    <>
      <PortalNav isAdmin />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>Loading…</div>
      </div>
    </>
  )

  return (
    <>
      <PortalNav isAdmin />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 40px 60px" }} className="admin-page-pad">

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5 }}>
            Calendar — {upcoming.length} upcoming
          </div>
          {/* Filters */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={filterSelect}>
              <option value="">All clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={filterSelect}>
              <option value="">All types</option>
              <option value="meeting">Meetings</option>
              <option value="presentation">Presentations</option>
              <option value="milestone">Milestones</option>
              <option value="invoice_due">Invoice dues</option>
            </select>
          </div>
        </div>

        <div className="admin-studio-grid" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 36 }}>

          {/* Left — Calendar + legend + add form */}
          <div className="admin-studio-left" style={{ borderRight: "0.5px solid rgba(15,15,14,0.08)", paddingRight: 36 }}>
            <Calendar events={filteredEvents.map(e => ({ id: e.id, event_date: e.event_date, type: e.type, title: e.title }))} />

            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16, paddingTop: 12, borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
              {[
                { label: "Meeting", color: "var(--amber)" },
                { label: "Milestone", color: "var(--sage)" },
                { label: "Invoice", color: "var(--ink)" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: l.color, opacity: 0.7 }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.45 }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Quick add */}
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 14 }}>Quick add</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={labelSm}>Client *</div>
                  <select value={form.client_id} onChange={e => { setForm(f => ({ ...f, client_id: e.target.value, project_id: "" })) }} style={inputSm}>
                    <option value="">Select…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <div style={labelSm}>Title *</div>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brand review call" style={inputSm} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={labelSm}>Date *</div>
                    <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} style={inputSm} />
                  </div>
                  <div>
                    <div style={labelSm}>Time</div>
                    <input type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} style={inputSm} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={labelSm}>Type</div>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputSm}>
                      <option value="meeting">Meeting</option>
                      <option value="presentation">Presentation</option>
                      <option value="milestone">Milestone</option>
                    </select>
                  </div>
                  <div>
                    <div style={labelSm}>Project</div>
                    <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} disabled={!form.client_id} style={{ ...inputSm, opacity: form.client_id ? 1 : 0.4 }}>
                      <option value="">—</option>
                      {formProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div style={labelSm}>Notes</div>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional…" style={inputSm} />
                </div>

                <button onClick={addEvent} disabled={saving || !form.client_id || !form.title.trim() || !form.event_date} style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
                  background: "var(--ink)", color: "var(--cream)", border: "none", padding: "10px",
                  cursor: saving || !form.client_id || !form.title.trim() || !form.event_date ? "default" : "pointer",
                  opacity: saving || !form.client_id || !form.title.trim() || !form.event_date ? 0.3 : 1,
                  transition: "opacity 0.2s",
                }}>
                  {saving ? "Adding…" : "Add event"}
                </button>
              </div>
            </div>
          </div>

          {/* Right — Event list */}
          <div className="admin-studio-right">

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginBottom: 14 }}>
                  Upcoming
                </div>
                {upcoming.map(evt => (
                  <EventRow key={evt.id} evt={evt} todayStr={todayStr} formatTime={formatTime} onDelete={!evt.is_auto ? () => deleteEvent(evt.id) : undefined} />
                ))}
              </div>
            )}

            {upcoming.length === 0 && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: 0.35, padding: "20px 0 36px" }}>
                No upcoming events{filterClient || filterType ? " matching this filter" : ""}. Add one from the left panel.
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35, marginBottom: 14 }}>
                  Past
                </div>
                {past.slice(0, 10).map(evt => (
                  <EventRow key={evt.id} evt={evt} todayStr={todayStr} formatTime={formatTime} onDelete={!evt.is_auto ? () => deleteEvent(evt.id) : undefined} dimmed />
                ))}
                {past.length > 10 && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.3, paddingTop: 8 }}>
                    + {past.length - 10} more past events
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <ToastContainer />
    </>
  )
}

function EventRow({ evt, todayStr, formatTime, onDelete, dimmed }: {
  evt: any; todayStr: string; formatTime: (t: string | null) => string | null;
  onDelete?: () => void; dimmed?: boolean
}) {
  const isToday = evt.event_date === todayStr
  const dateObj = new Date(evt.event_date + "T00:00:00")

  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "13px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)", gap: 12,
      opacity: dimmed ? 0.5 : 1,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.08em", textTransform: "uppercase",
            opacity: isToday ? 0.85 : 0.45,
            color: isToday ? "var(--amber)" : "var(--ink)",
            minWidth: 55,
          }}>
            {isToday ? "Today" : dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          {evt.event_time && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.3 }}>
              {formatTime(evt.event_time)}
            </span>
          )}
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "2px 7px",
            border: `0.5px solid ${TYPE_COLORS[evt.type] ?? "var(--ink)"}40`,
            color: TYPE_COLORS[evt.type] ?? "var(--ink)",
          }}>
            {TYPE_LABELS[evt.type] ?? evt.type}
          </span>
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-body)" as any, marginBottom: 2 }}>
          {evt.title}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <Link href={`/admin/clients/${evt.client_id}`} style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
            opacity: 0.4, textDecoration: "none",
          }}>
            {evt.client_name}
          </Link>
          {evt.project_title && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", opacity: 0.25 }}>
              · {evt.project_title}
            </span>
          )}
        </div>
        {evt.notes && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: 0.35, marginTop: 4, lineHeight: 1.5 }}>{evt.notes}</div>}
      </div>
      {onDelete && (
        <button onClick={onDelete} style={{
          fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
          opacity: 0.2, background: "none", border: "none", cursor: "pointer",
          color: "var(--ink)", flexShrink: 0, padding: "2px 6px",
        }}>
          ✕
        </button>
      )}
    </div>
  )
}

const filterSelect: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
  background: "transparent", border: "0.5px solid rgba(15,15,14,0.15)",
  padding: "6px 10px", color: "var(--ink)", outline: "none", cursor: "pointer",
}

const labelSm: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.1em",
  textTransform: "uppercase", opacity: 0.4, marginBottom: 4,
}

const inputSm: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
  background: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(15,15,14,0.12)",
  padding: "8px 10px", color: "var(--ink)", outline: "none",
}
