import { NextResponse } from "next/server";
import { setSessionCookies } from "@/lib/auth";

import { getErpApiUrl } from "@/lib/env-config";

const ERP_API_URL = getErpApiUrl();

// Curl-verified against the live erp instance before writing this handler:
//   POST /api/v1/auth/login {"email","password"}
//   200 -> {"success":true,"data":{"accessToken","refreshToken","tokenType","expiresIn","permissions":[...]}}
//   401 -> {"success":false,"error":{"code":"UNAUTHORIZED","message","fieldErrors":null}}
export async function POST(request: Request) {
  const body = await request.json();

  const erpResponse = await fetch(`${ERP_API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const erpData = await erpResponse.json();

  if (!erpResponse.ok || !erpData.success) {
    return NextResponse.json(erpData, { status: erpResponse.status });
  }

  await setSessionCookies({
    accessToken: erpData.data.accessToken,
    refreshToken: erpData.data.refreshToken,
    expiresIn: erpData.data.expiresIn,
  });

  // Never echo the raw tokens back to the client -- they're httpOnly cookies
  // now. Client code only needs to know the login succeeded and what
  // permissions it has (for optimistic UI, not for authorization decisions).
  return NextResponse.json({
    success: true,
    permissions: erpData.data.permissions,
  });
}
