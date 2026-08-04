import "server-only";
import { getAccessToken } from "@/lib/auth";
import type { ApiResponse, ApiError } from "@/lib/api-client";

const ERP_API_URL = process.env.ERP_API_URL ?? "http://localhost:8080";

// For Server Components / Server Actions calling erp directly -- no need to
// hop through /api/backend/* (that route exists for the browser, which
// can't reach erp directly without CORS; server-side code has no such
// restriction). Same response-envelope handling as lib/api-client.ts.
export async function serverApiGet<T>(path: string): Promise<T | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const response = await fetch(`${ERP_API_URL}/api/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success) {
    console.error(
      `serverApiGet(${path}) failed: ${(body as ApiError).error?.message}`
    );
    return null;
  }
  return body.data;
}
