import { verifySession } from "@/lib/dal";
import { serverApiGet } from "@/lib/server-api";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import type { CurrentUser } from "@/lib/types/user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Real auth enforcement (redirects to /login if no valid session) --
  // proxy.ts only did an optimistic cookie-presence check before this.
  const session = await verifySession();
  const user = await serverApiGet<CurrentUser>("users/me");

  return (
    <div className="flex min-h-screen w-full">
      {/* Fixed sidebar, lg: and above only -- Topbar's Sheet covers mobile */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:shrink-0">
        <div className="flex h-14 items-center border-b px-4 font-semibold">
          Fiyora ERP
        </div>
        <SidebarNav />
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <Topbar
          userName={user?.fullName ?? session.sub}
          userEmail={user?.email ?? session.sub}
          companyLabel={`Company #${session.companyId}`}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
