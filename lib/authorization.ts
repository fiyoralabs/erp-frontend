import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverApiGet } from "@/lib/server-api";
import { hasAllPermissions, hasAnyPermission, landingPath } from "@/lib/permissions";

export const getCurrentPermissions = cache(async () =>
  (await serverApiGet<string[]>("users/me/permissions")) ?? []
);

export async function requirePermissions(required: readonly string[], mode: "any" | "all" = "any") {
  const permissions = await getCurrentPermissions();
  const allowed = mode === "all"
    ? hasAllPermissions(permissions, required)
    : hasAnyPermission(permissions, required);
  if (!allowed) redirect(landingPath(permissions));
  return permissions;
}
