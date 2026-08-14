"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Building2, CalendarClock, GripVertical } from "lucide-react";
import type { Opportunity } from "@/lib/types/crm";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";
import { cn } from "@/lib/utils";

function probabilityTone(probability: number) {
  if (probability >= 70) return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30";
  if (probability >= 40) return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30";
  return "bg-[#f3f4f3] text-[#545f73] border-[#e2e2e2] dark:bg-[#2f3131] dark:text-[#a3cfcf] dark:border-[#404848]";
}

export function PipelineCard({ opportunity, accountName }: { opportunity: Opportunity; accountName?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opportunity.id });
  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 20 : undefined }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative flex touch-none select-none flex-col gap-2 rounded-xl border border-[#e2e2e2] bg-white p-3 shadow-xs transition-all",
        "hover:border-[#0F3D3E]/30 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        "dark:border-[#404848] dark:bg-[#1a1c1c] dark:hover:border-[#a3cfcf]/40",
        isDragging ? "cursor-grabbing opacity-60 shadow-lg rotate-1" : "cursor-grab"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/crm/opportunities/${opportunity.id}`}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 truncate text-sm font-semibold text-[#1a1c1c] hover:text-[#0F3D3E] hover:underline dark:text-white dark:hover:text-[#a3cfcf]"
        >
          {opportunity.name}
        </Link>
        <GripVertical className="h-4 w-4 shrink-0 text-[#c0c8c8] opacity-0 transition-opacity group-hover:opacity-100 dark:text-[#545f73]" />
      </div>

      <p className="flex min-w-0 items-center gap-1.5 text-xs text-[#545f73] dark:text-[#a3cfcf]">
        <Building2 className="h-3 w-3 shrink-0" />
        <span className="truncate">{accountName ?? (opportunity.accountId ? `Account #${opportunity.accountId}` : "No account")}</span>
      </p>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-sm font-bold text-[#0F3D3E] dark:text-[#beebeb]">{formatCurrency(opportunity.amount)}</span>
        <span className={cn("inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold", probabilityTone(opportunity.probability))}>
          {opportunity.probability}%
        </span>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-[#717978] dark:text-[#717978]">
        <CalendarClock className="h-3 w-3 shrink-0" />
        Close: {formatDate(opportunity.expectedCloseDate)}
      </p>
    </div>
  );
}
