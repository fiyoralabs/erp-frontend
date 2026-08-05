import { requirePermissions } from "@/lib/authorization";
import { REPORT_PERMISSIONS } from "@/lib/permissions";
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePermissions(REPORT_PERMISSIONS); return children;
}
