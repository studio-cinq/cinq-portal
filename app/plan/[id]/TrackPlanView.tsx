"use client"

import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Fires the view tracking + admin notification for a plan view.
 * Skips when the viewer is the logged-in admin.
 */
export default function TrackPlanView({ planId, alreadyViewed }: { planId: string; alreadyViewed: boolean }) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true

    async function track() {
      const { data: { session } } = await supabase.auth.getSession()
      const isAdmin = session?.user?.email === "kacie@studiocinq.com"
      if (isAdmin) return

      const now = new Date().toISOString()
      await supabase.from("plans").update({
        ...(alreadyViewed ? {} : { viewed_at: now, status: "viewed" }),
        last_viewed_at: now,
      } as any).eq("id", planId)

      // Fire-and-forget admin notification
      fetch("/api/notify/plan-viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, isReturnView: alreadyViewed }),
      }).catch(() => {})
    }
    track()
  }, [planId, alreadyViewed])

  return null
}
