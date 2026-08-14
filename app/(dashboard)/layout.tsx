import Image from "next/image";
import { verifySession } from "@/lib/dal";
import { serverApiGet } from "@/lib/server-api";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#f9f9f9] dark:bg-[#121414]">
      {/* Fixed sidebar with separate scrollbar -- lg: and above only */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 h-full overflow-hidden border-r border-[#e2e2e2] dark:border-[#404848] bg-white dark:bg-[#1a1c1c]">
        <div className="flex h-16 items-center gap-3 border-b border-[#e2e2e2] dark:border-[#404848] px-5 shrink-0">
          <div className="relative h-8 w-8 shrink-0">
            <Image src="/logo-light.png" alt="Fiyora ERP" fill priority className="object-contain" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-semibold leading-tight text-[#002627] dark:text-white tracking-tight">
              Fiyora ERP
            </h1>
            <p className="text-[10px] font-semibold text-[#545f73] dark:text-[#a3cfcf] tracking-wider uppercase">
              Enterprise Suite
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav permissions={permissions} />
        </div>
      </aside>

      {/* Main content wrapper with independent scrollbar */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        <div className="shrink-0 border-b border-[#e2e2e2] dark:border-[#404848] bg-white dark:bg-[#1a1c1c]">
          <Topbar
            userName={user?.fullName ?? session.sub}
            userEmail={user?.email ?? session.sub}
            permissions={permissions}
            locationContext={locationContext}
          />
        </div>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6 min-h-0">{children}</main>
        <MobileBottomNav permissions={permissions} />
      </div>
    </div>
  );
}
