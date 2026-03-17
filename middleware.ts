import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

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

  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

// Public routes
if (pathname === "/login" || pathname.startsWith("/auth/callback")) {
  if (session && pathname === "/login") return NextResponse.redirect(new URL("/dashboard", req.url))
  return res
}

  // Not logged in — redirect to login
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Admin routes — only Kacie
  if (pathname.startsWith("/admin")) {
    const isAdmin = session.user.email === process.env.ADMIN_EMAIL
    if (!isAdmin) return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts).*)"],
}
