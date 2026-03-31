"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function MessageForm({ projectId }: { projectId: string }) {
  const [body, setBody]       = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)

  async function handleSend() {
    if (!body.trim()) return
    setSending(true)

    const { data: { user } } = await supabase.auth.getUser()
    const messageBody = body.trim()

    await supabase.from("messages").insert({
      project_id:  projectId,
      from_client: true,
      sender_name: user?.email ?? "Client",
      body:        messageBody,
      read:        false,
    })

    setSending(false)
    setSent(true)
    setBody("")
    setTimeout(() => setSent(false), 3000)

    // Notify admin (non-blocking)
    fetch("/api/notify/client-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        messageBody,
        senderEmail: user?.email ?? "",
      }),
    }).catch(() => {})
  }

  return (
    <div>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Ask a question or leave a note…"
        rows={3}
        style={{
          width: "100%", boxSizing: "border-box",
          background: "rgba(255,255,255,0.3)",
          border: "0.5px solid rgba(15,15,14,0.12)",
          padding: "10px 12px",
          fontFamily: "var(--font-sans)",
          fontSize: 11, fontWeight: 300,
          color: "var(--ink)", resize: "none", outline: "none",
          marginBottom: 8,
        }}
      />
      <button
        onClick={handleSend}
        disabled={sending || !body.trim()}
        style={{
          width: "100%", boxSizing: "border-box",
          background: "transparent",
          border: "0.5px solid rgba(15,15,14,0.15)",
          padding: 10,
          fontFamily: "var(--font-sans)",
          fontSize: 9, letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink)", opacity: sending ? 0.3 : 0.5,
          cursor: sending ? "default" : "pointer",
        }}
      >
        {sent ? "Sent" : sending ? "Sending…" : "Send message"}
      </button>
    </div>
  )
}
