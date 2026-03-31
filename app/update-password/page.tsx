"use client"

import { useState, useEffect } from "react"
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
    setTimeout(() => { window.location.href = "/dashboard" }, 2000)
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #F4F1EC 0%, #E8E0D4 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 320 }}>

        <div style={{ marginBottom: 48, opacity: 0.88 }}>
          <CinqLogo width={32} />
        </div>

        <div style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#0F0F0E", opacity: 0.4, marginBottom: 28 }}>
          {done ? "Password set" : "Set your password"}
        </div>

        <div style={{ width: "100%", height: "0.5px", background: "rgba(15,15,14,0.12)" }} />

        {done ? (
          <div style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 13, opacity: 0.65, lineHeight: 1.7, padding: "20px 0", textAlign: "center" }}>
            Password set — taking you to your portal…
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <div style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 13, color: "#0F0F0E", opacity: 0.5, padding: "14px 0", lineHeight: 1.6 }}>
              Choose a password for your Studio Cinq portal account.
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password"
              required
              style={inputStyle}
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm password"
              required
              style={inputStyle}
            />
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? "Setting password…" : "Set password & enter portal"}
            </button>
          </form>
        )}

        <div style={{ width: "100%", height: "0.5px", background: "rgba(15,15,14,0.12)" }} />

        {error && (
          <div style={{ marginTop: 16, fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 11, color: "#0F0F0E", opacity: 0.5, textAlign: "center", lineHeight: 1.6 }}>
            {error}
          </div>
        )}

      </div>

      <div style={{ position: "fixed", bottom: 28, fontFamily: "'Matter SemiMono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0F0F0E", opacity: 0.18 }}>
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
  fontFamily: "'Söhne', 'Inter', system-ui, sans-serif",
  fontSize: 13, color: "#0F0F0E", outline: "none",
  letterSpacing: "0.01em", marginTop: 10,
}

const btnStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "#0F0F0E", border: "none",
  padding: "13px 16px", marginTop: 10,
  fontFamily: "'Matter SemiMono', monospace",
  fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
  color: "#F4F1EC", cursor: "pointer",
}