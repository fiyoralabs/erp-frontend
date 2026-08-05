import { NextResponse } from "next/server";
const ERP = process.env.ERP_API_URL ?? "http://localhost:8080";
export async function POST(request: Request) {
  const response = await fetch(`${ERP}/api/v1/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await request.json()), cache: "no-store" });
  return NextResponse.json(await response.json(), { status: response.status });
}
