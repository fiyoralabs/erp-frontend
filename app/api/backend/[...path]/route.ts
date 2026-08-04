import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, refreshAccessToken } from "@/lib/auth";

const ERP_API_URL = process.env.ERP_API_URL ?? "http://localhost:8080";

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
async function forward(
  request: NextRequest,
  path: string[],
  accessToken: string
): Promise<Response> {
  const targetUrl = new URL(`${ERP_API_URL}/api/v1/${path.join("/")}`);
  targetUrl.search = request.nextUrl.search;

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

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
  const { path } = await ctx.params;

  let accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  let erpResponse = await forward(request, path, accessToken);

  // erp's JwtFilter re-validates on every request (confirmed in the
  // production readiness audit), so a 401 here can legitimately mean the
  // access token expired mid-session, not just bad credentials. Try exactly
  // one silent refresh-and-retry before surfacing the 401 to the client --
  // screens should never need to think about token expiry themselves.
  if (erpResponse.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed.ok) {
      accessToken = refreshed.accessToken;
      erpResponse = await forward(request, path, accessToken);
    }
  }

  const responseBody = await erpResponse.arrayBuffer();
  return new NextResponse(responseBody, {
    status: erpResponse.status,
    headers: {
      "Content-Type": erpResponse.headers.get("content-type") ?? "application/json",
    },
  });
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
