import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, refreshAccessToken } from "@/lib/auth";

import { getErpApiUrl } from "@/lib/env-config";

const ERP_API_URL = getErpApiUrl();

// Master data caching is handled in-memory by React Query (e.g. useMasterList
// staleTime). Dynamic proxied API responses must never be cached by the browser's
// HTTP cache so that React Query invalidations immediately refetch fresh data.

// Generic authenticated forwarder: browser -> this route (same origin, no
// CORS needed) -> erp (localhost:8080). See ARCHITECTURE.md section 2 for
// the full rationale. Handles all 209 erp endpoints through one handler
// instead of one Route Handler file per endpoint.
//
// Path mapping: /api/backend/products/123 -> erp's /api/v1/products/123.
// erp's Public API (/api/public/v1/**, API-key auth) is intentionally NOT
// reachable through this proxy -- it's a different auth mechanism and, per
// the production readiness audit, no controller for it was found to exist
// in erp yet anyway.
// body is read once by the caller and passed in here -- a NextRequest's body
// stream can only be consumed once, but a 401 can make this run twice (see
// handle()'s retry-with-refreshed-token path below), which previously crashed
// with "Body is unusable: Body has already been read" on the second forward().
async function forward(
  request: NextRequest,
  path: string[],
  accessToken: string,
  body: ArrayBuffer | undefined
): Promise<Response> {
  const targetUrl = new URL(`${ERP_API_URL}/api/v1/${path.join("/")}`);
  targetUrl.search = request.nextUrl.search;

  const contentType = request.headers.get("content-type");

  return fetch(targetUrl, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body,
    cache: "no-store",
  });
}

async function handle(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  try {
    const { path } = await ctx.params;

    let accessToken = await getAccessToken();
    if (!accessToken) {
      const refreshed = await refreshAccessToken();
      if (!refreshed.ok) return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
      accessToken = refreshed.accessToken;
    }

    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer();

    let erpResponse = await forward(request, path, accessToken, body);

    if (erpResponse.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed.ok) {
        accessToken = refreshed.accessToken;
        erpResponse = await forward(request, path, accessToken, body);
      }
    }

    const responseBody = await erpResponse.arrayBuffer();
    return new NextResponse(responseBody, {
      status: erpResponse.status,
      headers: {
        "Content-Type": erpResponse.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Backend proxy error:", error);
    return NextResponse.json(
      { success: false, error: { code: "PROXY_ERROR", message: error instanceof Error ? error.message : "Internal proxy error" } },
      { status: 500 }
    );
  }
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
