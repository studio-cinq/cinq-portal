"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"

function LoginPageInner() {
  const [email, setEmail]         = useState("")
  const [password, setPassword]   = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [mode, setMode]           = useState<"login" | "reset">("login")
  const searchParams = useSearchParams()

  useEffect(() => {
    const msg = searchParams.get("message")
    if (msg === "password_updated") setError(null)
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError("Incorrect email or password. Please try again."); return }
    window.location.href = email === "kacie@studiocinq.com" ? "/admin/studio" : "/dashboard"
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/update-password`,
    })
    setLoading(false)
    if (error) { setError("Something went wrong. Please try again."); return }
    setResetSent(true)
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

        <div style={{ fontFamily: "'Matter SemiMono', monospace", fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", color: "#0F0F0E", opacity: 0.4, marginBottom: 28 }}>
          {mode === "login" ? "Client portal" : "Reset password"}
        </div>

        <div style={{ width: "100%", height: "0.5px", background: "rgba(15,15,14,0.12)" }} />

        {mode === "login" && (
          <form onSubmit={handleLogin} style={{ width: "100%" }}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required style={inputStyle} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required style={inputStyle} />
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? "Signing in…" : "Enter portal"}
            </button>
            <button type="button" onClick={() => { setMode("reset"); setError(null) }} style={ghostBtnStyle}>
              Forgot password
            </button>
          </form>
        )}

        {mode === "reset" && !resetSent && (
          <form onSubmit={handleReset} style={{ width: "100%" }}>
            <div style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 13, color: "#0F0F0E", opacity: 0.5, padding: "14px 0", lineHeight: 1.6 }}>
              Enter your email and we'll send a link to reset your password.
            </div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required style={inputStyle} />
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <button type="button" onClick={() => { setMode("login"); setError(null) }} style={ghostBtnStyle}>
              Back to sign in
            </button>
          </form>
        )}

        {mode === "reset" && resetSent && (
          <div style={{ width: "100%", padding: "20px 0" }}>
            <div style={{ fontFamily: "'Söhne', 'Inter', system-ui, sans-serif", fontSize: 13, opacity: 0.65, lineHeight: 1.7, marginBottom: 20 }}>
              Check your inbox — a reset link is on its way to {email}.
            </div>
            <button type="button" onClick={() => { setMode("login"); setResetSent(false); setError(null) }} style={ghostBtnStyle}>
              Back to sign in
            </button>
          </div>
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
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

const ghostBtnStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "transparent",
  border: "0.5px solid rgba(15,15,14,0.15)",
  padding: "11px 16px", marginTop: 8,
  fontFamily: "'Matter SemiMono', monospace",
  fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
  color: "#0F0F0E", opacity: 0.45, cursor: "pointer",
}