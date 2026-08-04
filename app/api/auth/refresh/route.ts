import { NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/auth";

// Explicit, client-triggered refresh (e.g. a "session about to expire"
// banner). The backend proxy also calls refreshAccessToken() directly on a
// 401 -- see app/api/backend/[...path]/route.ts -- this route exists for
// cases outside a proxied backend call.
export async function POST() {
  const result = await refreshAccessToken();
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: "REFRESH_FAILED" } },
      { status: 401 }
    );
  }
  return NextResponse.json({ success: true });
}
