import "server-only";
import { getAccessToken, refreshAccessToken } from "@/lib/auth";
import type { ApiResponse, ApiError } from "@/lib/api-client";

import { getErpApiUrl } from "@/lib/env-config";

const ERP_API_URL = getErpApiUrl();

// For Server Components / Server Actions calling erp directly -- no need to
// hop through /api/backend/* (that route exists for the browser, which
// can't reach erp directly without CORS; server-side code has no such
// restriction). Same response-envelope handling as lib/api-client.ts.
export async function serverApiGet<T>(path: string): Promise<T | null> {
  let token = await getAccessToken();
  if (!token) {
    const refreshed = await refreshAccessToken();
    if (!refreshed.ok) return null;
    token = refreshed.accessToken;
  }

  let response = await fetch(`${ERP_API_URL}/api/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed.ok) {
      token = refreshed.accessToken;
      response = await fetch(`${ERP_API_URL}/api/v1/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    }
  }

  try {
    const body = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !body.success) {
      console.error(
        `serverApiGet(${path}) failed: ${(body as ApiError).error?.message}`
      );
      return null;
    }
    return body.data;
  } catch (err) {
    console.error(`serverApiGet(${path}) response parsing failed:`, err);
    return null;
  }
}
