import * as React from "react";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<NonNullable<StatTileProps["tone"]>, { iconBg: string; text: string; cardBg?: string; border?: string }> = {
  default: {
    iconBg: "bg-[#0F3D3E]/10 text-[#0F3D3E] dark:bg-[#a3cfcf]/15 dark:text-[#a3cfcf]",
    text: "text-[#1a1c1c] dark:text-white",
  },
  success: {
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  warning: {
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    text: "text-amber-800 dark:text-amber-300",
  },
  danger: {
    iconBg: "bg-[#ba1a1a]/10 text-[#ba1a1a]",
    text: "text-[#ba1a1a]",
    cardBg: "bg-[#ffdad6]/20 border-[#ffdad6]",
    border: "border-[#ffdad6]",
  },
};

export interface StatTileProps {
  label: string;
  value: string;
  icon?: React.ElementType;
  tone?: "default" | "success" | "warning" | "danger";
  variant?: "card" | "inline";
  className?: string;
  badge?: React.ReactNode;
}

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
  variant = "card",
  className,
  badge,
}: StatTileProps) {
  const toneStyle = TONE_CLASSES[tone];

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        {Icon && (
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", toneStyle.iconBg)}>
            <Icon className="size-4.5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[#545f73] dark:text-[#a3cfcf]">{label}</p>
          <p className={cn("text-xl font-bold tracking-tight sm:text-2xl", toneStyle.text)}>{value}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-white dark:bg-[#1a1c1c] border border-[#e2e2e2] dark:border-[#404848] rounded-[18px] p-5 shadow-xs hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all duration-200 flex flex-col justify-between min-h-[96px]",
        toneStyle.cardBg,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-[#545f73] dark:text-[#a3cfcf] truncate">
          {label}
        </p>
        {badge || (Icon && (
          <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", toneStyle.iconBg)}>
            <Icon className="size-3.5" />
          </div>
        ))}
      </div>
      <h3 className={cn("text-2xl font-bold tracking-tight", toneStyle.text)}>
        {value}
      </h3>
    </div>
  );
}
