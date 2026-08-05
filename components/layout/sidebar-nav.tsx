"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav-config";
import { hasAllPermissions, hasAnyPermission } from "@/lib/permissions";

export function SidebarNav({ permissions, onNavigate }: { permissions: readonly string[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.filter((item) => !item.requiredPermissions || (item.permissionMode === "all"
        ? hasAllPermissions(permissions, item.requiredPermissions)
        : hasAnyPermission(permissions, item.requiredPermissions))).map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        if (!item.implemented) {
          return (
            <span
              key={item.href}
              aria-disabled
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed select-none"
              title="Coming soon"
            >
              <Icon className="size-4" />
              {item.title}
              <span className="ml-auto text-[10px] uppercase tracking-wide">
                Soon
              </span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "min-h-11", // touch target
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground/80 hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
