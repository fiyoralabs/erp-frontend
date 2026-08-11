import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Database,
  Package,
  Warehouse,
  ShoppingCart,
  Receipt,
  Wallet,
  Landmark,
  BarChart3,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  // Module build phase from IMPLEMENTATION_PLAN.md -- items past the
  // currently-built phase render as disabled/"coming soon" rather than
  // linking to a 404, so the nav is honest about what's actually usable.
  implemented: boolean;
  requiredPermissions?: readonly string[];
  permissionMode?: "any" | "all";
  // Nested sub-items (e.g. CRM's Leads/Contacts/Accounts/...). First
  // 2-level menu in this app -- SidebarNav renders these as a collapsible
  // group instead of a single link.
  items?: readonly NavItem[];
}

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, implemented: true, requiredPermissions: ["REPORT_SALES_VIEW", "REPORT_PURCHASE_VIEW", "REPORT_EXPENSE_VIEW"], permissionMode: "all" },
  { title: "Master Data", href: "/master", icon: Database, implemented: true, requiredPermissions: ["MASTER_VIEW"] },
  { title: "Products", href: "/products", icon: Package, implemented: true, requiredPermissions: ["PRODUCT_VIEW"] },
  { title: "Inventory", href: "/inventory", icon: Warehouse, implemented: true, requiredPermissions: ["INVENTORY_VIEW"] },
  { title: "Purchases", href: "/purchases", icon: ShoppingCart, implemented: true, requiredPermissions: ["PURCHASE_VIEW"] },
  { title: "Sales", href: "/sales", icon: Receipt, implemented: true, requiredPermissions: ["SALES_VIEW"] },
  {
    title: "CRM",
    href: "/crm",
    icon: Users,
    implemented: true,
    requiredPermissions: ["CRM_DASHBOARD_VIEW", "LEAD_VIEW", "OPPORTUNITY_VIEW", "ACCOUNT_VIEW", "CONTACT_VIEW"],
  },
  { title: "Expenses", href: "/expenses", icon: Wallet, implemented: true, requiredPermissions: ["EXPENSE_VIEW"] },
  { title: "Finance", href: "/finance", icon: Landmark, implemented: true, requiredPermissions: ["FINANCE_VIEW"] },
  { title: "Reports", href: "/reports", icon: BarChart3, implemented: true, requiredPermissions: ["REPORT_SALES_VIEW", "REPORT_PURCHASE_VIEW", "REPORT_INVENTORY_VIEW", "REPORT_CUSTOMER_VIEW", "REPORT_SUPPLIER_VIEW", "REPORT_EXPENSE_VIEW", "REPORT_FINANCIAL_VIEW"] },
  { title: "Audit Log", href: "/audit", icon: ScrollText, implemented: true, requiredPermissions: ["AUDIT_VIEW"] },
  { title: "Settings", href: "/settings", icon: Settings, implemented: true, requiredPermissions: ["USER_VIEW", "ROLE_VIEW", "API_KEY_VIEW", "SESSION_VIEW"] },
];
