"use client";

import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";

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
  className,
}: {
  activeCount: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "relative h-10 border-[#c0c8c8] text-[#1a1c1c] hover:bg-[#f3f4f3] dark:border-[#717978] dark:text-white dark:hover:bg-[#2f3131] ml-auto md:ml-0 shrink-0",
        className
      )}
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
  onApply,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  onClearAll: () => void;
  onApply?: () => void;
  children: React.ReactNode;
}) {
  const handleDone = () => {
    if (onApply) onApply();
    onOpenChange(false);
  };

  return (
    <>
      {/* Mobile Filter Popover (<768px) */}
      {open && (
        <div className="md:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs transition-opacity"
            onClick={() => onOpenChange(false)}
          />

          {/* Floating Popover Container anchored below Filter button */}
          <div className="fixed top-16 right-4 z-50 flex w-[min(320px,calc(100vw-2rem))] flex-col rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 shrink-0">
              <span className="font-heading text-sm font-semibold text-foreground">Filters</span>
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </button>
            </div>

            {/* Scrollable Filter Area */}
            <div
              key={open ? "mobile-filters-open" : "mobile-filters-closed"}
              className="max-h-[55vh] min-h-0 space-y-4 overflow-y-auto p-4 scrollbar-thin flex-1"
            >
              {children}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 border-t border-border/40 bg-popover p-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("flex-1", activeCount === 0 && "opacity-50")}
                disabled={activeCount === 0}
                onClick={onClearAll}
              >
                Clear all
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1 bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90"
                onClick={handleDone}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop / Tablet Side Sheet (>=768px) */}
      <div className="hidden md:block">
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="right"
            className="h-full max-h-screen w-full max-w-sm sm:data-[side=right]:max-w-sm flex flex-col overflow-hidden box-border"
          >
            <SheetHeader className="shrink-0">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div key={open ? "filters-panel-open" : "filters-panel-closed"} className="flex-1 min-h-0 space-y-5 overflow-y-auto px-4 py-4 scrollbar-thin">
              {children}
            </div>
            <SheetFooter className="flex-row gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                className={cn("flex-1", activeCount === 0 && "opacity-50")}
                disabled={activeCount === 0}
                onClick={onClearAll}
              >
                Clear all
              </Button>
              <Button type="button" className="flex-1 bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90" onClick={handleDone}>
                Done
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
