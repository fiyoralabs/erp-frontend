import { verifySession } from "@/lib/dal";
import { serverApiGet } from "@/lib/server-api";
import { requirePermissions } from "@/lib/authorization";
import type { CurrentUser } from "@/lib/types/user";
import { CrmSidebar } from "@/components/crm/shared/crm-sidebar";
import { CrmTopbar } from "@/components/crm/shared/crm-topbar";
import { CrmSubNav } from "@/components/crm/shared/crm-sub-nav";
import { CrmThemeScope } from "@/components/crm/shared/crm-theme-scope";
import "./crm-theme.css";

type WorkingLocationContext = {
  activeLocation: { id: number; name: string } | null;
  allowedLocations: { id: number; name: string }[];
  locationRequired: boolean;
};

export default async function StandaloneCrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();
  await requirePermissions([
    "CRM_DASHBOARD_VIEW", "LEAD_VIEW", "CONTACT_VIEW", "ACCOUNT_VIEW",
    "OPPORTUNITY_VIEW", "ACTIVITY_VIEW", "CAMPAIGN_VIEW", "CRM_REPORT_VIEW", "CRM_SETTINGS_MANAGE",
  ]);

  const user = await serverApiGet<CurrentUser>("users/me");
  const locationContext = await serverApiGet<WorkingLocationContext>("users/me/context") ?? {
    activeLocation: null,
    allowedLocations: [],
    locationRequired: true,
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <CrmThemeScope />
      {/* Standalone CRM Sidebar -- visible on lg: and above only */}
      <div className="hidden lg:flex lg:w-64 lg:shrink-0 h-full overflow-hidden border-r bg-sidebar">
        <CrmSidebar />
      </div>

      {/* Main CRM Workspace Area */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        <CrmTopbar
          userName={user?.fullName ?? session.sub}
          userEmail={user?.email ?? session.sub}
          companyLabel={`Company #${session.companyId}`}
          locationContext={locationContext}
        />
        <CrmSubNav />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6 min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
