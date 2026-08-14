"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems, type NavItem } from "@/lib/nav-config";
import { hasAllPermissions, hasAnyPermission } from "@/lib/permissions";

export function isVisible(item: NavItem, permissions: readonly string[]) {
  if (!item.requiredPermissions) return true;
  return item.permissionMode === "all"
    ? hasAllPermissions(permissions, item.requiredPermissions)
    : hasAnyPermission(permissions, item.requiredPermissions);
}

export function SidebarNav({
  permissions,
  onNavigate,
}: {
  permissions: readonly string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3 py-3">
      {navItems
        .filter((item) => isVisible(item, permissions))
        .map((item) => {
          if (item.items && item.items.length > 0) {
            return (
              <NavGroup
                key={item.href}
                item={item}
                permissions={permissions}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            );
          }
          return (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          );
        })}
    </nav>
  );
}

function NavGroup({
  item,
  permissions,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  permissions: readonly string[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const isWithinGroup =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const [open, setOpen] = React.useState(isWithinGroup);
  const visibleChildren = (item.items ?? []).filter((child) =>
    isVisible(child, permissions)
  );
  if (visibleChildren.length === 0) return null;
  const Icon = item.icon;

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "flex items-center justify-between rounded-xl transition-colors group pr-1",
          isWithinGroup
            ? "bg-[#0F3D3E]/10 text-[#1a1c1c] dark:bg-[#a3cfcf]/15 dark:text-white"
            : "text-[#545f73] dark:text-[#a3cfcf] hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] hover:text-[#1a1c1c] dark:hover:text-white"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-3 px-3 py-2.5 text-sm font-medium min-h-11 text-left"
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1">{item.title}</span>
          <ChevronDown
            className={cn(
              "size-4 transition-transform shrink-0",
              open && "rotate-180"
            )}
          />
        </button>
        {item.href && (
          <a
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="p-2 text-[#717978] hover:text-[#0F3D3E] dark:hover:text-[#a3cfcf] transition-colors opacity-70 hover:opacity-100"
            title={`Open ${item.title} Workspace in a new window/tab`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {open && (
        <div className="ml-4 flex flex-col gap-1 border-l border-[#e2e2e2] dark:border-[#404848] pl-3 pt-1">
          {visibleChildren.map((child) => (
            <NavLink
              key={child.href}
              item={child}
              pathname={pathname}
              onNavigate={onNavigate}
              exact
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
  exact,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  exact?: boolean;
}) {
  const isActive = exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  if (!item.implemented) {
    return (
      <span
        aria-disabled
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#545f73]/50 dark:text-[#a3cfcf]/40 cursor-not-allowed select-none"
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
    <div className="flex items-center justify-between rounded-xl transition-colors group">
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-h-11",
          isActive
            ? "bg-[#0F3D3E] text-white font-semibold shadow-xs dark:bg-[#beebeb] dark:text-[#002020]"
            : "text-[#545f73] dark:text-[#a3cfcf] hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] hover:text-[#1a1c1c] dark:hover:text-white"
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1">{item.title}</span>
      </Link>
      {item.href === "/crm" && (
        <a
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="p-2 text-[#717978] hover:text-[#0F3D3E] dark:hover:text-[#a3cfcf] transition-colors opacity-70 hover:opacity-100"
          title="Open CRM Workspace in a new window/tab"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}
