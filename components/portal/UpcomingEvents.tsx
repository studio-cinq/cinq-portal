"use client"

import Calendar from "@/components/portal/Calendar"

interface Event {
  id: string
  title: string
  event_date: string
  event_time: string | null
  type: string
  project_title?: string
  notes?: string | null
}

interface UpcomingEventsProps {
  events: Event[]
}

const TYPE_COLORS: Record<string, string> = {
  meeting:      "var(--amber)",
  presentation: "var(--amber)",
  milestone:    "var(--sage)",
  work:         "var(--ink)",
  invoice_due:  "var(--ink)",
}

const TYPE_LABELS: Record<string, string> = {
  meeting:      "Meeting",
  presentation: "Presentation",
  milestone:    "Milestone",
  work:         "Work time",
  invoice_due:  "Invoice due",
}

function formatTime(time: string | null) {
  if (!time) return null
  const [h, m] = time.split(":")
  const hour = parseInt(h)
  const ampm = hour >= 12 ? "PM" : "AM"
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h12}:${m} ${ampm}`
}

export default function UpcomingEvents({ events }: UpcomingEventsProps) {
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  const upcoming = events
    .filter(e => e.event_date >= todayStr)
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.event_time ?? "").localeCompare(b.event_time ?? ""))
    .slice(0, 5)

  if (events.length === 0) return null

  return (
    <div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-eyebrow)",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        opacity: 0.38,
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        Upcoming
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
        background: "rgba(255,255,255,0.3)",
        border: "0.5px solid rgba(15,15,14,0.1)",
        padding: "20px 24px",
        marginBottom: 36,
      }}
        className="form-grid-2col"
      >
        {/* Calendar */}
        <div>
          <Calendar events={events} compact />
        </div>

        {/* Event list */}
        <div>
          {upcoming.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {upcoming.map(evt => {
                const dateObj = new Date(evt.event_date + "T00:00:00")
                const isToday = evt.event_date === todayStr
                const dateLabel = isToday
                  ? "Today"
                  : dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

                return (
                  <div key={evt.id} style={{
                    padding: "10px 0",
                    borderBottom: "0.5px solid rgba(15,15,14,0.07)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-eyebrow)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        opacity: isToday ? 0.8 : 0.4,
                        color: isToday ? "var(--amber)" : "var(--ink)",
                      }}>
                        {dateLabel}{evt.event_time ? ` · ${formatTime(evt.event_time)}` : ""}
                      </span>
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 8,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        padding: "2px 7px",
                        border: `0.5px solid ${TYPE_COLORS[evt.type] ?? "var(--ink)"}40`,
                        color: TYPE_COLORS[evt.type] ?? "var(--ink)",
                      }}>
                        {TYPE_LABELS[evt.type] ?? evt.type}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-body)",
                      opacity: 0.75,
                      letterSpacing: "-0.01em",
                    }}>
                      {evt.title}
                    </div>
                    {evt.project_title && (
                      <div style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-eyebrow)",
                        opacity: 0.4,
                        marginTop: 2,
                      }}>
                        {evt.project_title}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              opacity: 0.4,
              paddingTop: 8,
            }}>
              No upcoming events.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
