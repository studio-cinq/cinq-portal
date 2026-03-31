"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
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
const HOUR_START = 7
const HOUR_END = 18  // 6pm
const HOUR_COUNT = HOUR_END - HOUR_START + 1
const ROW_H = 52  // px per hour slot
const SNAP_MINUTES = 15

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fmtTime(time: string | null) {
  if (!time) return null
  const [h, m] = time.split(":")
  const hour = parseInt(h)
  return `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? "PM" : "AM"}`
}

function fmtHourLabel(hour: number) {
  if (hour === 0) return "12 AM"
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return "12 PM"
  return `${hour - 12} PM`
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function snapMinutes(mins: number): number {
  return Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES
}

function getWeekStart(d: Date) {
  const day = d.getDay()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}

const emptyForm = {
  client_id: "", project_id: "", title: "", event_date: "", event_time: "",
  duration_minutes: "", type: "meeting", notes: "",
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const { show: showToast, ToastContainer } = useToast()

  const [form, setForm] = useState({ ...emptyForm })

  // ── Drag state ─────────────────────────────────────────
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ date: string; time?: string } | null>(null)
  const weekGridRef = useRef<HTMLDivElement>(null)

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
      project_id: e.project_id ?? null,
      project_title: e.projects?.title ?? null, notes: e.notes, is_auto: false,
    })),
    ...invoices.map((inv: any) => ({
      id: `inv-${inv.id}`, title: `Invoice #${inv.invoice_number} — $${(inv.amount / 100).toLocaleString()}`,
      event_date: inv.due_date, event_time: null, duration_minutes: null, type: "invoice_due",
      client_name: (inv.clients as any)?.name ?? "—", client_id: inv.client_id,
      project_id: inv.project_id ?? null,
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
  function resetForm() {
    setForm({ ...emptyForm })
    setEditingId(null)
    setShowAdd(false)
  }

  function startEdit(evt: any) {
    if (evt.is_auto) return
    setEditingId(evt.id)
    setShowAdd(true)
    setForm({
      client_id: evt.client_id ?? "",
      project_id: evt.project_id ?? "",
      title: evt.title ?? "",
      event_date: evt.event_date ?? "",
      event_time: evt.event_time ?? "",
      duration_minutes: evt.duration_minutes ? String(evt.duration_minutes) : "",
      type: evt.type ?? "meeting",
      notes: evt.notes ?? "",
    })
  }

  async function saveEvent() {
    if (!form.client_id || !form.title.trim() || !form.event_date) return
    setSaving(true)

    const payload = {
      client_id: form.client_id, project_id: form.project_id || null,
      title: form.title.trim(), event_date: form.event_date,
      event_time: form.event_time || null,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      type: form.type, notes: form.notes.trim() || null,
    }

    if (editingId) {
      const res = await fetch("/api/admin/events", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      })
      const json = await res.json()
      setSaving(false)
      if (res.ok && json.event) {
        const { data } = await supabase.from("events").select("*, clients(name), projects(title)").eq("id", editingId).single()
        if (data) setEvents(prev => prev.map(e => e.id === editingId ? data : e))
        resetForm()
        showToast("Event updated")
      } else {
        showToast("Failed to update event", "error")
      }
    } else {
      const res = await fetch("/api/admin/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      setSaving(false)
      if (res.ok && json.event) {
        const { data } = await supabase.from("events").select("*, clients(name), projects(title)").eq("id", json.event.id).single()
        if (data) setEvents(prev => [...prev, data].sort((a: any, b: any) => a.event_date.localeCompare(b.event_date)))
        resetForm()
        showToast("Event added")
      } else {
        showToast("Failed to add event", "error")
      }
    }
  }

  async function deleteEvent(id: string) {
    const res = await fetch("/api/admin/events", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setEvents(prev => prev.filter(e => e.id !== id))
      if (editingId === id) resetForm()
      showToast("Event removed", "info")
    }
  }

  // ── Drag & drop ───────────────────────────────────────
  async function moveEvent(eventId: string, newDate: string, newTime?: string) {
    const updates: any = { event_date: newDate }
    if (newTime !== undefined) updates.event_time = newTime || null

    // Optimistic update
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updates } : e))

    const res = await fetch("/api/admin/events", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: eventId, ...updates }),
    })

    if (res.ok) {
      // Refresh the moved event to get joined data
      const { data } = await supabase.from("events").select("*, clients(name), projects(title)").eq("id", eventId).single()
      if (data) setEvents(prev => prev.map(e => e.id === eventId ? data : e))
      showToast("Event moved")
    } else {
      // Revert on failure
      loadAll()
      showToast("Failed to move event", "error")
    }
  }

  function handleDragStart(e: React.DragEvent, eventId: string) {
    if (eventId.startsWith("inv-")) { e.preventDefault(); return }
    e.dataTransfer.setData("text/plain", eventId)
    e.dataTransfer.effectAllowed = "move"
    setDragId(eventId)
  }

  function handleDragEnd() {
    setDragId(null)
    setDropTarget(null)
  }

  // Week view: compute date + time from mouse position over the grid
  function handleWeekGridDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (!weekGridRef.current) return

    const rect = weekGridRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // First 54px is the time label column
    const colWidth = (rect.width - 54) / 7
    const colIndex = Math.max(0, Math.min(6, Math.floor((x - 54) / colWidth)))
    const dayDate = weekDays[colIndex]
    if (!dayDate) return

    const rawMinutes = HOUR_START * 60 + (y / ROW_H) * 60
    const snapped = snapMinutes(Math.max(HOUR_START * 60, Math.min(HOUR_END * 60, rawMinutes)))

    setDropTarget({ date: toDateStr(dayDate), time: minutesToTime(snapped) })
  }

  function handleWeekGridDrop(e: React.DragEvent) {
    e.preventDefault()
    const eventId = e.dataTransfer.getData("text/plain")
    if (!eventId || eventId.startsWith("inv-") || !dropTarget) return
    moveEvent(eventId, dropTarget.date, dropTarget.time)
    setDragId(null)
    setDropTarget(null)
  }

  // Month view: drop onto a day cell
  function handleMonthCellDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  function handleMonthCellDrop(e: React.DragEvent, dateStr: string) {
    e.preventDefault()
    const eventId = e.dataTransfer.getData("text/plain")
    if (!eventId || eventId.startsWith("inv-")) return
    moveEvent(eventId, dateStr)
    setDragId(null)
    setDropTarget(null)
  }

  // All-day row drop
  function handleAllDayDrop(e: React.DragEvent, dateStr: string) {
    e.preventDefault()
    const eventId = e.dataTransfer.getData("text/plain")
    if (!eventId || eventId.startsWith("inv-")) return
    moveEvent(eventId, dateStr, "")  // empty string clears time → all day
    setDragId(null)
    setDropTarget(null)
  }

  if (loading) return (
    <>
      <PortalNav isAdmin />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35 }}>Loading…</div>
      </div>
    </>
  )

  const formValid = form.client_id && form.title.trim() && form.event_date

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
            <button onClick={() => { if (showAdd && !editingId) { resetForm() } else { resetForm(); setTimeout(() => setShowAdd(true), 0) } }} style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
              letterSpacing: "0.12em", textTransform: "uppercase",
              background: showAdd && !editingId ? "rgba(15,15,14,0.08)" : "transparent",
              border: "0.5px solid rgba(15,15,14,0.2)", padding: "6px 14px",
              cursor: "pointer", color: "var(--ink)", opacity: 0.65,
            }}>
              + Event
            </button>
          </div>
        </div>

        {/* Add / Edit event form */}
        {showAdd && (
          <div style={{ background: "rgba(255,255,255,0.4)", border: "0.5px solid rgba(15,15,14,0.1)", padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45 }}>
                {editingId ? "Edit event" : "New event"}
              </div>
              {editingId && (
                <button onClick={resetForm} style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.08em",
                  background: "none", border: "none", cursor: "pointer", color: "var(--ink)", opacity: 0.35,
                }}>
                  Cancel
                </button>
              )}
            </div>
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
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "100px 140px 1fr 1fr auto", gap: 12, alignItems: "end" }} className="form-grid-2col">
              <div>
                <div style={labelSm}>Duration (min)</div>
                <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="60" style={inputSm} />
              </div>
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
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={saveEvent} disabled={saving || !formValid} style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
                  background: "var(--ink)", color: "var(--cream)", border: "none", padding: "9px 16px",
                  cursor: saving || !formValid ? "default" : "pointer",
                  opacity: saving || !formValid ? 0.3 : 1,
                  height: "fit-content",
                }}>
                  {saving ? "…" : editingId ? "Save" : "Add"}
                </button>
                {editingId && (
                  <button onClick={() => deleteEvent(editingId)} style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
                    background: "none", color: "var(--ink)", border: "0.5px solid rgba(15,15,14,0.15)", padding: "9px 12px",
                    cursor: "pointer", opacity: 0.4, height: "fit-content",
                  }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── WEEK VIEW (time-slotted) ──────────────────── */}
        {view === "week" && (
          <div style={{ border: "0.5px solid rgba(15,15,14,0.1)", overflow: "hidden" }}>
            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "54px repeat(7, 1fr)", borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
              <div style={{ borderRight: "0.5px solid rgba(15,15,14,0.06)" }} />
              {weekDays.map(day => {
                const ds = toDateStr(day)
                const isToday = ds === todayStr
                return (
                  <div key={ds} style={{
                    padding: "12px 10px 10px",
                    borderRight: "0.5px solid rgba(15,15,14,0.06)",
                    background: isToday ? "rgba(15,15,14,0.04)" : "transparent",
                  }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.4, marginBottom: 4 }}>
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

            {/* All-day row */}
            {(() => {
              const hasAllDay = weekDays.some(day => {
                const ds = toDateStr(day)
                return (eventsByDate[ds] ?? []).some(e => !e.event_time)
              })
              if (!hasAllDay && !dragId) return null
              return (
                <div style={{ display: "grid", gridTemplateColumns: "54px repeat(7, 1fr)", borderBottom: "0.5px solid rgba(15,15,14,0.1)" }}>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.06em",
                    opacity: 0.3, padding: "6px 6px 6px 8px",
                    borderRight: "0.5px solid rgba(15,15,14,0.06)",
                    display: "flex", alignItems: "flex-start",
                  }}>
                    ALL DAY
                  </div>
                  {weekDays.map(day => {
                    const ds = toDateStr(day)
                    const isToday = ds === todayStr
                    const allDayEvts = (eventsByDate[ds] ?? []).filter(e => !e.event_time)
                    return (
                      <div
                        key={ds}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
                        onDrop={(e) => handleAllDayDrop(e, ds)}
                        style={{
                          padding: "4px 4px", borderRight: "0.5px solid rgba(15,15,14,0.06)",
                          background: isToday ? "rgba(15,15,14,0.02)" : "transparent",
                          display: "flex", flexDirection: "column", gap: 2, minHeight: 28,
                        }}
                      >
                        {allDayEvts.map(evt => (
                          <EventChip
                            key={evt.id} evt={evt} compact
                            onEdit={() => startEdit(evt)}
                            onDelete={!evt.is_auto ? () => deleteEvent(evt.id) : undefined}
                            draggable={!evt.is_auto}
                            onDragStart={(e) => handleDragStart(e, evt.id)}
                            onDragEnd={handleDragEnd}
                            isDragging={dragId === evt.id}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Time-slotted grid */}
            <div
              ref={weekGridRef}
              onDragOver={handleWeekGridDragOver}
              onDrop={handleWeekGridDrop}
              style={{ display: "grid", gridTemplateColumns: "54px repeat(7, 1fr)", overflowY: "auto", maxHeight: `${HOUR_COUNT * ROW_H + 2}px`, position: "relative" }}
            >
              {/* Time labels column */}
              <div style={{ borderRight: "0.5px solid rgba(15,15,14,0.06)" }}>
                {Array.from({ length: HOUR_COUNT }, (_, i) => {
                  const hour = HOUR_START + i
                  return (
                    <div key={hour} style={{
                      height: ROW_H,
                      display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                      paddingRight: 8, paddingTop: 0,
                      borderBottom: "0.5px solid rgba(15,15,14,0.06)",
                    }}>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.04em",
                        opacity: 0.3, marginTop: -5, whiteSpace: "nowrap",
                      }}>
                        {fmtHourLabel(hour)}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Day columns with positioned events */}
              {weekDays.map(day => {
                const ds = toDateStr(day)
                const isToday = ds === todayStr
                const dayEvents = (eventsByDate[ds] ?? []).filter(e => e.event_time)

                return (
                  <div key={ds} style={{
                    position: "relative",
                    borderRight: "0.5px solid rgba(15,15,14,0.06)",
                    background: isToday ? "rgba(15,15,14,0.02)" : "transparent",
                  }}>
                    {/* Hour grid lines */}
                    {Array.from({ length: HOUR_COUNT }, (_, i) => (
                      <div key={i} style={{
                        height: ROW_H,
                        borderBottom: "0.5px solid rgba(15,15,14,0.06)",
                      }} />
                    ))}

                    {/* Drop target indicator */}
                    {dragId && dropTarget?.date === ds && dropTarget.time && (() => {
                      const mins = timeToMinutes(dropTarget.time)
                      const offset = mins - HOUR_START * 60
                      const top = (offset / 60) * ROW_H
                      return (
                        <div style={{
                          position: "absolute", top, left: 3, right: 3, height: 2,
                          background: "var(--sage)", opacity: 0.6, zIndex: 10,
                          borderRadius: 1, pointerEvents: "none",
                        }}>
                          <span style={{
                            position: "absolute", left: 0, top: -14,
                            fontFamily: "var(--font-mono)", fontSize: 9,
                            color: "var(--sage)", opacity: 0.9, whiteSpace: "nowrap",
                          }}>
                            {fmtTime(dropTarget.time)}
                          </span>
                        </div>
                      )
                    })()}

                    {/* Positioned events */}
                    {dayEvents.map(evt => {
                      const mins = timeToMinutes(evt.event_time)
                      const startOffset = mins - HOUR_START * 60
                      const top = Math.max(0, (startOffset / 60) * ROW_H)
                      const duration = evt.duration_minutes ?? 30
                      const height = Math.max(40, (duration / 60) * ROW_H)

                      return (
                        <div
                          key={evt.id}
                          onClick={() => startEdit(evt)}
                          style={{
                            position: "absolute",
                            top, left: 3, right: 3,
                            minHeight: 40,
                            height,
                            zIndex: dragId === evt.id ? 1 : 2,
                            opacity: dragId === evt.id ? 0.35 : 1,
                            transition: "opacity 0.15s",
                          }}
                        >
                          <EventChip
                            evt={evt} timed
                            onDelete={!evt.is_auto ? () => deleteEvent(evt.id) : undefined}
                            draggable={!evt.is_auto}
                            onDragStart={(e) => handleDragStart(e, evt.id)}
                            onDragEnd={handleDragEnd}
                            isDragging={dragId === evt.id}
                          />
                        </div>
                      )
                    })}
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
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
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
                if (!day) return (
                  <div
                    key={`empty-${i}`}
                    onDragOver={handleMonthCellDragOver}
                    style={{ minHeight: 100, borderRight: "0.5px solid rgba(15,15,14,0.06)", borderBottom: "0.5px solid rgba(15,15,14,0.06)", background: "rgba(15,15,14,0.02)" }}
                  />
                )
                const ds = toDateStr(day)
                const isToday = ds === todayStr
                const dayEvents = eventsByDate[ds] ?? []
                const isDropHere = dragId && dropTarget?.date === ds
                return (
                  <div
                    key={ds}
                    onDragOver={(e) => {
                      handleMonthCellDragOver(e)
                      setDropTarget({ date: ds })
                    }}
                    onDragLeave={() => { if (dropTarget?.date === ds) setDropTarget(null) }}
                    onDrop={(e) => handleMonthCellDrop(e, ds)}
                    style={{
                      minHeight: 100, padding: "6px 6px 4px",
                      borderRight: "0.5px solid rgba(15,15,14,0.06)",
                      borderBottom: "0.5px solid rgba(15,15,14,0.06)",
                      background: isDropHere ? "rgba(143,167,181,0.08)" : isToday ? "rgba(15,15,14,0.04)" : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
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
                        <EventChip
                          key={evt.id} evt={evt} compact
                          onEdit={() => startEdit(evt)}
                          onDelete={!evt.is_auto ? () => deleteEvent(evt.id) : undefined}
                          draggable={!evt.is_auto}
                          onDragStart={(e) => handleDragStart(e, evt.id)}
                          onDragEnd={handleDragEnd}
                          isDragging={dragId === evt.id}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.35, paddingLeft: 4 }}>
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
function EventChip({ evt, compact, timed, onEdit, onDelete, draggable, onDragStart, onDragEnd, isDragging }: {
  evt: any; compact?: boolean; timed?: boolean;
  onEdit?: () => void; onDelete?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) {
  const [hovered, setHovered] = useState(false)
  const bgColors: Record<string, string> = {
    meeting: "rgba(201,90,59,0.12)", presentation: "rgba(201,90,59,0.10)",
    milestone: "rgba(143,167,181,0.12)", work: "rgba(15,15,14,0.08)", invoice_due: "rgba(15,15,14,0.06)",
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { if (onEdit && !evt.is_auto) { e.stopPropagation(); onEdit() } }}
      style={{
        background: bgColors[evt.type] ?? "rgba(15,15,14,0.05)",
        borderLeft: `2px solid ${TYPE_COLORS[evt.type] ?? "var(--ink)"}`,
        padding: compact ? "2px 5px" : timed ? "4px 6px" : "5px 8px 4px",
        position: "relative",
        cursor: draggable ? "grab" : evt.is_auto ? "default" : "pointer",
        minHeight: timed ? "100%" : "auto",
        boxSizing: "border-box",
        opacity: isDragging ? 0.35 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {evt.event_time && !compact && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.45, marginBottom: 1 }}>
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
      {!compact && !timed && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.35, marginTop: 1 }}>
          {evt.client_name}{evt.project_title ? ` · ${evt.project_title}` : ""}
        </div>
      )}
      {timed && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.35, marginTop: 1 }}>
          {evt.client_name}
        </div>
      )}
      {onDelete && hovered && !isDragging && (
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
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em",
  textTransform: "uppercase", opacity: 0.4, marginBottom: 4,
}

const inputSm: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
  background: "rgba(255,255,255,0.5)", border: "0.5px solid rgba(15,15,14,0.12)",
  padding: "8px 10px", color: "var(--ink)", outline: "none",
}
