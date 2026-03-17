"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import CinqLogo from "@/components/CinqLogo"

type Step = "email" | "code" | "done"

export default function LoginPage() {
  const [step, setStep]       = useState<Step>("email")
  const [email, setEmail]     = useState("")
  const [code, setCode]       = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const authError = searchParams.get("error")
    if (authError === "code_exchange_failed") {
      setError("Magic link sign-in failed. Please try entering the 6-digit code instead.")
    } else if (authError === "no_code") {
      setError("Invalid magic link. Please request a new code.")
    }
  }, [searchParams])

  // Step 1 — send OTP to email
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "https://cinq-portal.vercel.app/auth/callback",
      },
    })

    setLoading(false)

    if (error) {
      setError("We don't have an account for that email. Please check with your Studio Cinq contact.")
      return
    }

    setStep("code")
  }

  // Step 2 — verify OTP code
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    })

    setLoading(false)

    if (error) {
      setError("That code didn't match. Please try again or request a new one.")
      return
    }

    // Redirect handled by middleware
    window.location.href = "/dashboard"
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #EDE8E0 0%, #DDD4C6 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Jost', sans-serif",
      padding: "24px",
    }}>

      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: 320,
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 48, opacity: 0.88 }}>
          <CinqLogo width={32} />
        </div>

        {/* Label */}
        <div style={{
          fontSize: 8,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#0F0F0E",
          opacity: 0.35,
          marginBottom: 28,
        }}>
          Client portal
        </div>

        {/* Hairline */}
        <div style={{ width: "100%", height: "0.5px", background: "rgba(15,15,14,0.12)" }} />

        {/* Step: Email */}
        {step === "email" && (
          <form onSubmit={handleSendCode} style={{ width: "100%" }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={inputStyle}
            />
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? "Sending…" : "Send access code"}
            </button>
          </form>
        )}

        {/* Step: OTP code */}
        {step === "code" && (
          <form onSubmit={handleVerifyCode} style={{ width: "100%" }}>
            <div style={{
              fontSize: 10,
              color: "#0F0F0E",
              opacity: 0.45,
              padding: "14px 16px",
              letterSpacing: "0.02em",
              lineHeight: 1.6,
            }}>
              A 6-digit code was sent to {email}.
            </div>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              style={{ ...inputStyle, letterSpacing: "0.3em", textAlign: "center", fontSize: 18 }}
            />
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? "Verifying…" : "Enter portal"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setError(null) }}
              style={ghostBtnStyle}
            >
              Use a different email
            </button>
          </form>
        )}

        {/* Hairline */}
        <div style={{ width: "100%", height: "0.5px", background: "rgba(15,15,14,0.12)" }} />

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 16,
            fontSize: 10,
            color: "#0F0F0E",
            opacity: 0.5,
            textAlign: "center",
            lineHeight: 1.6,
            letterSpacing: "0.02em",
          }}>
            {error}
          </div>
        )}

        {/* Note */}
        {!error && (
          <p style={{
            marginTop: 20,
            fontSize: 9,
            color: "#0F0F0E",
            opacity: 0.25,
            textAlign: "center",
            lineHeight: 1.7,
            letterSpacing: "0.04em",
          }}>
            {step === "email"
              ? "A one-time code will be sent to your email.\nNo password required."
              : "Check your inbox and spam folder."
            }
          </p>
        )}

      </div>

      {/* Footer */}
      <div style={{
        position: "fixed",
        bottom: 28,
        fontSize: 9,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#0F0F0E",
        opacity: 0.18,
      }}>
        Studio Cinq &nbsp;&middot;&nbsp; Private client access
      </div>

    </main>
  )
}

// -- Styles --

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.45)",
  border: "0.5px solid rgba(15,15,14,0.18)",
  borderRadius: 0,
  padding: "13px 16px",
  fontFamily: "'Jost', sans-serif",
  fontWeight: 300,
  fontSize: 13,
  color: "#0F0F0E",
  outline: "none",
  letterSpacing: "0.02em",
  boxSizing: "border-box",
}

const btnStyle: React.CSSProperties = {
  width: "100%",
  background: "#0F0F0E",
  border: "none",
  padding: "13px 16px",
  fontFamily: "'Jost', sans-serif",
  fontWeight: 300,
  fontSize: 9,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#EDE8E0",
  cursor: "pointer",
  boxSizing: "border-box",
}

const ghostBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "0.5px solid rgba(15,15,14,0.15)",
  padding: "11px 16px",
  fontFamily: "'Jost', sans-serif",
  fontWeight: 300,
  fontSize: 9,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#0F0F0E",
  opacity: 0.45,
  cursor: "pointer",
  boxSizing: "border-box",
  marginTop: 8,
}
