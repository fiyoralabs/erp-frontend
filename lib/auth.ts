import "server-only";
import { cookies } from "next/headers";

// erp issues its own signed JWT (HS512, 1 hour expiry per the production
// readiness audit) plus a separate UUID refresh token (7 day expiry,
// rotated on every use). We store both raw in httpOnly cookies rather than
// re-wrapping them in a second, self-issued session token: erp's own
// JwtFilter already re-validates user/company/permission state on every
// request server-side, so there is nothing meaningful gained by adding a
// second layer of encryption in front of it, and doing so would mean two
// independent expiries to keep in sync instead of one.

const ACCESS_TOKEN_COOKIE = "fiyora_erp_at";
const REFRESH_TOKEN_COOKIE = "fiyora_erp_rt";

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds, from erp's login/refresh response
}

export async function setSessionCookies(tokens: SessionTokens): Promise<void> {
  try {
    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === "production";

    cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      // Keep the expired JWT available until the refresh token expires. The
      // route proxy can then detect expiry and rotate the 7-day refresh token
      // before Server Components run. Expiry is still enforced by ERP.
      maxAge: 60 * 60 * 24 * 7,
    });

    // Refresh token cookie outlives the access token (erp: 7 days) so the
    // proxy route can silently mint a new access token after the first one
    // expires without forcing a re-login.
    cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } catch {
    // Ignore cookie store mutation errors if called during Server Component render pass
  }
}

export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
}

export async function clearSessionCookies(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ACCESS_TOKEN_COOKIE);
    cookieStore.delete(REFRESH_TOKEN_COOKIE);
  } catch {
    // Ignore cookie store mutation errors if called during Server Component render pass
  }
}

import { getErpApiUrl } from "@/lib/env-config";

const ERP_API_URL = getErpApiUrl();

// Shared by both /api/auth/refresh (explicit client-triggered refresh) and
// the backend proxy's automatic one-retry-on-401 behavior, as a direct
// function call rather than an internal HTTP round trip. Curl-verified
// shape: POST /api/v1/auth/refresh-token {"refreshToken"} -> same envelope
// as /login, plus a rotated (never-reusable) refreshToken.
export async function refreshAccessToken(): Promise<
  { ok: true; accessToken: string } | { ok: false }
> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return { ok: false };

  try {
    const erpResponse = await fetch(`${ERP_API_URL}/api/v1/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });

    if (!erpResponse.ok) {
      await clearSessionCookies();
      return { ok: false };
    }

    const erpData = await erpResponse.json();
    if (!erpData.success) {
      await clearSessionCookies();
      return { ok: false };
    }

    await setSessionCookies({
      accessToken: erpData.data.accessToken,
      refreshToken: erpData.data.refreshToken,
      expiresIn: erpData.data.expiresIn,
    });

    return { ok: true, accessToken: erpData.data.accessToken };
  } catch {
    await clearSessionCookies();
    return { ok: false };
  }
}

// Decodes the (already-verified-by-erp) JWT payload without checking the
// signature -- this is only ever used to read non-sensitive claims
// (userId/companyId/roles) for UI purposes. Every actual data request still
// goes through erp, which independently re-validates the token and the
// user/company's current active state on every call. Never trust this
// decoded payload for an authorization decision in the frontend itself.
export function decodeJwtPayload<T = Record<string, unknown>>(
  token: string
): T | null {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const json = Buffer.from(payloadB64, "base64url").toString("utf-8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export interface ErpJwtClaims {
  sub: string; // email
  userId: number;
  companyId: number;
  roles: string[];
  iat: number;
  exp: number;
}
