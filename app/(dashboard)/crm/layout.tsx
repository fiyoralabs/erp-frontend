import { requirePermissions } from "@/lib/authorization";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  await requirePermissions([
    "CRM_DASHBOARD_VIEW", "LEAD_VIEW", "CONTACT_VIEW", "ACCOUNT_VIEW",
    "OPPORTUNITY_VIEW", "ACTIVITY_VIEW", "CAMPAIGN_VIEW", "CRM_REPORT_VIEW", "CRM_SETTINGS_MANAGE",
  ]);
  return children;
}
