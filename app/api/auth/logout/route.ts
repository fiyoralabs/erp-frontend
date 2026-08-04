import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/auth";

// erp has no /api/v1/auth/logout endpoint (curl-verified: 404 ROUTE_NOT_FOUND).
// Logout is client-side token discard, matching erp's own documented auth
// model -- clear the cookies and we're done. If erp ever adds server-side
// refresh-token revocation on logout, call it here before clearing.
export async function POST() {
  await clearSessionCookies();
  return NextResponse.json({ success: true });
}
