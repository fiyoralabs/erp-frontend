"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Parent re-mounts this component with a `key` tied to from/to (see
// dashboard/page.tsx) so local state resets on navigation instead of going
// stale after back/forward or re-applying the same URL.
export function DateRangePicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [fromValue, setFromValue] = React.useState(from);
  const [toValue, setToValue] = React.useState(to);

  const apply = () => {
    const params = new URLSearchParams({ from: fromValue, to: toValue });
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="dashboard-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="dashboard-from"
          type="date"
          value={fromValue}
          max={toValue}
          onChange={(e) => setFromValue(e.target.value)}
          className="h-9 w-full sm:w-36"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dashboard-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="dashboard-to"
          type="date"
          value={toValue}
          min={fromValue}
          onChange={(e) => setToValue(e.target.value)}
          className="h-9 w-full sm:w-36"
        />
      </div>
      <Button size="sm" onClick={apply} className="w-full sm:w-auto">
        Apply
      </Button>
    </div>
  );
}
