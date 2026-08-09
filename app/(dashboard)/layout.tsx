import { verifySession } from "@/lib/dal";
import { serverApiGet } from "@/lib/server-api";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import type { CurrentUser } from "@/lib/types/user";
import { getCurrentPermissions } from "@/lib/authorization";
import type { Location } from "@/lib/types/master";

type WorkingLocationContext = { activeLocation: Location | null; allowedLocations: Location[]; locationRequired: boolean };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Real auth enforcement (redirects to /login if no valid session) --
  // proxy.ts only did an optimistic cookie-presence check before this.
  const session = await verifySession();
  const user = await serverApiGet<CurrentUser>("users/me");
  const permissions = await getCurrentPermissions();
  const locationContext = await serverApiGet<WorkingLocationContext>("users/me/context") ?? {
    activeLocation: null,
    allowedLocations: [],
    locationRequired: true,
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Fixed sidebar with separate scrollbar -- lg: and above only */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:shrink-0 h-full overflow-hidden bg-sidebar">
        <div className="flex h-14 items-center border-b px-4 font-semibold shrink-0">
          Fiyora ERP
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav permissions={permissions} />
        </div>
      </aside>

      {/* Main content wrapper with independent scrollbar */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        <div className="shrink-0 border-b bg-background">
          <Topbar
            userName={user?.fullName ?? session.sub}
            userEmail={user?.email ?? session.sub}
            companyLabel={`Company #${session.companyId}`}
            permissions={permissions}
            locationContext={locationContext}
          />
        </div>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">{children}</main>
      </div>
    </div>
  );
}
