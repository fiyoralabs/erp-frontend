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
import { getErpApiUrl } from "@/lib/env-config";

const PUBLIC_ROUTES = ["/login", "/forgot-password"];
const ACCESS_TOKEN_COOKIE = "fiyora_erp_at";
const REFRESH_TOKEN_COOKIE = "fiyora_erp_rt";
const ERP_API_URL = getErpApiUrl();

function tokenIsUsable(token: string | undefined) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now() + 30_000;
  } catch { return false; }
}

async function refreshForNavigation(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${ERP_API_URL}/api/v1/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = await response.json();
    if (!body.success) return null;
    return body.data as { accessToken: string; refreshToken: string };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  let hasSession = tokenIsUsable(accessToken);
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (!hasSession && request.cookies.has(REFRESH_TOKEN_COOKIE)) {
    const tokens = await refreshForNavigation(request);
    if (tokens) {
      hasSession = true;
      const requestHeaders = new Headers(request.headers);
      const cookie = request.cookies.getAll().filter((item) => item.name !== ACCESS_TOKEN_COOKIE && item.name !== REFRESH_TOKEN_COOKIE).map((item) => `${item.name}=${item.value}`);
      cookie.push(`${ACCESS_TOKEN_COOKIE}=${tokens.accessToken}`, `${REFRESH_TOKEN_COOKIE}=${tokens.refreshToken}`);
      requestHeaders.set("cookie", cookie.join("; "));
      const next = isPublicRoute
        ? NextResponse.redirect(new URL("/dashboard", request.url))
        : NextResponse.next({ request: { headers: requestHeaders } });
      const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 7 };
      next.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, options);
      next.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, options);
      return next;
    }
  }

  if (!hasSession && !isPublicRoute && pathname !== "/") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isPublicRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf)$).*)",
  ],
};
