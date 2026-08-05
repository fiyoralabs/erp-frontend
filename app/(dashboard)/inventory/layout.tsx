import { requirePermissions } from "@/lib/authorization";
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePermissions(["INVENTORY_VIEW"]); return children;
}
