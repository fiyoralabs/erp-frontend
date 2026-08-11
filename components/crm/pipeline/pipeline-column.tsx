"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Opportunity, PipelineStage } from "@/lib/types/crm";
import { PipelineCard } from "@/components/crm/pipeline/pipeline-card";
import { formatCurrency } from "@/components/crm/shared/format";

export function PipelineColumn({
  stage, opportunities, accountNameById,
}: {
  stage: PipelineStage;
  opportunities: Opportunity[];
  accountNameById?: Map<number, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const totalValue = opportunities.reduce((sum, o) => sum + o.amount, 0);
  const weightedValue = opportunities.reduce((sum, o) => sum + o.expectedRevenue, 0);

  return (
    <div className="flex h-full w-full shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between rounded-t-md bg-muted/40 px-2.5 py-2" style={{ borderTop: `3px solid ${stage.color ?? "#94a3b8"}` }}>
        <div>
          <p className="text-sm font-semibold">{stage.name}</p>
          <p className="text-xs text-foreground/80">{opportunities.length} deals · <span className="font-medium">{formatCurrency(totalValue)}</span></p>
          <p className="text-xs text-muted-foreground">Weighted: {formatCurrency(weightedValue)}</p>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-40 flex-col gap-2 rounded-md border p-2 transition-colors ${isOver ? "border-primary bg-primary/5" : "border-transparent bg-muted/40"}`}
      >
        {opportunities.map((o) => <PipelineCard key={o.id} opportunity={o} accountName={o.accountId ? accountNameById?.get(o.accountId) : undefined} />)}
        {opportunities.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No deals</p>}
      </div>
    </div>
  );
}
