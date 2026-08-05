import { requirePermissions } from "@/lib/authorization";
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePermissions(["AUDIT_VIEW"]); return children;
}
