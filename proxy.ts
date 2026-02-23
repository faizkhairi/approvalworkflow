import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// Protect all routes under /(app) — unauthenticated users are redirected to /login.
// Public routes (login, register, NextAuth API) are explicitly excluded.
// Note: In Next.js 16, this file is named proxy.ts (replaced deprecated middleware.ts).
export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth")

  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Match everything except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
}
