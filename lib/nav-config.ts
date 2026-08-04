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
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  // Module build phase from IMPLEMENTATION_PLAN.md -- items past the
  // currently-built phase render as disabled/"coming soon" rather than
  // linking to a 404, so the nav is honest about what's actually usable.
  implemented: boolean;
}

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, implemented: true },
  { title: "Master Data", href: "/master", icon: Database, implemented: true },
  { title: "Products", href: "/products", icon: Package, implemented: true },
  { title: "Inventory", href: "/inventory", icon: Warehouse, implemented: true },
  { title: "Purchases", href: "/purchases", icon: ShoppingCart, implemented: true },
  { title: "Sales", href: "/sales", icon: Receipt, implemented: true },
  { title: "Expenses", href: "/expenses", icon: Wallet, implemented: true },
  { title: "Finance", href: "/finance", icon: Landmark, implemented: true },
  { title: "Reports", href: "/reports", icon: BarChart3, implemented: true },
  { title: "Audit Log", href: "/audit", icon: ScrollText, implemented: true },
  { title: "Settings", href: "/settings", icon: Settings, implemented: true },
];
