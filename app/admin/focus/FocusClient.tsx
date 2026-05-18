"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

type Todo = {
  id: string
  title: string
  notes?: string | null
  done: boolean
  due_date?: string | null
  completed_at?: string | null
  created_at: string
  clients?: { name: string } | null
  projects?: { title: string } | null
}

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

export default function FocusClient({ openTodos, doneTodos }: { openTodos: Todo[]; doneTodos: Todo[] }) {
  const router = useRouter()
  const [open, setOpen] = useState<Todo[]>(openTodos)
  const [done, setDone] = useState<Todo[]>(doneTodos)
  const [input, setInput] = useState("")
  const [showDone, setShowDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function addTodo(e: React.FormEvent) {
    e.preventDefault()
    const title = input.trim()
    if (!title || submitting) return
    setSubmitting(true)
    // Optimistic insert
    const tempId = `temp-${Date.now()}`
    const optimistic: Todo = {
      id: tempId,
      title,
      done: false,
      created_at: new Date().toISOString(),
    }
    setOpen(prev => [optimistic, ...prev])
    setInput("")

    const { data, error } = await supabase
      .from("todos")
      .insert({ title })
      .select("*, clients(name), projects(title)")
      .single()

    if (!error && data) {
      setOpen(prev => prev.map(t => (t.id === tempId ? (data as any) : t)))
    } else {
      // Rollback
      setOpen(prev => prev.filter(t => t.id !== tempId))
    }
    setSubmitting(false)
  }

  async function toggleTodo(todo: Todo) {
    const newDone = !todo.done
    const completedAt = newDone ? new Date().toISOString() : null

    if (newDone) {
      // Move from open to done (optimistic)
      setOpen(prev => prev.filter(t => t.id !== todo.id))
      setDone(prev => [{ ...todo, done: true, completed_at: completedAt! }, ...prev])
    } else {
      setDone(prev => prev.filter(t => t.id !== todo.id))
      setOpen(prev => [{ ...todo, done: false, completed_at: null }, ...prev])
    }

    await supabase
      .from("todos")
      .update({ done: newDone, completed_at: completedAt })
      .eq("id", todo.id)
  }

  async function deleteTodo(id: string) {
    setOpen(prev => prev.filter(t => t.id !== id))
    setDone(prev => prev.filter(t => t.id !== id))
    await supabase.from("todos").delete().eq("id", id)
  }

  return (
    <div>
      {/* Quick capture */}
      <form onSubmit={addTodo} style={{ marginBottom: 24 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a note to your list…"
          style={{
            ...sans,
            width: "100%",
            fontSize: "var(--text-body)",
            padding: "14px 18px",
            background: "rgba(255,255,255,0.4)",
            border: "0.5px solid rgba(15,15,14,0.1)",
            color: "var(--ink)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </form>

      {/* My list */}
      <div style={sectionLabel}>
        My list {open.length > 0 && <span style={{ opacity: 0.7 }}>({open.length})</span>}
      </div>
      {open.length === 0 ? (
        <div style={{ ...sans, fontSize: "var(--text-body)", opacity: 0.4, padding: "12px 0 20px" }}>
          Nothing on your list. Capture something above.
        </div>
      ) : (
        <div style={{ borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
          {open.map(t => (
            <TodoRow key={t.id} todo={t} onToggle={() => toggleTodo(t)} onDelete={() => deleteTodo(t.id)} />
          ))}
        </div>
      )}

      {/* Done (collapsed) */}
      {done.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <button
            onClick={() => setShowDone(s => !s)}
            style={{
              ...mono,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.45,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--ink)",
            }}
          >
            {showDone ? "▾" : "▸"} Done ({done.length})
          </button>
          {showDone && (
            <div style={{ marginTop: 12, borderTop: "0.5px solid rgba(15,15,14,0.08)" }}>
              {done.map(t => (
                <TodoRow key={t.id} todo={t} onToggle={() => toggleTodo(t)} onDelete={() => deleteTodo(t.id)} dimmed />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TodoRow({
  todo, onToggle, onDelete, dimmed = false,
}: {
  todo: Todo
  onToggle: () => void
  onDelete: () => void
  dimmed?: boolean
}) {
  const [hover, setHover] = useState(false)
  const context = todo.clients?.name || todo.projects?.title

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 0",
        borderBottom: "0.5px solid rgba(15,15,14,0.08)",
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      <button
        onClick={onToggle}
        aria-label={todo.done ? "Mark as not done" : "Mark as done"}
        style={{
          width: 16, height: 16, flexShrink: 0,
          background: todo.done ? "var(--ink)" : "transparent",
          border: `1px solid ${todo.done ? "var(--ink)" : "rgba(15,15,14,0.35)"}`,
          borderRadius: 3,
          cursor: "pointer", padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        {todo.done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          ...sans,
          fontSize: "var(--text-body)",
          opacity: 0.88,
          textDecoration: todo.done ? "line-through" : "none",
          textDecorationColor: "rgba(15,15,14,0.35)",
        }}>
          {todo.title}
        </div>
        {context && (
          <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.45, marginTop: 2 }}>
            {context}
          </div>
        )}
      </div>
      {hover && (
        <button
          onClick={onDelete}
          aria-label="Delete"
          style={{
            ...mono, fontSize: 10, letterSpacing: "0.1em",
            background: "none", border: "none", padding: "4px 8px",
            opacity: 0.4, cursor: "pointer", color: "var(--ink)",
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
