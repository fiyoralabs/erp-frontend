import { NextResponse } from "next/server";
import { setSessionCookies } from "@/lib/auth";
import { getErpApiUrl } from "@/lib/env-config";

const ERP_API_URL = getErpApiUrl();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    let erpResponse: Response;
    try {
      erpResponse = await fetch(`${ERP_API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
    } catch (fetchErr) {
      console.error("[Login Route] Connection to backend failed:", fetchErr);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BACKEND_UNAVAILABLE",
            message: `Could not connect to ERP backend server (${ERP_API_URL}). Please verify that the backend service is running.`,
          },
        },
        { status: 503 }
      );
    }

    let erpData: any;
    try {
      erpData = await erpResponse.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_RESPONSE",
            message: "Invalid response received from backend server.",
          },
        },
        { status: 502 }
      );
    }

    if (!erpResponse.ok || !erpData.success) {
      return NextResponse.json(erpData, { status: erpResponse.status || 401 });
    }

    await setSessionCookies({
      accessToken: erpData.data.accessToken,
      refreshToken: erpData.data.refreshToken,
      expiresIn: erpData.data.expiresIn,
    });

    return NextResponse.json({
      success: true,
      permissions: erpData.data.permissions,
    });
  } catch (err: any) {
    console.error("[Login Route] Unexpected error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err?.message || "An unexpected error occurred during login.",
        },
      },
      { status: 500 }
    );
  }
}
