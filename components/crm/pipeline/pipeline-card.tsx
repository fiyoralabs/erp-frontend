"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import type { Opportunity } from "@/lib/types/crm";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";

export function PipelineCard({ opportunity }: { opportunity: Opportunity }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opportunity.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none select-none active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
    >
      <CardContent className="flex flex-col gap-1.5 p-3">
        <Link href={`/crm/opportunities/${opportunity.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-primary hover:underline">
          {opportunity.name}
        </Link>
        <p className="text-xs text-muted-foreground">Account #{opportunity.accountId}</p>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">{formatCurrency(opportunity.amount)}</span>
          <span className="text-muted-foreground">{opportunity.probability}%</span>
        </div>
        <p className="text-xs text-muted-foreground">Close: {formatDate(opportunity.expectedCloseDate)}</p>
      </CardContent>
    </Card>
  );
}
