import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get("code")
  const next  = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const redirectTo = NextResponse.redirect(new URL(next, req.url))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              redirectTo.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("[auth/callback] Code exchange failed:", error.message)
      const loginUrl = new URL("/login", req.url)
      loginUrl.searchParams.set("error", "code_exchange_failed")
      return NextResponse.redirect(loginUrl)
    }
    return redirectTo
  }

  console.error("[auth/callback] No code parameter in URL")
  const loginUrl = new URL("/login", req.url)
  loginUrl.searchParams.set("error", "no_code")
  return NextResponse.redirect(loginUrl)
}
