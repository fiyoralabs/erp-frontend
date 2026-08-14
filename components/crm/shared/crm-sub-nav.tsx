"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Contact,
  Building2,
  Lightbulb,
  Kanban,
  Activity,
  CheckCircle2,
  Megaphone,
  BarChart3,
  Settings,
  Menu,
  ChevronRight,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useOverdueCounts } from "@/components/crm/shared/use-overdue-counts";

export interface CrmNavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  description: string;
  exact?: boolean;
}

export const crmNavItems: CrmNavItem[] = [
  {
    title: "Dashboard",
    href: "/crm",
    icon: LayoutDashboard,
    description: "CRM overview & performance stats",
    exact: true,
  },
  {
    title: "Leads",
    href: "/crm/leads",
    icon: Users,
    description: "Manage prospective leads & qualification",
  },
  {
    title: "Contacts",
    href: "/crm/contacts",
    icon: Contact,
    description: "Individual customer contacts & details",
  },
  {
    title: "Accounts",
    href: "/crm/accounts",
    icon: Building2,
    description: "Company accounts & organizational details",
  },
  {
    title: "Opportunities",
    href: "/crm/opportunities",
    icon: Lightbulb,
    description: "Active sales deals & revenue pipelines",
  },
  {
    title: "Pipeline",
    href: "/crm/pipeline",
    icon: Kanban,
    description: "Visual Kanban deal stage board",
  },
  {
    title: "Activities",
    href: "/crm/activities",
    icon: Activity,
    description: "Calls, meetings, emails & logs",
  },
  {
    title: "Tasks",
    href: "/crm/tasks",
    icon: CheckCircle2,
    description: "Follow-up tasks & pending action items",
  },
  {
    title: "Campaigns",
    href: "/crm/campaigns",
    icon: Megaphone,
    description: "Marketing outreach & email campaigns",
  },
  {
    title: "Reports",
    href: "/crm/reports",
    icon: BarChart3,
    description: "Sales analytics & conversion reports",
  },
  {
    title: "Settings",
    href: "/crm/settings",
    icon: Settings,
    description: "CRM stage, tag & lead source config",
  },
];

export function CrmSubNav() {
  const pathname = usePathname();
  const [mobileSheetOpen, setMobileSheetOpen] = React.useState(false);
  const overdue = useOverdueCounts();

  const isActive = (item: CrmNavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <div className="w-full">
      {/* Tablet-only Top Horizontal Tab Bar. Hidden below md: the fixed bottom
          nav (+ its "More" drawer) already covers navigation there, so this
          would just be a second, redundant nav bar stacked above it. Hidden
          at lg: too, once the full sidebar takes over. */}
      <div className="hidden md:flex lg:hidden items-center border-b border-[#e2e2e2] dark:border-[#404848] bg-white dark:bg-[#1a1c1c] px-4 py-2 overflow-x-auto scrollbar-none sticky top-0 z-20">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#545f73] dark:text-[#a3cfcf] mr-3 shrink-0">
          CRM HUB
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {crmNavItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            const overdueCount = overdue.forNavHref(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0",
                  active
                    ? "bg-[#0F3D3E] text-white font-semibold shadow-xs"
                    : "text-[#545f73] dark:text-[#a3cfcf] hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] hover:text-[#1a1c1c] dark:hover:text-white"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.title}</span>
                {overdueCount > 0 && (
                  <span
                    className={cn(
                      "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold",
                      active ? "bg-white text-[#ba1a1a]" : "bg-[#ba1a1a] text-white"
                    )}
                  >
                    {overdueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (Matching Stitch mobile-crm-dashboard-full.html) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1a1c1c]/95 backdrop-blur-md border-t border-[#e2e2e2] dark:border-[#404848] h-[68px] pb-safe px-3 flex items-center justify-around shadow-lg">
        {/* 1. Dashboard */}
        <Link
          href="/crm"
          className={cn(
            "flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-colors flex-1 text-center",
            pathname === "/crm"
              ? "text-[#0F3D3E] dark:text-[#beebeb] font-bold"
              : "text-[#545f73] dark:text-[#a3cfcf]"
          )}
        >
          <div className={cn("p-1 rounded-full", pathname === "/crm" && "bg-[#0F3D3E]/10 dark:bg-[#beebeb]/15")}>
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <span>Home</span>
        </Link>

        {/* 2. Leads */}
        <Link
          href="/crm/leads"
          className={cn(
            "flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-colors flex-1 text-center",
            pathname.startsWith("/crm/leads")
              ? "text-[#0F3D3E] dark:text-[#beebeb] font-bold"
              : "text-[#545f73] dark:text-[#a3cfcf]"
          )}
        >
          <div className={cn("relative p-1 rounded-full", pathname.startsWith("/crm/leads") && "bg-[#0F3D3E]/10 dark:bg-[#beebeb]/15")}>
            <Users className="h-5 w-5" />
            {overdue.forNavHref("/crm/leads") > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#ba1a1a] px-0.5 text-[8px] font-bold text-white">
                {overdue.forNavHref("/crm/leads") > 99 ? "99+" : overdue.forNavHref("/crm/leads")}
              </span>
            )}
          </div>
          <span>Leads</span>
        </Link>

        {/* 3. Floating Action Button (Create Lead) */}
        <Link
          href="/crm/leads/new"
          className="flex items-center justify-center w-11 h-11 bg-[#0F3D3E] text-white rounded-2xl shadow-md -translate-y-3.5 active:scale-95 transition-transform"
          title="Create New Lead"
        >
          <Plus className="h-5 w-5" />
        </Link>

        {/* 4. Pipeline */}
        <Link
          href="/crm/pipeline"
          className={cn(
            "flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-colors flex-1 text-center",
            pathname.startsWith("/crm/pipeline")
              ? "text-[#0F3D3E] dark:text-[#beebeb] font-bold"
              : "text-[#545f73] dark:text-[#a3cfcf]"
          )}
        >
          <div className={cn("p-1 rounded-full", pathname.startsWith("/crm/pipeline") && "bg-[#0F3D3E]/10 dark:bg-[#beebeb]/15")}>
            <Kanban className="h-5 w-5" />
          </div>
          <span>Pipeline</span>
        </Link>

        {/* 5. More Drawer */}
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetTrigger
            className={cn(
              "flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium text-[#545f73] dark:text-[#a3cfcf] flex-1 text-center",
              mobileSheetOpen && "text-[#0F3D3E] dark:text-[#beebeb] font-bold"
            )}
          >
            <div className="p-1">
              <Menu className="h-5 w-5" />
            </div>
            <span>More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-[24px] max-h-[85vh] overflow-y-auto px-4 pb-8 pt-6 border-[#e2e2e2] dark:border-[#404848]">
            <SheetHeader className="pb-4 border-b border-[#e2e2e2] dark:border-[#404848] mb-4">
              <SheetTitle className="text-left text-lg font-bold flex items-center gap-2 text-[#002627] dark:text-white">
                <LayoutDashboard className="h-5 w-5 text-[#0F3D3E]" />
                CRM Navigation Hub
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-1 gap-2">
              {crmNavItems.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                const overdueCount = overdue.forNavHref(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileSheetOpen(false)}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-2xl border transition-all",
                      active
                        ? "bg-[#0F3D3E]/10 border-[#0F3D3E] text-[#0F3D3E] font-semibold dark:text-[#beebeb]"
                        : "bg-white dark:bg-[#1a1c1c] border-[#e2e2e2] dark:border-[#404848] text-[#1a1c1c] dark:text-white hover:bg-[#f3f4f3]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-xl",
                          active
                            ? "bg-[#0F3D3E] text-white"
                            : "bg-[#f3f4f3] dark:bg-[#2f3131] text-[#545f73] dark:text-[#a3cfcf]"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className="text-xs text-[#545f73] dark:text-[#a3cfcf]">{item.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {overdueCount > 0 && (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ba1a1a] px-1.5 text-[10px] font-bold text-white">
                          {overdueCount}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-[#717978]" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
