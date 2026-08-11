import * as React from "react";
import { TabsList } from "@/components/ui/tabs";

// Detail-page tab strips (Lead/Opportunity/Contact/Account) can overflow on
// narrow phones -- swipeable, but with nothing to signal there's more off
// to the side. The mask-image edge fade gives that affordance without a
// hardcoded scroll-shadow element per page.
export function ScrollableTabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="relative -mx-1">
      <div className="scrollbar-none overflow-x-auto px-1 [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)]">
        <TabsList className={className ?? "w-max min-w-full"}>{children}</TabsList>
      </div>
    </div>
  );
}
