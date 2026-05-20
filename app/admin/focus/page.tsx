import { createServerComponentClient } from "@/lib/supabase-server"
import PortalNav from "@/components/portal/Nav"
import FocusClient from "./FocusClient"

/* ─── Shared styles ─── */
const mono = { fontFamily: "var(--font-mono)" } as const
const sans = { fontFamily: "var(--font-sans)" } as const

const sectionLabel: React.CSSProperties = {
  ...mono,
  fontSize: "var(--text-eyebrow)",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  opacity: 0.45,
  marginBottom: 18,
}

/* ─── Helpers ─── */
function daysSince(d: string | Date | null): number {
  if (!d) return Infinity
  const date = typeof d === "string" ? new Date(d) : d
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default async function FocusPage() {
  const supabase = await createServerComponentClient()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const todayStr = now.toISOString().slice(0, 10)
  const inSevenDaysStr = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)

  /* ─── Data queries ─── */
  const [
    invoicesOverdue,
    foundationsPublished,
    proposalsSent,
    unreadMessages,
    activeProjects,
    invoicesUpcoming,
    eventsUpcoming,
    todos,
  ] = await Promise.all([
    supabase.from("invoices")
      .select("id, invoice_number, amount, due_date, clients(name)")
      .eq("status", "overdue")
      .then(r => r.data ?? []),
    supabase.from("brand_foundations")
      .select("id, title, updated_at, clients(name)")
      .eq("status", "published")
      .then(r => r.data ?? []),
    supabase.from("proposals")
      .select("id, title, last_viewed_at, viewed_at, clients(name)")
      .eq("status", "sent")
      .then(r => r.data ?? []),
    supabase.from("messages")
      .select("id, body, created_at, projects(id, title, clients(id, name))")
      .eq("from_client", true).eq("read", false)
      .order("created_at", { ascending: false })
      .then(r => r.data ?? []),
    supabase.from("projects")
      .select("id, title, updated_at, created_at, focus_state, clients(id, name)")
      .eq("status", "active")
      .then(r => r.data ?? []),
    supabase.from("invoices")
      .select("id, invoice_number, amount, due_date, clients(name)")
      .in("status", ["sent"])
      .gte("due_date", todayStr)
      .lte("due_date", inSevenDaysStr)
      .then(r => r.data ?? []),
    supabase.from("events")
      .select("id, title, event_date, event_time, type, clients(name)")
      .gte("event_date", todayStr)
      .lte("event_date", inSevenDaysStr)
      .order("event_date")
      .then(r => r.data ?? []),
    supabase.from("todos")
      .select("*, clients(name), projects(title)")
      .or(`done.eq.false,and(done.eq.true,completed_at.gte.${sevenDaysAgo})`)
      .order("created_at", { ascending: false })
      .then(r => r.data ?? []),
  ])

  /* ─── Build "Needs your attention" list ─── */
  type Attention = {
    id: string
    icon: "amber" | "sage" | "muted"
    label: string
    detail: string
    href?: string
  }
  const attention: Attention[] = []

  // 1. Overdue invoices
  for (const inv of invoicesOverdue as any[]) {
    const age = inv.due_date ? daysSince(inv.due_date) : 0
    attention.push({
      id: `inv-${inv.id}`,
      icon: "amber",
      label: `Overdue invoice — ${inv.clients?.name ?? "—"}`,
      detail: `#${inv.invoice_number} · $${(inv.amount / 100).toLocaleString()} · ${age}d past due`,
      href: `/admin/invoices/${inv.id}/edit`,
    })
  }

  // 2. Foundations published > 5 days ago, no approval
  for (const f of foundationsPublished as any[]) {
    const age = daysSince(f.updated_at)
    if (age > 5) {
      attention.push({
        id: `found-${f.id}`,
        icon: "amber",
        label: `Foundation awaiting approval — ${f.clients?.name ?? "—"}`,
        detail: `${f.title || "Brand Foundations"} · ${age}d since sent`,
        href: `/admin/foundations/${f.id}/edit`,
      })
    }
  }

  // 3. Proposals viewed but no response > 3 days
  for (const p of proposalsSent as any[]) {
    const viewedRef = p.last_viewed_at || p.viewed_at
    if (!viewedRef) continue
    const age = daysSince(viewedRef)
    if (age > 3) {
      attention.push({
        id: `prop-${p.id}`,
        icon: "amber",
        label: `Proposal viewed, no response — ${p.clients?.name ?? "—"}`,
        detail: `${p.title} · last seen ${age}d ago`,
        href: `/admin/proposals`,
      })
    }
  }

  // 4. Unread client messages
  for (const m of unreadMessages as any[]) {
    const proj = m.projects as any
    attention.push({
      id: `msg-${m.id}`,
      icon: "sage",
      label: `New message — ${proj?.clients?.name ?? "—"}`,
      detail: (m.body ?? "").slice(0, 80),
      href: `/admin/clients/${proj?.clients?.id ?? ""}`,
    })
  }

  // (Quiet project items removed — they were noise pretending to be signal.
  // Activity tracking still happens in the background; freshness will show up
  // organically once you start using the portal more.)

  /* ─── This week ─── */
  type WeekItem = { id: string; label: string; detail: string; when: string; sortKey: number }
  const thisWeek: WeekItem[] = []

  for (const inv of invoicesUpcoming as any[]) {
    if (!inv.due_date) continue
    thisWeek.push({
      id: `winv-${inv.id}`,
      label: `Invoice due — ${inv.clients?.name ?? "—"}`,
      detail: `#${inv.invoice_number} · $${(inv.amount / 100).toLocaleString()}`,
      when: fmtDate(inv.due_date),
      sortKey: new Date(inv.due_date).getTime(),
    })
  }
  for (const ev of eventsUpcoming as any[]) {
    thisWeek.push({
      id: `cev-${ev.id}`,
      label: ev.title,
      detail: ev.clients?.name ?? "",
      when: fmtDate(ev.event_date),
      sortKey: new Date(ev.event_date).getTime(),
    })
  }
  thisWeek.sort((a, b) => a.sortKey - b.sortKey)

  /* ─── In Focus Today + In the Queue (manually pinned) ─── */
  const projectRows = (activeProjects as any[]).map(p => ({
    id: p.id,
    title: p.title,
    client: p.clients?.name ?? "—",
    focus_state: p.focus_state as null | "focus_today" | "in_queue",
  }))
  const focusToday = projectRows.filter(p => p.focus_state === "focus_today")
  const inQueue = projectRows.filter(p => p.focus_state === "in_queue")

  /* ─── Todos: split into open + recently completed ─── */
  const todosArr = todos as any[]
  const openTodos = todosArr.filter(t => !t.done)
  const doneTodos = todosArr.filter(t => t.done)

  return (
    <>
      <PortalNav isAdmin />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px clamp(24px, 4vw, 56px) 96px" }}>

        {/* ─── Header ─── */}
        <header style={{ marginBottom: 48 }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.35, marginBottom: 10 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h1 style={{ ...sans, fontWeight: 400, fontSize: 38, letterSpacing: "-0.02em", margin: 0, opacity: 0.95, lineHeight: 1.1 }}>
            Focus
          </h1>
        </header>

        {/* ─── HERO: In Focus Today ─── */}
        <section style={{ marginBottom: 64 }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.45, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span>In Focus Today</span>
            <span style={{ flex: 1, height: 0.5, background: "rgba(15,15,14,0.12)" }} />
            {focusToday.length > 0 && <span style={{ opacity: 0.6 }}>{focusToday.length}</span>}
          </div>

          {focusToday.length === 0 ? (
            <div style={{
              padding: "48px 32px",
              background: "rgba(255,255,255,0.32)",
              border: "0.5px solid rgba(15,15,14,0.08)",
              textAlign: "center",
            }}>
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, opacity: 0.55, marginBottom: 6 }}>
                Nothing pinned for today.
              </div>
              <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.45 }}>
                Open a project and pin it to <em>In focus today</em> to bring it here.
              </div>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: focusToday.length === 1 ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}>
              {focusToday.map(p => (
                <a key={p.id} href={`/admin/projects/${p.id}`} style={{
                  display: "block",
                  padding: "26px 28px 30px",
                  background: "rgba(255,255,255,0.42)",
                  border: "0.5px solid rgba(15,15,14,0.1)",
                  borderLeft: "2px solid var(--sage)",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "background 0.18s, border-color 0.18s",
                }}
                className="focus-hero-card">
                  <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.5, marginBottom: 12 }}>
                    {p.client}
                  </div>
                  <div style={{ ...sans, fontSize: 22, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.25, opacity: 0.92 }}>
                    {p.title}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* ─── 2×2 supporting grid ─── */}
        <div className="focus-grid" style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "48px 56px",
        }}>

          {/* Needs Your Attention */}
          <section>
            <div style={sectionLabel}>
              {attention.length > 0 ? `Needs your attention · ${attention.length}` : "Needs your attention"}
            </div>
            {attention.length === 0 ? (
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 15, opacity: 0.5, padding: "16px 0" }}>
                All clear.
              </div>
            ) : (
              <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
                {attention.map(a => (
                  <a key={a.id} href={a.href ?? "#"} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "13px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                    textDecoration: "none", color: "inherit",
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 7,
                      background: a.icon === "amber" ? "var(--amber)" : a.icon === "sage" ? "var(--sage)" : "rgba(15,15,14,0.25)",
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.88, lineHeight: 1.4 }}>{a.label}</div>
                      <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.5, marginTop: 2 }}>{a.detail}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* My List */}
          <section>
            <FocusClient openTodos={openTodos} doneTodos={doneTodos} />
          </section>

          {/* In the Queue */}
          <section>
            <div style={sectionLabel}>
              In the Queue {inQueue.length > 0 && <span style={{ opacity: 0.7 }}>· {inQueue.length}</span>}
            </div>
            {inQueue.length === 0 ? (
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 15, opacity: 0.5, padding: "16px 0" }}>
                Nothing in the queue.
              </div>
            ) : (
              <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
                {inQueue.map(p => (
                  <a key={p.id} href={`/admin/projects/${p.id}`} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "13px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                    textDecoration: "none", color: "inherit",
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 7, background: "rgba(15,15,14,0.28)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.88, lineHeight: 1.4 }}>{p.title}</div>
                      <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.5, marginTop: 2 }}>{p.client}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* This Week */}
          <section>
            <div style={sectionLabel}>This week</div>
            {thisWeek.length === 0 ? (
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 15, opacity: 0.5, padding: "16px 0" }}>
                Quiet week ahead.
              </div>
            ) : (
              <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
                {thisWeek.map(item => (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "13px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                  }}>
                    <div style={{ ...mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.5, width: 56, flexShrink: 0, paddingTop: 3 }}>
                      {item.when}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.88, lineHeight: 1.4 }}>{item.label}</div>
                      {item.detail && <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.5, marginTop: 2 }}>{item.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Mobile collapse */}
        <style>{`
          @media (max-width: 760px) {
            .focus-grid {
              grid-template-columns: 1fr !important;
              gap: 40px !important;
            }
          }
          .focus-hero-card:hover {
            background: rgba(255,255,255,0.6) !important;
            border-color: rgba(15,15,14,0.18) !important;
          }
        `}</style>
      </main>
    </>
  )
}
