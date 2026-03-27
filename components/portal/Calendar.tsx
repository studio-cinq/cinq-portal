"use client"

import { useState } from "react"

interface CalendarEvent {
  id: string
  event_date: string
  type: string
  title: string
}

interface CalendarProps {
  events: CalendarEvent[]
  onDateClick?: (date: string) => void
  compact?: boolean
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const TYPE_COLORS: Record<string, string> = {
  meeting:      "var(--amber)",
  presentation: "var(--amber)",
  milestone:    "var(--sage)",
  invoice_due:  "var(--ink)",
}

export default function Calendar({ events, onDateClick, compact }: CalendarProps) {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const { year, month } = viewDate

  function prev() {
    setViewDate(v => v.month === 0
      ? { year: v.year - 1, month: 11 }
      : { ...v, month: v.month - 1 }
    )
  }

  function next() {
    setViewDate(v => v.month === 11
      ? { year: v.year + 1, month: 0 }
      : { ...v, month: v.month + 1 }
    )
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  const monthLabel = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" })

  // Map event dates to their types for this month
  const eventsByDate: Record<string, string[]> = {}
  for (const evt of events) {
    const d = evt.event_date
    if (!d) continue
    const evtDate = new Date(d + "T00:00:00")
    if (evtDate.getFullYear() === year && evtDate.getMonth() === month) {
      if (!eventsByDate[d]) eventsByDate[d] = []
      if (!eventsByDate[d].includes(evt.type)) eventsByDate[d].push(evt.type)
    }
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const cellSize = compact ? 28 : 34

  return (
    <div>
      {/* Month nav */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: compact ? 10 : 14,
      }}>
        <button onClick={prev} style={navBtn}>←</button>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-eyebrow)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          opacity: 0.6,
        }}>
          {monthLabel}
        </span>
        <button onClick={next} style={navBtn}>→</button>
      </div>

      {/* Day labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0, marginBottom: 4 }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{
            fontFamily: "var(--font-mono)",
            fontSize: 7,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textAlign: "center",
            opacity: 0.35,
            padding: "4px 0",
          }}>
            {compact ? d.charAt(0) : d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} style={{ height: cellSize }} />

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const isToday = dateStr === todayStr
          const dayTypes = eventsByDate[dateStr] ?? []
          const hasEvents = dayTypes.length > 0

          return (
            <div
              key={dateStr}
              onClick={() => hasEvents && onDateClick?.(dateStr)}
              style={{
                height: cellSize,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: hasEvents && onDateClick ? "pointer" : "default",
                position: "relative",
              }}
            >
              <span style={{
                fontFamily: "var(--font-sans)",
                fontSize: compact ? 10 : 11,
                opacity: isToday ? 0.95 : hasEvents ? 0.7 : 0.3,
                fontWeight: isToday ? 500 : 400,
                width: compact ? 20 : 24,
                height: compact ? 20 : 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: isToday ? "var(--ink)" : "transparent",
                color: isToday ? "var(--cream)" : "var(--ink)",
              }}>
                {day}
              </span>
              {/* Event dots */}
              {hasEvents && (
                <div style={{
                  display: "flex", gap: 2,
                  position: "absolute",
                  bottom: compact ? 1 : 2,
                }}>
                  {dayTypes.slice(0, 3).map((type, j) => (
                    <div key={j} style={{
                      width: 3, height: 3, borderRadius: "50%",
                      background: TYPE_COLORS[type] ?? "var(--ink)",
                      opacity: 0.7,
                    }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--ink)",
  opacity: 0.4,
  padding: "4px 8px",
}
