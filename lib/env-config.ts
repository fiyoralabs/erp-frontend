export function getErpApiUrl(): string {
  const url =
    process.env.ERP_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8080";
  return url.replace(/\/$/, "");
}
