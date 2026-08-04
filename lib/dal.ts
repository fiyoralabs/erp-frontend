import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getAccessToken, decodeJwtPayload, type ErpJwtClaims } from "@/lib/auth";

// Data Access Layer, per Next.js's own recommended auth pattern (see
// node_modules/next/dist/docs/01-app/02-guides/authentication.md). This is
// the one real authorization check point on the server side -- proxy.ts is
// optimistic-only (cookie presence, no validation), and this is where every
// Server Component / Route Handler that needs the current user should read
// from. cache() memoizes this per request so multiple components calling
// verifySession() in the same render pass don't redundantly decode the JWT.
export const verifySession = cache(async (): Promise<ErpJwtClaims> => {
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }

  const claims = decodeJwtPayload<ErpJwtClaims>(token);
  if (!claims || claims.exp * 1000 < Date.now()) {
    redirect("/login");
  }

  return claims;
});

// Non-redirecting variant for places that need to render differently when
// unauthenticated (e.g. proxy-adjacent checks) rather than force a redirect.
export const getSessionOrNull = cache(
  async (): Promise<ErpJwtClaims | null> => {
    const token = await getAccessToken();
    if (!token) return null;
    const claims = decodeJwtPayload<ErpJwtClaims>(token);
    if (!claims || claims.exp * 1000 < Date.now()) return null;
    return claims;
  }
);
