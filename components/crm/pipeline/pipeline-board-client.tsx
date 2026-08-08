"use client";

import * as React from "react";
import Link from "next/link";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LayoutList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import type { Opportunity, Pipeline } from "@/lib/types/crm";
import { PipelineColumn } from "@/components/crm/pipeline/pipeline-column";
import { OpportunityWonDialog } from "@/components/crm/opportunities/opportunity-won-dialog";
import { OpportunityLostDialog } from "@/components/crm/opportunities/opportunity-lost-dialog";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function PipelineBoardClient() {
  const qc = useQueryClient();
  const [pipelineId, setPipelineId] = React.useState<number | null>(null);
  const [wonTarget, setWonTarget] = React.useState<Opportunity | null>(null);
  const [lostTarget, setLostTarget] = React.useState<Opportunity | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const pipelinesQuery = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => apiClient.get<Pipeline[]>("crm/pipelines"),
  });

  // Derived, not synced via effect: falls back to the default (or first)
  // pipeline until the user explicitly picks one.
  const effectivePipelineId = pipelineId
    ?? pipelinesQuery.data?.find((p) => p.isDefault)?.id
    ?? pipelinesQuery.data?.[0]?.id
    ?? null;

  const opportunitiesQuery = useQuery({
    queryKey: ["crm", "opportunities", "pipeline", effectivePipelineId],
    queryFn: () => apiClient.get<PagedResult<Opportunity>>(`crm/opportunities?pipelineId=${effectivePipelineId}&status=OPEN&size=200`),
    enabled: !!effectivePipelineId,
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: number; stageId: number }) => apiClient.post(`crm/opportunities/${id}/stage`, { stageId }),
    onSuccess: () => {
      toast.success("Opportunity moved to new stage.");
      qc.invalidateQueries({ queryKey: ["crm", "opportunities", "pipeline", effectivePipelineId] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const pipeline = pipelinesQuery.data?.find((p) => p.id === effectivePipelineId);
  const opportunities = opportunitiesQuery.data?.content ?? [];
  const stages = [...(pipeline?.stages ?? [])].sort((a, b) => a.sequence - b.sequence);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const opportunityId = Number(active.id);
    const targetStageId = Number(over.id);
    const opportunity = opportunities.find((o) => o.id === opportunityId);
    if (!opportunity || opportunity.stageId === targetStageId) return;
    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    if (targetStage.isWon) { setWonTarget(opportunity); return; }
    if (targetStage.isLost) { setLostTarget(opportunity); return; }
    stageMutation.mutate({ id: opportunityId, stageId: targetStageId });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground">Drag deals between stages as they progress.</p>
        </div>
        <div className="flex gap-2">
          <Select items={Object.fromEntries((pipelinesQuery.data ?? []).map((p) => [String(p.id), p.name]))} value={effectivePipelineId ? String(effectivePipelineId) : ""} onValueChange={(v) => setPipelineId(Number(v))}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Select pipeline" /></SelectTrigger>
            <SelectContent>
              {(pipelinesQuery.data ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button nativeButton={false} variant="outline" className="gap-1.5" render={<Link href="/crm/opportunities" />}>
            <LayoutList className="size-4" /> List View
          </Button>
        </div>
      </div>

      {opportunitiesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading pipeline...</p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {stages.map((stage) => (
              <PipelineColumn key={stage.id} stage={stage} opportunities={opportunities.filter((o) => o.stageId === stage.id)} />
            ))}
          </div>
        </DndContext>
      )}

      {wonTarget && <OpportunityWonDialog open onOpenChange={(o) => !o && setWonTarget(null)} opportunity={wonTarget} />}
      {lostTarget && <OpportunityLostDialog open onOpenChange={(o) => !o && setLostTarget(null)} opportunity={lostTarget} />}
    </div>
  );
}
