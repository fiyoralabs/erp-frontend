import { ApiRequestError } from "@/lib/api-client";

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const fields = error.fieldErrors?.map((item) => `${item.field}: ${item.message}`).join(" · ");
    return fields ? `${error.message} — ${fields}` : error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}
