import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getAccessToken, refreshAccessToken, decodeJwtPayload, type ErpJwtClaims } from "@/lib/auth";

// Data Access Layer, per Next.js's own recommended auth pattern (see
// node_modules/next/dist/docs/01-app/02-guides/authentication.md). This is
// the one real authorization check point on the server side -- proxy.ts is
// optimistic-only (cookie presence, no validation), and this is where every
// Server Component / Route Handler that needs the current user should read
// from. cache() memoizes this per request so multiple components calling
// verifySession() in the same render pass don't redundantly decode the JWT.
export const verifySession = cache(async (): Promise<ErpJwtClaims> => {
  let token = await getAccessToken();
  if (!token) {
    const refreshed = await refreshAccessToken();
    if (!refreshed.ok) redirect("/login");
    token = refreshed.accessToken;
  }

  let claims = decodeJwtPayload<ErpJwtClaims>(token);
  if (!claims || claims.exp * 1000 < Date.now()) {
    const refreshed = await refreshAccessToken();
    if (!refreshed.ok) redirect("/login");
    token = refreshed.accessToken;
    claims = decodeJwtPayload<ErpJwtClaims>(token);
    if (!claims || claims.exp * 1000 < Date.now()) redirect("/login");
  }

  return claims;
});

// Non-redirecting variant for places that need to render differently when
// unauthenticated (e.g. proxy-adjacent checks) rather than force a redirect.
export const getSessionOrNull = cache(
  async (): Promise<ErpJwtClaims | null> => {
    let token = await getAccessToken();
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed.ok) return null;
      token = refreshed.accessToken;
    }
    let claims = decodeJwtPayload<ErpJwtClaims>(token);
    if (!claims || claims.exp * 1000 < Date.now()) {
      const refreshed = await refreshAccessToken();
      if (!refreshed.ok) return null;
      token = refreshed.accessToken;
      claims = decodeJwtPayload<ErpJwtClaims>(token);
      if (!claims || claims.exp * 1000 < Date.now()) return null;
    }
    return claims;
  }
);
