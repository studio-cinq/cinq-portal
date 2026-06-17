"use client"

import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Stamps first/last view on the brand kit and fires the admin notification.
 * Skips when the viewer is the logged-in admin.
 */
export default function TrackBrandKitView({
  projectId, alreadyViewed,
}: {
  projectId: string
  alreadyViewed: boolean
}) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true

    async function track() {
      const { data: { session } } = await supabase.auth.getSession()
      const isAdmin = session?.user?.email === "kacie@studiocinq.com"
      if (isAdmin) return

      const now = new Date().toISOString()
      await supabase.from("brand_kits").update({
        ...(alreadyViewed ? {} : { viewed_at: now }),
        last_viewed_at: now,
      } as any).eq("project_id", projectId)

      fetch("/api/notify/brand-kit-viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, isReturnView: alreadyViewed }),
      }).catch(() => {})
    }
    track()
  }, [projectId, alreadyViewed])

  return null
}
