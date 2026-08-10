import { requirePermissions } from "@/lib/authorization";
import { CrmSettingsClient } from "@/components/crm/settings/crm-settings-client";

export default async function CrmSettingsPage() {
  await requirePermissions(["CRM_SETTINGS_MANAGE"]);
  return <CrmSettingsClient />;
}
