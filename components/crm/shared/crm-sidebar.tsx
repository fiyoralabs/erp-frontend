"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Target,
  Kanban,
  Activity,
  CheckSquare,
  Megaphone,
  BarChart3,
  Settings,
  UserCheck,
  ArrowLeft,
  Plus,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { crmNavItems } from "@/components/crm/shared/crm-sub-nav";

export function CrmSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="flex flex-col h-full w-full bg-sidebar text-sidebar-foreground">
      {/* CRM Brand Header */}
      <div className="flex h-14 items-center justify-between border-b px-4 shrink-0">
        <div className="flex items-center gap-2 font-bold text-base tracking-tight text-sidebar-foreground">
          <div className="p-1.5 rounded-lg bg-primary text-primary-foreground">
            <Briefcase className="h-4 w-4" />
          </div>
          <span>Fiyora CRM</span>
        </div>
        <Link
          href="/crm/leads/new"
          className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
          title="New Lead"
        >
          <Plus className="h-4 w-4" />
        </Link>
      </div>

      {/* Main CRM Sidebar Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          CRM Workspace
        </div>
        {crmNavItems.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-10",
                active
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer Return Link */}
      <div className="p-3 border-t shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Main ERP</span>
        </Link>
      </div>
    </aside>
  );
}
