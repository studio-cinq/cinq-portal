"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import PortalNav from "@/components/portal/Nav"

const mono = { fontFamily: "var(--font-mono)" } as const
const sans = { fontFamily: "var(--font-sans)" } as const

const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "transparent", border: "none",
  borderBottom: "0.5px solid rgba(15,15,14,0.18)",
  padding: "10px 0",
  ...sans, fontSize: 14, color: "var(--ink)", outline: "none",
}

const labelStyle: React.CSSProperties = {
  ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
  opacity: 0.6, marginBottom: 6, display: "block",
}

export default function NewDirectionPlanPage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_id: "",
    title: "Creative Direction Plan",
    subtitle: "A working guide for visual, print, digital, and communications needs.",
  })

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => {
      setClients(data ?? [])
    })
  }, [])

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate() {
    setError(null)
    if (!form.client_id) return setError("Pick a client.")
    if (!form.title.trim()) return setError("Title is required.")
    setLoading(true)

    const { data, error: insertErr } = await supabase.from("plans").insert({
      client_id: form.client_id,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
    } as any).select().single()

    if (insertErr || !data) {
      setError(insertErr?.message ?? "Couldn't create plan")
      setLoading(false)
      return
    }

    router.push(`/admin/plans/${(data as any).id}/edit`)
  }

  return (
    <>
      <PortalNav isAdmin />
      <main className="form-page-pad" style={{ maxWidth: 640, margin: "0 auto", padding: "48px 48px 80px" }}>
        <Link href="/admin/plans" style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.4, textDecoration: "none", display: "inline-block", marginBottom: 28 }}>
          ← Direction Plans
        </Link>
        <div style={{ marginBottom: 40 }}>
          <div style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.4, marginBottom: 10 }}>
            Direction Plans / New
          </div>
          <h1 style={{ ...sans, fontWeight: 400, fontSize: 30, letterSpacing: "-0.02em", margin: 0, opacity: 0.92 }}>
            New direction plan
          </h1>
          <div style={{ ...sans, fontSize: 14, opacity: 0.55, marginTop: 10, lineHeight: 1.55, fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
            We&rsquo;ll set up the basics here. Sections, items, and the cover narrative live in the editor.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <label style={labelStyle}>Client *</label>
            <select value={form.client_id} onChange={e => set("client_id", e.target.value)} style={{ ...input, cursor: "pointer" }}>
              <option value="">—</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Title *</label>
            <input type="text" value={form.title} onChange={e => set("title", e.target.value)} style={input} placeholder="Graphics & Marketing" />
          </div>

          <div>
            <label style={labelStyle}>Subtitle <span style={{ opacity: 0.5 }}>(optional, italic line under the title)</span></label>
            <input type="text" value={form.subtitle} onChange={e => set("subtitle", e.target.value)} style={input} placeholder="A working guide for visual, print, digital, and communications needs." />
          </div>

          {error && <div style={{ ...mono, fontSize: 10, color: "var(--amber)", opacity: 0.9 }}>{error}</div>}

          <div style={{ display: "flex", gap: 14, paddingTop: 8 }}>
            <button onClick={handleCreate} disabled={loading} style={{
              ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.14em", textTransform: "uppercase",
              background: "var(--ink)", color: "var(--cream)",
              border: "none", padding: "14px 28px",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.4 : 1,
            }}>
              {loading ? "Creating…" : "Create & edit"}
            </button>
            <Link href="/admin/plans" style={{ ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5, textDecoration: "none", padding: "14px 0" }}>
              Cancel
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
