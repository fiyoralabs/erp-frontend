"use client";

import { useDroppable } from "@dnd-kit/core";
import { Inbox } from "lucide-react";
import type { Opportunity, PipelineStage } from "@/lib/types/crm";
import { PipelineCard } from "@/components/crm/pipeline/pipeline-card";
import { formatCurrency } from "@/components/crm/shared/format";
import { cn } from "@/lib/utils";

export function PipelineColumn({
  stage,
  opportunities,
  accountNameById,
  activeId,
}: {
  stage: PipelineStage;
  opportunities: Opportunity[];
  accountNameById?: Map<number, string>;
  activeId?: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const totalValue = opportunities.reduce((sum, o) => sum + o.amount, 0);
  const weightedValue = opportunities.reduce((sum, o) => sum + o.expectedRevenue, 0);
  const color = stage.color ?? "#0F3D3E";

  return (
    <div className="flex h-full w-full shrink-0 flex-col rounded-2xl border border-[#e2e2e2] bg-[#f9f9f9] shadow-xs dark:border-[#404848] dark:bg-[#121414]">
      {/* Column Header */}
      <div className="shrink-0 rounded-t-2xl border-b border-[#e2e2e2] bg-white px-3.5 py-3 dark:border-[#404848] dark:bg-[#1a1c1c]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <p className="truncate text-sm font-semibold text-[#1a1c1c] dark:text-white">{stage.name}</p>
          <span className="ml-auto inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#f3f4f3] px-1.5 text-[10px] font-bold text-[#545f73] dark:bg-[#2f3131] dark:text-[#a3cfcf]">
            {opportunities.length}
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="text-sm font-bold text-[#1a1c1c] dark:text-white">{formatCurrency(totalValue)}</span>
          <span className="text-[11px] text-[#717978]">Weighted {formatCurrency(weightedValue)}</span>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        style={{ height: "calc(100vh - 340px)" }}
        className={cn(
          "flex min-h-[220px] flex-col gap-2 overflow-y-auto p-2.5 transition-all duration-200",
          isOver && "bg-[#0F3D3E]/5 dark:bg-[#beebeb]/5 ring-2 ring-inset ring-[#0F3D3E]/20 dark:ring-[#beebeb]/20 rounded-b-2xl"
        )}
      >
        {opportunities.map((o) => (
          <PipelineCard
            key={o.id}
            opportunity={o}
            accountName={o.accountId ? accountNameById?.get(o.accountId) : undefined}
            isPlaceholder={activeId === o.id}
          />
        ))}
        {opportunities.length === 0 && (
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 text-center transition-colors",
              isOver ? "border-[#0F3D3E] dark:border-[#beebeb]" : "border-[#e2e2e2] dark:border-[#404848]"
            )}
          >
            <Inbox className="h-5 w-5 text-[#c0c8c8] dark:text-[#545f73]" />
            <p className="text-xs text-[#717978]">No deals yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
