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
      .select("id, title, updated_at, created_at, clients(id, name)")
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

  // 5. Active projects with no activity > 14 days — cap to the 3 quietest
  // so this section doesn't drown out the higher-signal items.
  // (All active projects still appear in "On my plate" with a freshness dot.)
  const quietProjects = (activeProjects as any[])
    .map(p => ({ ...p, _age: daysSince(p.updated_at) }))
    .filter(p => p._age > 14)
    .sort((a, b) => b._age - a._age)
    .slice(0, 3)
  for (const proj of quietProjects) {
    attention.push({
      id: `proj-${proj.id}`,
      icon: "muted",
      label: `Quiet project — ${proj.clients?.name ?? "—"}`,
      detail: `${proj.title} · ${proj._age}d since last activity`,
      href: `/admin/projects/${proj.id}/edit`,
    })
  }

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

  /* ─── On my plate (active projects, freshness sorted) ─── */
  const plate = (activeProjects as any[])
    .map(p => ({
      id: p.id,
      title: p.title,
      client: p.clients?.name ?? "—",
      age: daysSince(p.updated_at),
    }))
    .sort((a, b) => a.age - b.age)

  /* ─── Todos: split into open + recently completed ─── */
  const todosArr = todos as any[]
  const openTodos = todosArr.filter(t => !t.done)
  const doneTodos = todosArr.filter(t => t.done)

  return (
    <>
      <PortalNav isAdmin />

      <main style={{ maxWidth: 920, margin: "0 auto", padding: "32px clamp(24px, 4vw, 48px) 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.35, marginBottom: 8 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h1 style={{ ...sans, fontWeight: 400, fontSize: 32, letterSpacing: "-0.02em", margin: 0, opacity: 0.92 }}>
            Focus
          </h1>
        </div>

        {/* Quick capture + open todos (client component) */}
        <FocusClient openTodos={openTodos} doneTodos={doneTodos} />

        {/* Needs your attention */}
        <section style={{ marginTop: 56, marginBottom: 48 }}>
          <div style={sectionLabel}>
            {attention.length > 0 ? `Needs your attention (${attention.length})` : "Needs your attention"}
          </div>
          {attention.length === 0 ? (
            <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.4, padding: "20px 0" }}>
              All clear. Nothing urgent right now.
            </div>
          ) : (
            <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
              {attention.map(a => (
                <a key={a.id} href={a.href ?? "#"} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                  textDecoration: "none", color: "inherit",
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                    background: a.icon === "amber" ? "var(--amber)" : a.icon === "sage" ? "var(--sage)" : "rgba(15,15,14,0.25)",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.88 }}>{a.label}</div>
                    <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.5, marginTop: 2 }}>{a.detail}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* This week */}
        <section style={{ marginBottom: 48 }}>
          <div style={sectionLabel}>This week</div>
          {thisWeek.length === 0 ? (
            <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.4, padding: "20px 0" }}>
              Nothing on the calendar in the next 7 days.
            </div>
          ) : (
            <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
              {thisWeek.map(item => (
                <div key={item.id} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                }}>
                  <div style={{ ...mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.5, width: 72, flexShrink: 0 }}>
                    {item.when}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.88 }}>{item.label}</div>
                    {item.detail && <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.5, marginTop: 2 }}>{item.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* On my plate */}
        <section style={{ marginBottom: 16 }}>
          <div style={sectionLabel}>
            On my plate {plate.length > 0 && <span style={{ opacity: 0.7 }}>({plate.length} active)</span>}
          </div>
          {plate.length === 0 ? (
            <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.4, padding: "20px 0" }}>
              No active projects.
            </div>
          ) : (
            <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
              {plate.map(p => {
                const fresh = p.age <= 7 ? "var(--sage)" : p.age <= 14 ? "var(--amber)" : "rgba(15,15,14,0.25)"
                return (
                  <a key={p.id} href={`/admin/projects/${p.id}/edit`} style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "14px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                    textDecoration: "none", color: "inherit",
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: fresh }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.88 }}>{p.title}</div>
                      <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.5, marginTop: 2 }}>
                        {p.client} · {p.age === 0 ? "active today" : p.age === 1 ? "active yesterday" : `${p.age}d since last activity`}
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
