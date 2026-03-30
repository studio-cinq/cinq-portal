"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import PortalNav from "@/components/portal/Nav"
import { useToast } from "@/components/portal/Toast"
import Link from "next/link"

const TYPE_COLORS: Record<string, string> = {
  meeting:      "var(--amber)",
  presentation: "var(--amber)",
  milestone:    "var(--sage)",
  work:         "var(--ink)",
  invoice_due:  "var(--ink)",
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fmtTime(time: string | null) {
  if (!time) return null
  const [h, m] = time.split(":")
  const hour = parseInt(h)
  return `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? "PM" : "AM"}`
}

function getWeekStart(d: Date) {
  const day = d.getDay()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}

export default function AdminCalendarPage() {
  const [events, setEvents]       = useState<any[]>([])
  const [invoices, setInvoices]   = useState<any[]>([])
  const [clients, setClients]     = useState<any[]>([])
  const [projects, setProjects]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [view, setView]           = useState<"week" | "month">("week")
  const [viewDate, setViewDate]   = useState(new Date())
  const [filterClient, setFilterClient] = useState("")
  const [filterType, setFilterType]     = useState("")
  const [showAdd, setShowAdd]     = useState(false)
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

  const allEvents = useMemo(() => [
    ...events.map((e: any) => ({
      id: e.id, title: e.title, event_date: e.event_date, event_time: e.event_time,
      duration_minutes: e.duration_minutes ?? null,
      type: e.type, client_name: e.clients?.name ?? "—", client_id: e.client_id,
      project_title: e.projects?.title ?? null, notes: e.notes, is_auto: false,
    })),
    ...invoices.map((inv: any) => ({
      id: `inv-${inv.id}`, title: `Invoice #${inv.invoice_number} — $${(inv.amount / 100).toLocaleString()}`,
      event_date: inv.due_date, event_time: null, duration_minutes: null, type: "invoice_due",
      client_name: (inv.clients as any)?.name ?? "—", client_id: inv.client_id,
      project_title: (inv.projects as any)?.title ?? null, notes: null, is_auto: true,
    })),
  ], [events, invoices])

  const filteredEvents = useMemo(() => allEvents.filter(e => {
    if (filterClient && e.client_id !== filterClient) return false
    if (filterType && e.type !== filterType) return false
    return true
  }), [allEvents, filterClient, filterType])

  const eventsByDate = useMemo(() => {
    const map: Record<string, typeof filteredEvents> = {}
    for (const e of filteredEvents) {
      if (!map[e.event_date]) map[e.event_date] = []
      map[e.event_date].push(e)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.event_time ?? "").localeCompare(b.event_time ?? ""))
    }
    return map
  }, [filteredEvents])

  const formProjects = form.client_id ? projects.filter(p => p.client_id === form.client_id) : []
  const todayStr = toDateStr(new Date())

  // ── Navigation ─────────────────────────────────────────
  function navPrev() {
    if (view === "week") setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))
    else setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  function navNext() {
    if (view === "week") setViewDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))
    else setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }
  function goToday() { setViewDate(new Date()) }

  // ── Week data ──────────────────────────────────────────
  const weekStart = getWeekStart(viewDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
  const weekLabel = (() => {
    const first = weekDays[0], last = weekDays[6]
    if (first.getMonth() === last.getMonth()) {
      return `${first.toLocaleDateString("en-US", { month: "long" })} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`
    }
    return `${first.toLocaleDateString("en-US", { month: "short" })} ${first.getDate()} – ${last.toLocaleDateString("en-US", { month: "short" })} ${last.getDate()}, ${last.getFullYear()}`
  })()

  // ── Month data ─────────────────────────────────────────
  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const monthFirstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()
  const monthDaysCount = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const monthCells: (Date | null)[] = []
  for (let i = 0; i < monthFirstDay; i++) monthCells.push(null)
  for (let d = 1; d <= monthDaysCount; d++) monthCells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d))

  // ── Actions ────────────────────────────────────────────
  async function addEvent() {
    if (!form.client_id || !form.title.trim() || !form.event_date) return
    setSaving(true)
    const res = await fetch("/api/admin/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: form.client_id, project_id: form.project_id || null,
        title: form.title.trim(), event_date: form.event_date,
        event_time: form.event_time || null,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        type: form.type, notes: form.notes.trim() || null,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (res.ok && json.event) {
      const { data } = await supabase.from("events").select("*, clients(name), projects(title)").eq("id", json.event.id).single()
      if (data) setEvents(prev => [...prev, data].sort((a: any, b: any) => a.event_date.localeCompare(b.event_date)))
      setForm({ client_id: "", project_id: "", title: "", event_date: "", event_time: "", duration_minutes: "", type: "meeting", notes: "" })
      setShowAdd(false)
      showToast("Event added")
    } else {
      showToast("Failed to add event", "error")
    }
  }

  async function deleteEvent(id: string) {
    const res = await fetch("/api/admin/events", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setEvents(prev => prev.filter(e => e.id !== id))
      showToast("Event removed", "info")
    }
  }

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
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 40px 60px" }} className="admin-page-pad">

        {/* Header bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={navPrev} style={navBtnStyle}>←</button>
            <button onClick={goToday} style={{ ...navBtnStyle, opacity: 0.45, fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", border: "0.5px solid rgba(15,15,14,0.15)" }}>
              Today
            </button>
            <button onClick={navNext} style={navBtnStyle}>→</button>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 18, letterSpacing: "-0.01em", opacity: 0.85 }}>
              {view === "week" ? weekLabel : monthLabel}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", border: "0.5px solid rgba(15,15,14,0.15)" }}>
              {(["week", "month"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  padding: "6px 14px", border: "none", cursor: "pointer",
                  background: view === v ? "var(--ink)" : "transparent",
                  color: view === v ? "var(--cream)" : "var(--ink)",
                  opacity: view === v ? 1 : 0.4, transition: "all 0.2s",
                }}>
                  {v}
                </button>
              ))}
            </div>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={filterSelect}>
              <option value="">All clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={filterSelect}>
              <option value="">All types</option>
              <option value="meeting">Meetings</option>
              <option value="presentation">Presentations</option>
              <option value="milestone">Milestones</option>
              <option value="work">Work time</option>
              <option value="invoice_due">Invoice dues</option>
            </select>
            <button onClick={() => setShowAdd(s => !s)} style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
              letterSpacing: "0.12em", textTransform: "uppercase",
              background: showAdd ? "rgba(15,15,14,0.08)" : "transparent",
              border: "0.5px solid rgba(15,15,14,0.2)", padding: "6px 14px",
              cursor: "pointer", color: "var(--ink)", opacity: 0.65,
            }}>
              + Event
            </button>
          </div>
        </div>

        {/* Add event form (collapsible) */}
        {showAdd && (
          <div style={{ background: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(15,15,14,0.1)", padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px 100px", gap: 12, marginBottom: 12 }} className="form-grid-2col">
              <div>
                <div style={labelSm}>Client *</div>
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value, project_id: "" }))} style={inputSm}>
                  <option value="">Select…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <div style={labelSm}>Title *</div>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brand review call" style={inputSm} />
              </div>
              <div>
                <div style={labelSm}>Date *</div>
                <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} style={inputSm} />
              </div>
              <div>
                <div style={labelSm}>Time</div>
                <input type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} style={inputSm} />
              </div>
              <div>
                <div style={labelSm}>Duration (min)</div>
                <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="60" style={inputSm} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr 100px", gap: 12, alignItems: "end" }} className="form-grid-2col">
              <div>
                <div style={labelSm}>Type</div>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputSm}>
                  <option value="meeting">Meeting</option>
                  <option value="presentation">Presentation</option>
                  <option value="milestone">Milestone</option>
                  <option value="work">Work time</option>
                </select>
              </div>
              <div>
                <div style={labelSm}>Project</div>
                <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} disabled={!form.client_id} style={{ ...inputSm, opacity: form.client_id ? 1 : 0.4 }}>
                  <option value="">—</option>
                  {formProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <div style={labelSm}>Notes</div>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional…" style={inputSm} />
              </div>
              <button onClick={addEvent} disabled={saving || !form.client_id || !form.title.trim() || !form.event_date} style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
                background: "var(--ink)", color: "var(--cream)", border: "none", padding: "9px 16px",
                cursor: saving || !form.client_id || !form.title.trim() || !form.event_date ? "default" : "pointer",
                opacity: saving || !form.client_id || !form.title.trim() || !form.event_date ? 0.3 : 1,
                height: "fit-content",
              }}>
                {saving ? "…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {/* ── WEEK VIEW ─────────────────────────────────── */}
        {view === "week" && (
          <div style={{ border: "0.5px solid rgba(15,15,14,0.1)", overflow: "hidden" }}>
            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
              {weekDays.map(day => {
                const ds = toDateStr(day)
                const isToday = ds === todayStr
                return (
                  <div key={ds} style={{
                    padding: "12px 10px 10px",
                    borderRight: "0.5px solid rgba(15,15,14,0.06)",
                    background: isToday ? "rgba(15,15,14,0.04)" : "transparent",
                  }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4, marginBottom: 4 }}>
                      {DAY_LABELS[day.getDay()]}
                    </div>
                    <div style={{
                      fontFamily: "var(--font-sans)", fontSize: 18, letterSpacing: "-0.01em",
                      opacity: isToday ? 0.95 : 0.5, fontWeight: isToday ? 500 : 400,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 28, height: 28, borderRadius: "50%",
                      background: isToday ? "var(--ink)" : "transparent",
                      color: isToday ? "var(--cream)" : "var(--ink)",
                    }}>
                      {day.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Event cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: 360 }}>
              {weekDays.map(day => {
                const ds = toDateStr(day)
                const isToday = ds === todayStr
                const dayEvents = eventsByDate[ds] ?? []
                return (
                  <div key={ds} style={{
                    padding: "8px 6px", borderRight: "0.5px solid rgba(15,15,14,0.06)",
                    background: isToday ? "rgba(15,15,14,0.02)" : "transparent",
                    minHeight: 120, display: "flex", flexDirection: "column", gap: 4,
                  }}>
                    {dayEvents.map(evt => (
                      <EventChip key={evt.id} evt={evt} onDelete={!evt.is_auto ? () => deleteEvent(evt.id) : undefined} />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── MONTH VIEW ────────────────────────────────── */}
        {view === "month" && (
          <div style={{ border: "0.5px solid rgba(15,15,14,0.1)", overflow: "hidden" }}>
            {/* Day labels */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{
                  fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em",
                  textTransform: "uppercase", opacity: 0.4,
                  padding: "10px 10px 8px", borderRight: "0.5px solid rgba(15,15,14,0.06)",
                }}>
                  {d}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {monthCells.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} style={{ minHeight: 100, borderRight: "0.5px solid rgba(15,15,14,0.06)", borderBottom: "0.5px solid rgba(15,15,14,0.06)", background: "rgba(15,15,14,0.02)" }} />
                const ds = toDateStr(day)
                const isToday = ds === todayStr
                const dayEvents = eventsByDate[ds] ?? []
                return (
                  <div key={ds} style={{
                    minHeight: 100, padding: "6px 6px 4px",
                    borderRight: "0.5px solid rgba(15,15,14,0.06)",
                    borderBottom: "0.5px solid rgba(15,15,14,0.06)",
                    background: isToday ? "rgba(15,15,14,0.04)" : "transparent",
                  }}>
                    <div style={{
                      fontFamily: "var(--font-sans)", fontSize: 11,
                      opacity: isToday ? 0.95 : 0.4, fontWeight: isToday ? 500 : 400,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 22, height: 22, borderRadius: "50%",
                      background: isToday ? "var(--ink)" : "transparent",
                      color: isToday ? "var(--cream)" : "var(--ink)",
                      marginBottom: 3,
                    }}>
                      {day.getDate()}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {dayEvents.slice(0, 3).map(evt => (
                        <EventChip key={evt.id} evt={evt} compact onDelete={!evt.is_auto ? () => deleteEvent(evt.id) : undefined} />
                      ))}
                      {dayEvents.length > 3 && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, opacity: 0.35, paddingLeft: 4 }}>
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
      <ToastContainer />
    </>
  )
}

// ── Event chip ───────────────────────────────────────────
function EventChip({ evt, compact, onDelete }: { evt: any; compact?: boolean; onDelete?: () => void }) {
  const [hovered, setHovered] = useState(false)
  const bgColors: Record<string, string> = {
    meeting: "rgba(176,125,58,0.12)", presentation: "rgba(176,125,58,0.10)",
    milestone: "rgba(107,143,113,0.12)", work: "rgba(15,15,14,0.08)", invoice_due: "rgba(15,15,14,0.06)",
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bgColors[evt.type] ?? "rgba(15,15,14,0.05)",
        borderLeft: `2px solid ${TYPE_COLORS[evt.type] ?? "var(--ink)"}`,
        padding: compact ? "2px 5px" : "5px 8px 4px",
        position: "relative", cursor: "default",
      }}
    >
      {evt.event_time && !compact && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, opacity: 0.45, marginBottom: 1 }}>
          {fmtTime(evt.event_time)}{evt.duration_minutes ? ` · ${evt.duration_minutes}m` : ""}
        </div>
      )}
      <div style={{
        fontFamily: "var(--font-sans)", fontSize: compact ? 9 : 11,
        opacity: 0.8, lineHeight: 1.3,
        whiteSpace: compact ? "nowrap" : "normal",
        overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {evt.title}
      </div>
      {!compact && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, opacity: 0.35, marginTop: 1 }}>
          {evt.client_name}{evt.project_title ? ` · ${evt.project_title}` : ""}
        </div>
      )}
      {onDelete && hovered && (
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} style={{
          position: "absolute", top: 2, right: 3,
          fontFamily: "var(--font-mono)", fontSize: 9,
          background: "rgba(255,255,255,0.8)", border: "none",
          cursor: "pointer", color: "var(--ink)", opacity: 0.4,
          padding: "0 3px", lineHeight: 1,
        }}>
          ✕
        </button>
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 13,
  background: "none", border: "none", cursor: "pointer",
  color: "var(--ink)", opacity: 0.4, padding: "4px 8px",
}

const filterSelect: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
  background: "transparent", border: "0.5px solid rgba(15,15,14,0.15)",
  padding: "6px 10px", color: "var(--ink)", outline: "none", cursor: "pointer",
}

const labelSm: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em",
  textTransform: "uppercase", opacity: 0.4, marginBottom: 4,
}

const inputSm: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
  background: "rgba(255,255,255,0.5)", border: "0.5px solid rgba(15,15,14,0.12)",
  padding: "8px 10px", color: "var(--ink)", outline: "none",
}
