export const DASHBOARD_PERMISSIONS = [
  "REPORT_SALES_VIEW",
  "REPORT_PURCHASE_VIEW",
  "REPORT_EXPENSE_VIEW",
] as const;

export const REPORT_PERMISSIONS = [
  "REPORT_SALES_VIEW", "REPORT_PURCHASE_VIEW", "REPORT_INVENTORY_VIEW",
  "REPORT_CUSTOMER_VIEW", "REPORT_SUPPLIER_VIEW", "REPORT_EXPENSE_VIEW",
  "REPORT_FINANCIAL_VIEW",
] as const;

export const SETTINGS_PERMISSIONS = [
  "USER_VIEW", "ROLE_VIEW", "API_KEY_VIEW", "SESSION_VIEW",
] as const;

export const CRM_PERMISSIONS = [
  "CRM_DASHBOARD_VIEW", "LEAD_VIEW", "OPPORTUNITY_VIEW", "ACCOUNT_VIEW", "CONTACT_VIEW",
] as const;

export function hasAnyPermission(permissions: readonly string[], required: readonly string[]) {
  return required.some((permission) => permissions.includes(permission));
}

export function hasAllPermissions(permissions: readonly string[], required: readonly string[]) {
  return required.every((permission) => permissions.includes(permission));
}

export function landingPath(permissions: readonly string[]) {
  if (hasAllPermissions(permissions, DASHBOARD_PERMISSIONS)) return "/dashboard";
  const choices: Array<[string, readonly string[]]> = [
    ["/inventory", ["INVENTORY_VIEW"]], ["/sales", ["SALES_VIEW"]],
    ["/purchases", ["PURCHASE_VIEW"]], ["/products", ["PRODUCT_VIEW"]],
    ["/crm", CRM_PERMISSIONS],
    ["/expenses", ["EXPENSE_VIEW"]], ["/finance", ["FINANCE_VIEW"]],
    ["/reports", REPORT_PERMISSIONS], ["/master", ["MASTER_VIEW"]],
    ["/audit", ["AUDIT_VIEW"]], ["/settings/users", ["USER_VIEW"]],
    ["/settings/roles", ["ROLE_VIEW"]], ["/settings/api-keys", ["API_KEY_VIEW"]],
    ["/settings/sessions", ["SESSION_VIEW"]],
  ];
  return choices.find(([, required]) => hasAnyPermission(permissions, required))?.[0]
    ?? "/settings/profile";
}
