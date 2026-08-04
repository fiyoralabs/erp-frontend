import { NextRequest, NextResponse } from "next/server";

// Next.js 16 renamed "Middleware" to "Proxy" (functionally identical) --
// see node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
//
// This is an OPTIMISTIC check only (cookie presence, no validation against
// erp) per Next's own recommended pattern: proxy runs on every navigation
// including prefetches, so it must stay cheap. The real enforcement is
// lib/dal.ts's verifySession() (checked in every (dashboard) layout/page)
// plus erp's own JwtFilter re-validating the token server-side on every
// proxied backend call. A user who clears/forges this cookie gains no
// access to anything -- they just skip straight to a 401 from erp instead
// of being redirected client-side first.
const PUBLIC_ROUTES = ["/login", "/forgot-password"];
const ACCESS_TOKEN_COOKIE = "fiyora_erp_at";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(ACCESS_TOKEN_COOKIE);
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (!hasSession && !isPublicRoute && pathname !== "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && isPublicRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
