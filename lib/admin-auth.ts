import { NextResponse } from "next/server"
import { createServerComponentClient } from "@/lib/supabase-server"

/**
 * Verify that the current request is from an authenticated admin user.
 * Returns the user if authorized, or a NextResponse error if not.
 */
export async function requireAdmin(): Promise<
  | { user: { email: string }; error?: never }
  | { user?: never; error: NextResponse }
> {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user?.email) {
      return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    }

    if (user.email !== process.env.ADMIN_EMAIL) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }

    return { user: { email: user.email } }
  } catch {
    return { error: NextResponse.json({ error: "Auth check failed" }, { status: 500 }) }
  }
}
