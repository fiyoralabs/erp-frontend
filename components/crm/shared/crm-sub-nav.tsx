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
  Menu,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
    icon: UserCheck,
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
    icon: Target,
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
    icon: CheckSquare,
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

  const isActive = (item: CrmNavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  // Primary bottom bar items for mobile screens
  const primaryMobileItems = crmNavItems.slice(0, 4);

  return (
    <div className="w-full">
      {/* Laptop & Desktop Sub-Header Navigation Tabs */}
      <div className="hidden md:flex items-center gap-1 border-b bg-muted/30 px-4 py-2 overflow-x-auto scrollbar-none sticky top-0 z-20 backdrop-blur-md">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-3 shrink-0">
          CRM Hub
        </span>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
          {crmNavItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile Phone Fixed Bottom Action Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t px-2 py-1 flex items-center justify-around shadow-lg pb-safe">
        {primaryMobileItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors flex-1 text-center min-w-0",
                active
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5 mb-0.5", active && "scale-110 transition-transform")} />
              <span className="truncate w-full">{item.title}</span>
            </Link>
          );
        })}

        {/* Mobile "More" Drawer Trigger */}
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetTrigger
            className={cn(
              "flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground flex-1 text-center min-w-0",
              mobileSheetOpen && "text-primary font-bold"
            )}
          >
            <Menu className="h-5 w-5 mb-0.5" />
            <span>More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto px-4 pb-8 pt-6">
            <SheetHeader className="pb-4 border-b mb-4">
              <SheetTitle className="text-left text-lg font-bold flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-primary" />
                CRM Navigation Hub
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-1 gap-2">
              {crmNavItems.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileSheetOpen(false)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-all",
                      active
                        ? "bg-primary/10 border-primary text-primary font-semibold"
                        : "bg-card border-border hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
