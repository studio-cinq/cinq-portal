import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PAGE_PREFIXES = [
  "/auth/callback",
  "/proposals/",
  "/invoice/",
  "/review/",
  "/update-password",
  "/library/share/",
] as const

const PUBLIC_API_ROUTES = new Set([
  "/api/ach-details",
  "/api/invoice-checkout",
  "/api/notify/proposal-viewed",
  "/api/proposal-accept",
  "/api/proposal-checkout",
  "/api/review/approve",
  "/api/review/delete-annotation",
  "/api/review/save-annotation",
  "/api/review/submit-round",
  "/api/review/track-view",
  "/api/track-invoice-view",
  "/api/webhook",
])

const PUBLIC_API_PREFIXES = ["/api/pdf/", "/api/cron/"] as const

const AUTHENTICATED_API_ROUTES = new Set([
  "/api/checkout",
  "/api/notify/client-message",
  "/api/track-activity",
])

const ADMIN_API_ROUTES = new Set([
  "/api/review/create-session",
  "/api/review/delete-session",
  "/api/review/next-round",
  "/api/review/resolve-annotation",
])

function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some(prefix => pathname.startsWith(prefix))
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

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
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = req.nextUrl

  if (pathname === "/login" || matchesPrefix(pathname, PUBLIC_PAGE_PREFIXES)) {
    if (user && pathname === "/login") {
      const isAdmin = user.email === process.env.ADMIN_EMAIL
      return NextResponse.redirect(new URL(isAdmin ? "/admin/studio" : "/dashboard", req.url))
    }
    return res
  }

  if (PUBLIC_API_ROUTES.has(pathname) || matchesPrefix(pathname, PUBLIC_API_PREFIXES)) {
    return res
  }

  if (pathname.startsWith("/api/admin/") || ADMIN_API_ROUTES.has(pathname)) {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.email !== process.env.ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return res
  }

  if (AUTHENTICATED_API_ROUTES.has(pathname)) {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return res
  }

  if (pathname.startsWith("/api/")) {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return res
  }

  // Not logged in — redirect to login
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Admin routes — only Kacie
  if (pathname.startsWith("/admin")) {
    if (user.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts).*)"],
}
