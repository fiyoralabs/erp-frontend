import { requirePermissions } from "@/lib/authorization";
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePermissions(["ROLE_VIEW"]); return children;
}
