import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Shared stat display used on the Dashboard, Reports, and every detail
// page's header stat row -- previously each screen hand-rolled its own
// near-identical label/value block. Tone colors match the same
// success/warning/danger scale used in status-badges.tsx so a "danger" tile
// and a "LOST" badge read as the same color language.
const TONE_CLASSES: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
};

interface StatTileProps {
  label: string;
  value: string;
  icon?: React.ElementType;
  tone?: "default" | "success" | "warning" | "danger";
  /** "card": standalone elevated tile (Dashboard/Reports grids).
   *  "inline": no card chrome, for embedding inside an existing Card
   *  (detail-page header stat rows). */
  variant?: "card" | "inline";
  className?: string;
}

function StatTileBody({ label, value, icon: Icon, tone = "default" }: StatTileProps) {
  return (
    <div className="flex items-center gap-3">
      {Icon && (
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE_CLASSES[tone])}>
          <Icon className="size-4.5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold leading-tight sm:text-2xl">{value}</p>
      </div>
    </div>
  );
}

export function StatTile({ variant = "card", className, ...props }: StatTileProps) {
  if (variant === "inline") {
    return (
      <div className={className}>
        <StatTileBody {...props} />
      </div>
    );
  }
  return (
    <Card className={className}>
      <CardContent>
        <StatTileBody {...props} />
      </CardContent>
    </Card>
  );
}
