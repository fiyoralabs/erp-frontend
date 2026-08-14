import { NextResponse } from "next/server";
import { getErpApiUrl } from "@/lib/env-config";

const ERP = getErpApiUrl();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${ERP}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "Could not connect to ERP backend server.",
        },
      },
      { status: 503 }
    );
  }
}
