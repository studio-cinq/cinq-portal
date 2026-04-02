"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"

export default function UpdatePasswordPage() {
  const [password, setPassword]   = useState("")
  const [confirm, setConfirm]     = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [done, setDone]           = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError("Passwords don't match."); return }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) {
      setError("Something went wrong. Please try again or request a new link.")
      return
    }

    setDone(true)
    setTimeout(() => { window.location.href = "/login?message=password_updated" }, 2000)
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "var(--bg-grad)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 320 }}>

        <div style={{ marginBottom: 48, opacity: 0.88 }}>
          <CinqLogo width={32} />
        </div>

        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.4, marginBottom: 28 }}>
          {done ? "Password set" : "Set your password"}
        </div>

        <div style={{ width: "100%", height: "0.5px", background: "rgba(15,15,14,0.12)" }} />

        {done ? (
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, opacity: 0.65, lineHeight: 1.7, padding: "20px 0", textAlign: "center" }}>
            Password set. Taking you back to sign in…
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)", opacity: 0.5, padding: "14px 0", lineHeight: 1.6 }}>
              Choose a password for your Studio Cinq portal account.
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password"
              aria-label="New password"
              required
              style={inputStyle}
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm password"
              aria-label="Confirm password"
              required
              style={inputStyle}
            />
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? "Setting password…" : "Save password"}
            </button>
          </form>
        )}

        <div style={{ width: "100%", height: "0.5px", background: "rgba(15,15,14,0.12)" }} />

        {error && (
          <div role="alert" aria-live="polite" style={{ marginTop: 16, fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink)", opacity: 0.5, textAlign: "center", lineHeight: 1.6 }}>
            {error}
          </div>
        )}

      </div>

      <div style={{ marginTop: "auto", paddingTop: 48, fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.18 }}>
        Studio Cinq &nbsp;&middot;&nbsp; Private client access
      </div>
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.45)",
  border: "0.5px solid rgba(15,15,14,0.18)",
  padding: "13px 16px",
  fontFamily: "var(--font-sans)",
  fontSize: 13, color: "var(--ink)", outline: "none",
  letterSpacing: "0.01em", marginTop: 10,
}

const btnStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "var(--ink)", border: "none",
  padding: "13px 16px", marginTop: 10,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase",
  color: "var(--cream)", cursor: "pointer",
}
