import { requirePermissions } from "@/lib/authorization";
import { DASHBOARD_PERMISSIONS } from "@/lib/permissions";
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePermissions(DASHBOARD_PERMISSIONS, "all"); return children;
}
