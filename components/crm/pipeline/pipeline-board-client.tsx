"use client";

import * as React from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LayoutList, Kanban, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import type { Opportunity, Pipeline } from "@/lib/types/crm";
import { PipelineColumn } from "@/components/crm/pipeline/pipeline-column";
import { PipelineCard } from "@/components/crm/pipeline/pipeline-card";
import { OpportunityWonDialog } from "@/components/crm/opportunities/opportunity-won-dialog";
import { OpportunityLostDialog } from "@/components/crm/opportunities/opportunity-lost-dialog";
import { formatCurrency } from "@/components/crm/shared/format";
import { useAccountNameLookup } from "@/components/crm/shared/account-select";
import { useIsMobile } from "@/components/shared/use-media-query";
import { cn } from "@/lib/utils";

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
  const [viewMode, setViewMode] = React.useState<"board" | "mobile-summary">("board");
  const isMobile = useIsMobile();
  const accountNameById = useAccountNameLookup();

  // Drag-and-drop reactive states
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [tempOpportunities, setTempOpportunities] = React.useState<Opportunity[]>([]);

  // Phones default to the Summary list
  const userPickedViewRef = React.useRef(false);
  React.useEffect(() => {
    if (isMobile && !userPickedViewRef.current) setViewMode("mobile-summary");
  }, [isMobile]);

  function selectViewMode(mode: "board" | "mobile-summary") {
    userPickedViewRef.current = true;
    setViewMode(mode);
  }

  // Touch and pointer sensors for a physical experience on desktop & mobile
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  const pipelinesQuery = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => apiClient.get<Pipeline[]>("crm/pipelines"),
  });

  const effectivePipelineId =
    pipelineId ??
    pipelinesQuery.data?.find((p) => p.isDefault)?.id ??
    pipelinesQuery.data?.[0]?.id ??
    null;

  const queryKey = ["crm", "opportunities", "pipeline", effectivePipelineId];

  const opportunitiesQuery = useQuery({
    queryKey,
    queryFn: () =>
      apiClient.get<PagedResult<Opportunity>>(
        `crm/opportunities?pipelineId=${effectivePipelineId}&status=OPEN&size=200`
      ),
    enabled: !!effectivePipelineId,
  });

  const opportunities = opportunitiesQuery.data?.content ?? [];

  // Keep local temporary opportunities in sync with fetched query updates
  React.useEffect(() => {
    if (opportunities.length > 0) {
      setTempOpportunities(opportunities);
    }
  }, [opportunities]);

  // Optimistic mutation handling to prevent race conditions during rapid dragging
  const stageMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: number; stageId: number }) =>
      apiClient.post(`crm/opportunities/${id}/stage`, { stageId }),
    onMutate: async ({ id, stageId }) => {
      await qc.cancelQueries({ queryKey });
      const previousData = qc.getQueryData<PagedResult<Opportunity>>(queryKey);

      if (previousData) {
        qc.setQueryData<PagedResult<Opportunity>>(queryKey, {
          ...previousData,
          content: previousData.content.map((opp) =>
            opp.id === id ? { ...opp, stageId } : opp
          ),
        });
      }
      return { previousData };
    },
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        qc.setQueryData(queryKey, context.previousData);
      }
      toast.error(errorMessage(err));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
    onSuccess: () => {
      toast.success("Opportunity stage updated");
    },
  });

  const pipeline = pipelinesQuery.data?.find((p) => p.id === effectivePipelineId);
  const stages = [...(pipeline?.stages ?? [])].sort((a, b) => a.sequence - b.sequence);

  const totalValue = opportunities.reduce(
    (acc, opp) => acc + (opp.expectedRevenue ?? opp.amount ?? 0),
    0
  );

  function handleDragStart(event: any) {
    const id = Number(event.active.id);
    setActiveId(id);
    setTempOpportunities(opportunities);
  }

  function handleDragOver(event: any) {
    const { active, over } = event;
    if (!over) return;
    const activeIdNum = Number(active.id);
    const overIdNum = Number(over.id);

    const targetStage = stages.find((s) => s.id === overIdNum);
    if (targetStage) {
      setTempOpportunities((prev) =>
        prev.map((opp) => (opp.id === activeIdNum ? { ...opp, stageId: overIdNum } : opp))
      );
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) {
      setTempOpportunities(opportunities);
      return;
    }
    const opportunityId = Number(active.id);
    const targetStageId = Number(over.id);
    const opportunity = opportunities.find((o) => o.id === opportunityId);
    if (!opportunity || opportunity.stageId === targetStageId) {
      setTempOpportunities(opportunities);
      return;
    }
    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!targetStage) {
      setTempOpportunities(opportunities);
      return;
    }

    if (targetStage.isWon) {
      setWonTarget(opportunity);
      setTempOpportunities(opportunities);
      return;
    }
    if (targetStage.isLost) {
      setLostTarget(opportunity);
      setTempOpportunities(opportunities);
      return;
    }
    stageMutation.mutate({ id: opportunityId, stageId: targetStageId });
  }

  function handleDragCancel() {
    setActiveId(null);
    setTempOpportunities(opportunities);
  }

  const displayedOpportunities = activeId !== null ? tempOpportunities : opportunities;
  const activeOpportunity = activeId !== null ? opportunities.find((o) => o.id === activeId) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 border-b border-[#e2e2e2] pb-4 dark:border-[#404848] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-semibold text-[#1a1c1c] dark:text-white md:text-2xl">Sales Pipeline</h1>
            <span className="hidden items-center rounded-full border border-[#e2e2e2] px-2.5 py-0.5 text-xs font-semibold text-[#545f73] dark:border-[#404848] dark:text-[#a3cfcf] sm:inline-flex">
              {opportunities.length} Deals ({formatCurrency(totalValue)})
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#545f73] dark:text-[#a3cfcf] md:text-sm">
            Drag & drop deal cards across stages or switch views for quick management.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={effectivePipelineId ? String(effectivePipelineId) : ""}
            onValueChange={(v) => setPipelineId(Number(v))}
          >
            <SelectTrigger className="h-9 w-44 border-[#c0c8c8] bg-white text-xs dark:border-[#717978] dark:bg-[#1a1c1c] sm:w-52 md:text-sm">
              <SelectValue placeholder="Select pipeline" />
            </SelectTrigger>
            <SelectContent>
              {(pipelinesQuery.data ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View Toggles */}
          <div className="flex items-center rounded-xl border border-[#e2e2e2] bg-[#f3f4f3] p-0.5 dark:border-[#404848] dark:bg-[#2f3131]">
            <Button
              type="button"
              size="sm"
              className={cn(
                "h-8 gap-1 rounded-lg px-2.5 text-xs font-semibold shadow-none",
                viewMode === "board"
                  ? "bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90 dark:bg-[#beebeb] dark:text-[#002020]"
                  : "bg-transparent text-[#545f73] hover:bg-white/60 dark:text-[#a3cfcf] dark:hover:bg-white/5"
              )}
              onClick={() => selectViewMode("board")}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>Board</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn(
                "h-8 gap-1 rounded-lg px-2.5 text-xs font-semibold shadow-none sm:hidden",
                viewMode === "mobile-summary"
                  ? "bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90 dark:bg-[#beebeb] dark:text-[#002020]"
                  : "bg-transparent text-[#545f73] hover:bg-white/60 dark:text-[#a3cfcf] dark:hover:bg-white/5"
              )}
              onClick={() => selectViewMode("mobile-summary")}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>Summary</span>
            </Button>
          </div>

          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl border-[#c0c8c8] text-xs text-[#1a1c1c] hover:bg-[#f3f4f3] dark:border-[#717978] dark:text-white dark:hover:bg-[#2f3131]"
            render={<Link href="/crm/opportunities" />}
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">All Opportunities</span>
          </Button>
        </div>
      </div>

      {/* Main Board Canvas */}
      {opportunitiesQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-[#545f73] dark:text-[#a3cfcf]">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading pipeline stages...</span>
        </div>
      ) : viewMode === "board" ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="scrollbar-thin flex snap-x gap-3 overflow-x-auto pb-6 pt-2">
            {stages.map((stage) => (
              <div key={stage.id} className="w-[270px] shrink-0 snap-start sm:w-[300px] xl:w-[320px]">
                <PipelineColumn
                  stage={stage}
                  opportunities={displayedOpportunities.filter((o) => o.stageId === stage.id)}
                  accountNameById={accountNameById}
                  activeId={activeId}
                />
              </div>
            ))}
          </div>

          <DragOverlay
            dropAnimation={{
              duration: 250,
              easing: "cubic-bezier(0.18, 0.89, 0.32, 1.28)", // spring snap back
            }}
          >
            {activeOpportunity ? (
              <PipelineCard
                opportunity={activeOpportunity}
                accountName={activeOpportunity.accountId ? accountNameById.get(activeOpportunity.accountId) : undefined}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Mobile Summary View */
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center rounded-full border border-[#e2e2e2] px-2.5 py-0.5 text-xs font-semibold text-[#545f73] dark:border-[#404848] dark:text-[#a3cfcf] sm:hidden">
            {opportunities.length} Deals ({formatCurrency(totalValue)})
          </span>
          {stages.map((stage) => {
            const stageOpps = opportunities.filter((o) => o.stageId === stage.id);
            const stageTotal = stageOpps.reduce(
              (acc, o) => acc + (o.expectedRevenue ?? o.amount ?? 0),
              0
            );
            const color = stage.color ?? "#0F3D3E";
            return (
              <div key={stage.id} className="overflow-hidden rounded-2xl border border-[#e2e2e2] bg-white shadow-xs dark:border-[#404848] dark:bg-[#1a1c1c]">
                <div className="flex items-center justify-between gap-2 border-b border-[#e2e2e2] bg-[#f9f9f9] px-3.5 py-3 dark:border-[#404848] dark:bg-[#121414]">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="truncate text-sm font-semibold text-[#1a1c1c] dark:text-white">{stage.name}</span>
                    <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#f3f4f3] px-1.5 text-[10px] font-bold text-[#545f73] dark:bg-[#2f3131] dark:text-[#a3cfcf]">
                      {stageOpps.length}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-[#0F3D3E] dark:text-[#beebeb]">
                    {formatCurrency(stageTotal)}
                  </span>
                </div>
                <div className="divide-y divide-[#eeeeed] p-1 dark:divide-[#2f3131]">
                  {stageOpps.length === 0 ? (
                    <div className="py-4 text-center text-xs text-[#717978]">
                      No deals in this stage
                    </div>
                  ) : (
                    stageOpps.map((opp) => (
                      <Link
                          key={opp.id}
                          href={`/crm/opportunities/${opp.id}`}
                          className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2.5 text-xs transition-colors hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131]"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-[#1a1c1c] dark:text-white">{opp.name}</div>
                          <div className="text-[11px] text-[#717978]">
                            {opp.opportunityNumber}
                          </div>
                        </div>
                        <span className="shrink-0 font-semibold text-[#1a1c1c] dark:text-white">
                          {formatCurrency(opp.amount ?? 0)}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {wonTarget && (
        <OpportunityWonDialog
          open
          onOpenChange={(o) => !o && setWonTarget(null)}
          opportunity={wonTarget}
        />
      )}
      {lostTarget && (
        <OpportunityLostDialog
          open
          onOpenChange={(o) => !o && setLostTarget(null)}
          opportunity={lostTarget}
        />
      )}
    </div>
  );
}
