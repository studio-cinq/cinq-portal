"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function ActivityTracker() {
  useEffect(() => {
    async function track() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return
      fetch("/api/track-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      }).catch(() => {})
    }
    track()
  }, [])

  return null
}
