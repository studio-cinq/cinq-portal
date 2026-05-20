"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

type Note = {
  id: string
  project_id: string
  body: string
  source?: string | null
  created_at: string
}

const mono = { fontFamily: "var(--font-mono)" } as const
const sans = { fontFamily: "var(--font-sans)" } as const
const serif = { fontFamily: "var(--font-serif)" } as const

const sectionLabel: React.CSSProperties = {
  ...mono,
  fontSize: "var(--text-eyebrow)",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  opacity: 0.5,
  marginBottom: 16,
}

function fmtDate(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined })
}

export default function ClientContext({ projectId, initialNotes }: { projectId: string; initialNotes: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [body, setBody] = useState("")
  const [source, setSource] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)

    const tempId = `temp-${Date.now()}`
    const optimistic: Note = {
      id: tempId,
      project_id: projectId,
      body: trimmed,
      source: source.trim() || null,
      created_at: new Date().toISOString(),
    }
    setNotes(prev => [optimistic, ...prev])
    setBody("")
    setSource("")

    const { data, error } = await supabase
      .from("project_notes")
      .insert({ project_id: projectId, body: trimmed, source: source.trim() || null })
      .select()
      .single()

    if (!error && data) {
      setNotes(prev => prev.map(n => (n.id === tempId ? (data as Note) : n)))
    } else {
      setNotes(prev => prev.filter(n => n.id !== tempId))
    }
    setSubmitting(false)
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return
    setNotes(prev => prev.filter(n => n.id !== id))
    await supabase.from("project_notes").delete().eq("id", id)
  }

  return (
    <section>
      <div style={sectionLabel}>
        Client context {notes.length > 0 && <span style={{ opacity: 0.6 }}>· {notes.length}</span>}
      </div>

      {/* Quick capture */}
      <form onSubmit={addNote} style={{
        marginBottom: notes.length > 0 ? 18 : 0,
        background: "rgba(255,255,255,0.4)",
        border: "0.5px solid rgba(15,15,14,0.1)",
        padding: "12px 14px",
      }}>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a note from the client..."
          rows={2}
          style={{
            ...sans, width: "100%", boxSizing: "border-box",
            fontSize: "var(--text-sm)", lineHeight: 1.6,
            background: "transparent", border: "none",
            color: "var(--ink)", outline: "none", resize: "vertical",
            padding: 0,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, paddingTop: 8, borderTop: "0.5px solid rgba(15,15,14,0.06)" }}>
          <input
            type="text"
            value={source}
            onChange={e => setSource(e.target.value)}
            placeholder="From (optional)"
            style={{
              ...mono, flex: 1, minWidth: 0,
              fontSize: 10, letterSpacing: "0.08em",
              background: "transparent", border: "none",
              color: "var(--ink)", opacity: 0.7, outline: "none",
              padding: 0,
            }}
          />
          <button
            type="submit"
            disabled={!body.trim() || submitting}
            style={{
              ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              background: "transparent",
              border: "0.5px solid rgba(15,15,14,0.2)",
              padding: "5px 10px",
              cursor: !body.trim() || submitting ? "default" : "pointer",
              opacity: !body.trim() || submitting ? 0.3 : 0.7,
              color: "var(--ink)",
            }}
          >
            Add
          </button>
        </div>
      </form>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div style={{ ...serif, fontStyle: "italic", fontSize: 14, opacity: 0.5, padding: "14px 0 4px" }}>
          No client context yet.
        </div>
      ) : (
        <div>
          {notes.map(note => (
            <div key={note.id} style={{
              padding: "12px 0",
              borderBottom: "0.5px solid rgba(15,15,14,0.08)",
            }}
            className="client-context-note">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                <div style={{ ...mono, fontSize: 10, letterSpacing: "0.08em", opacity: 0.5, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span>{fmtDate(note.created_at)}</span>
                  {note.source && (
                    <>
                      <span style={{ opacity: 0.5 }}>·</span>
                      <span style={{ ...mono, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.9 }}>
                        {note.source}
                      </span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => deleteNote(note.id)}
                  aria-label="Delete note"
                  className="client-context-delete"
                  style={{
                    ...mono, fontSize: 10,
                    background: "none", border: "none", padding: "0 4px",
                    color: "var(--ink)", opacity: 0,
                    cursor: "pointer", transition: "opacity 0.15s",
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ ...sans, fontSize: "var(--text-sm)", lineHeight: 1.55, opacity: 0.85, whiteSpace: "pre-wrap" }}>
                {note.body}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .client-context-note:hover .client-context-delete { opacity: 0.45 !important; }
        .client-context-delete:hover { opacity: 0.9 !important; }
      `}</style>
    </section>
  )
}
