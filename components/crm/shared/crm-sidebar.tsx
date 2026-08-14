"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { crmNavItems } from "@/components/crm/shared/crm-sub-nav";
import { useOverdueCounts } from "@/components/crm/shared/use-overdue-counts";

export function CrmSidebar() {
  const pathname = usePathname();
  const overdue = useOverdueCounts();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const mainItems = crmNavItems.filter((i) => i.href !== "/crm/settings");
  const settingsItem = crmNavItems.find((i) => i.href === "/crm/settings");

  return (
    <aside className="flex flex-col h-full w-full bg-white dark:bg-[#1a1c1c] border-r border-[#e2e2e2] dark:border-[#404848] text-[#1a1c1c] dark:text-white select-none">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-[#e2e2e2] dark:border-[#404848] shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 shrink-0">
            <Image src="/logo-light.png" alt="Fiyora ERP" fill className="object-contain" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold text-[#002627] dark:text-white tracking-tight">
              Fiyora CRM
            </h1>
            <p className="text-[10px] font-semibold text-[#545f73] dark:text-[#a3cfcf] tracking-wider uppercase">
              CRM WORKSPACE
            </p>
          </div>
        </div>

        <Link
          href="/crm/leads/new"
          className="p-1.5 rounded-lg bg-[#f3f4f3] dark:bg-[#2f3131] hover:bg-[#0F3D3E] hover:text-white text-[#545f73] dark:text-white transition-colors"
          title="Create New Lead"
        >
          <Plus className="h-4 w-4" />
        </Link>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin">
        {mainItems.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          const overdueCount = overdue.forNavHref(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[#0F3D3E] text-white font-semibold shadow-xs"
                  : "text-[#545f73] dark:text-[#a3cfcf] hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] hover:text-[#1a1c1c] dark:hover:text-white"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-[#545f73] dark:text-[#a3cfcf]")} />
              <span className="flex-1">{item.title}</span>
              {overdueCount > 0 && (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                    active ? "bg-white text-[#ba1a1a]" : "bg-[#ba1a1a] text-white"
                  )}
                  title={`${overdueCount} overdue`}
                >
                  {overdueCount}
                </span>
              )}
            </Link>
          );
        })}

        {settingsItem && (
          <div className="pt-3 mt-3 border-t border-[#e2e2e2] dark:border-[#404848]">
            <Link
              href={settingsItem.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive(settingsItem.href, settingsItem.exact)
                  ? "bg-[#0F3D3E] text-white font-semibold shadow-xs"
                  : "text-[#545f73] dark:text-[#a3cfcf] hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] hover:text-[#1a1c1c] dark:hover:text-white"
              )}
            >
              <settingsItem.icon className="h-4 w-4 shrink-0" />
              <span>{settingsItem.title}</span>
            </Link>
          </div>
        )}
      </div>

      {/* Footer Return Link & Brand Pill */}
      <div className="p-3 border-t border-[#e2e2e2] dark:border-[#404848] mt-auto shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#0F3D3E] dark:text-[#a3cfcf] hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Main ERP</span>
        </Link>
      </div>
    </aside>
  );
}
