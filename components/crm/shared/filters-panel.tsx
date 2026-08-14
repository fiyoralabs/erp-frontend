"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Shared "Filters" trigger + side panel used across the CRM list pages
// (Leads, Contacts, Accounts, Opportunities): a couple of primary filters stay
// inline next to Search, everything else lives behind this button so the
// filter bar doesn't grow a new column every time a field needs a filter.
export function FiltersButton({
  activeCount,
  onClick,
}: {
  activeCount: number;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="relative h-10 border-[#c0c8c8] text-[#1a1c1c] hover:bg-[#f3f4f3] dark:border-[#717978] dark:text-white dark:hover:bg-[#2f3131]"
      onClick={onClick}
    >
      <SlidersHorizontal className="mr-1.5 size-4" />
      Filters
      {activeCount > 0 && (
        <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0F3D3E] px-1.5 text-[10px] font-bold text-white dark:bg-[#a3cfcf] dark:text-[#002020]">
          {activeCount}
        </span>
      )}
    </Button>
  );
}

export function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#545f73] dark:text-[#a3cfcf]">{label}</label>
      {children}
    </div>
  );
}

export function FiltersPanel({
  open,
  onOpenChange,
  activeCount,
  onClearAll,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  onClearAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-4">{children}</div>
        <SheetFooter className="flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn("flex-1", activeCount === 0 && "opacity-50")}
            disabled={activeCount === 0}
            onClick={onClearAll}
          >
            Clear all
          </Button>
          <Button type="button" className="flex-1 bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
