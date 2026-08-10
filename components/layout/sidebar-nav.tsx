"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems, type NavItem } from "@/lib/nav-config";
import { hasAllPermissions, hasAnyPermission } from "@/lib/permissions";

function isVisible(item: NavItem, permissions: readonly string[]) {
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
    <nav className="flex flex-col gap-1 p-3">
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
          "flex items-center justify-between rounded-md transition-colors group pr-1",
          isWithinGroup
            ? "bg-primary/10 text-foreground"
            : "text-foreground/80 hover:bg-muted hover:text-foreground"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-3 px-3 py-2 text-sm font-medium min-h-11 text-left"
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
            className="p-2 text-muted-foreground hover:text-primary transition-colors opacity-70 hover:opacity-100"
            title={`Open ${item.title} Workspace in a new window/tab`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {open && (
        <div className="ml-4 flex flex-col gap-1 border-l pl-3 pt-1">
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
    <div className="flex items-center justify-between rounded-md transition-colors group">
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-11",
          isActive
            ? "bg-primary text-primary-foreground font-semibold"
            : "text-foreground/80 hover:bg-muted hover:text-foreground"
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
          className="p-2 text-muted-foreground hover:text-primary transition-colors opacity-70 hover:opacity-100"
          title="Open CRM Workspace in a new window/tab"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}
