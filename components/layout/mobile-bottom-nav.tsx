"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav-config";
import { SidebarNav, isVisible } from "@/components/layout/sidebar-nav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Preferred order for the handful of slots that fit in the bar; anything not
// visible for this user (permissions) is skipped rather than left blank, and
// everything else -- the full nav-config list -- lives behind "More".
const PRIMARY_TITLES = ["Dashboard", "Sales", "Purchases", "Inventory"];

export function MobileBottomNav({ permissions }: { permissions: readonly string[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const visibleItems = navItems.filter((item) => isVisible(item, permissions));
  const primaryItems = PRIMARY_TITLES
    .map((title) => visibleItems.find((item) => item.title === title))
    .filter((item): item is NonNullable<typeof item> => !!item);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1a1c1c]/95 backdrop-blur-md border-t border-[#e2e2e2] dark:border-[#404848] h-[68px] pb-safe px-2 flex items-center justify-around shadow-lg">
      {primaryItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-colors flex-1 text-center",
              active ? "text-[#0F3D3E] dark:text-[#beebeb] font-bold" : "text-[#545f73] dark:text-[#a3cfcf]"
            )}
          >
            <div className={cn("p-1 rounded-full", active && "bg-[#0F3D3E]/10 dark:bg-[#beebeb]/15")}>
              <Icon className="h-5 w-5" />
            </div>
            <span>{item.title}</span>
          </Link>
        );
      })}

      {/* More Drawer -- the full nav-config list, same as the sidebar */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetTrigger
          className={cn(
            "flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium text-[#545f73] dark:text-[#a3cfcf] flex-1 text-center",
            moreOpen && "text-[#0F3D3E] dark:text-[#beebeb] font-bold"
          )}
        >
          <div className="p-1">
            <Menu className="h-5 w-5" />
          </div>
          <span>More</span>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="rounded-t-[24px] max-h-[85vh] overflow-y-auto px-2 pb-8 pt-6 border-[#e2e2e2] dark:border-[#404848] bg-white dark:bg-[#1a1c1c]"
        >
          <SheetHeader className="pb-4 border-b border-[#e2e2e2] dark:border-[#404848] mb-2 px-2">
            <SheetTitle className="text-left flex items-center gap-2.5 text-[#002627] dark:text-white">
              <div className="relative h-7 w-7 shrink-0">
                <Image src="/logo-light.png" alt="Fiyora ERP" fill className="object-contain" />
              </div>
              Fiyora ERP
            </SheetTitle>
          </SheetHeader>
          <SidebarNav permissions={permissions} onNavigate={() => setMoreOpen(false)} />
        </SheetContent>
      </Sheet>
    </nav>
  );
}
