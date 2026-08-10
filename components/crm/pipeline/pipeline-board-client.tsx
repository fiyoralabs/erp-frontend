"use client";

import * as React from "react";
import Link from "next/link";
import {
  DndContext,
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
import { OpportunityWonDialog } from "@/components/crm/opportunities/opportunity-won-dialog";
import { OpportunityLostDialog } from "@/components/crm/opportunities/opportunity-lost-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/components/crm/shared/format";
import { useAccountNameLookup } from "@/components/crm/shared/account-select";
import { useIsMobile } from "@/components/shared/use-media-query";

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

  // Phones default to the Summary list -- the horizontal-scroll board is
  // the better experience on tablet/desktop but easy to get lost in on a
  // narrow screen. Only apply the default once; once the user has picked a
  // view explicitly, respect it even if the viewport crosses the boundary.
  const userPickedViewRef = React.useRef(false);
  React.useEffect(() => {
    if (isMobile && !userPickedViewRef.current) setViewMode("mobile-summary");
  }, [isMobile]);

  function selectViewMode(mode: "board" | "mobile-summary") {
    userPickedViewRef.current = true;
    setViewMode(mode);
  }

  // Configured sensors for both pointer/mouse and touch screens
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
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
  const opportunities = opportunitiesQuery.data?.content ?? [];
  const stages = [...(pipeline?.stages ?? [])].sort((a, b) => a.sequence - b.sequence);

  const totalValue = opportunities.reduce(
    (acc, opp) => acc + (opp.expectedRevenue ?? opp.amount ?? 0),
    0
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const opportunityId = Number(active.id);
    const targetStageId = Number(over.id);
    const opportunity = opportunities.find((o) => o.id === opportunityId);
    if (!opportunity || opportunity.stageId === targetStageId) return;
    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    if (targetStage.isWon) {
      setWonTarget(opportunity);
      return;
    }
    if (targetStage.isLost) {
      setLostTarget(opportunity);
      return;
    }
    stageMutation.mutate({ id: opportunityId, stageId: targetStageId });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold sm:text-2xl">Sales Pipeline</h1>
            <Badge variant="outline" className="hidden sm:inline-flex">
              {opportunities.length} Deals ({formatCurrency(totalValue)})
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Drag & drop deal cards across stages or switch views for quick management.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={effectivePipelineId ? String(effectivePipelineId) : ""}
            onValueChange={(v) => setPipelineId(Number(v))}
          >
            <SelectTrigger className="w-44 sm:w-52 h-9 text-xs sm:text-sm">
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
          <div className="flex items-center rounded-lg border bg-muted p-0.5">
            <Button
              type="button"
              variant={viewMode === "board" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs gap-1"
              onClick={() => selectViewMode("board")}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>Board</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "mobile-summary" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs gap-1 sm:hidden"
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
            className="h-9 gap-1.5 text-xs"
            render={<Link href="/crm/opportunities" />}
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">All Opportunities</span>
          </Button>
        </div>
      </div>

      {/* Main Board Canvas */}
      {opportunitiesQuery.isLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading pipeline stages...</span>
        </div>
      ) : viewMode === "board" ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-6 pt-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 snap-x">
            {stages.map((stage) => (
              <div key={stage.id} className="snap-start shrink-0 w-[280px] sm:w-[320px]">
                <PipelineColumn
                  stage={stage}
                  opportunities={opportunities.filter((o) => o.stageId === stage.id)}
                  accountNameById={accountNameById}
                />
              </div>
            ))}
          </div>
        </DndContext>
      ) : (
        /* Mobile Summary View for fast overview on small screens */
        <div className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit sm:hidden">
            {opportunities.length} Deals ({formatCurrency(totalValue)})
          </Badge>
          {stages.map((stage) => {
            const stageOpps = opportunities.filter((o) => o.stageId === stage.id);
            const stageTotal = stageOpps.reduce(
              (acc, o) => acc + (o.expectedRevenue ?? o.amount ?? 0),
              0
            );
            return (
              <Card key={stage.id} className="overflow-hidden border">
                <CardHeader className="p-3 bg-muted/40 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {stage.name}
                    <Badge variant="secondary" className="text-xs">
                      {stageOpps.length}
                    </Badge>
                  </CardTitle>
                  <span className="text-xs font-bold text-primary">
                    {formatCurrency(stageTotal)}
                  </span>
                </CardHeader>
                <CardContent className="p-3 divide-y">
                  {stageOpps.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-2 text-center">
                      No deals in this stage
                    </div>
                  ) : (
                    stageOpps.map((opp) => (
                      <Link
                        key={opp.id}
                        href={`/crm/opportunities/${opp.id}`}
                        className="py-2.5 flex items-center justify-between text-xs hover:bg-accent/50 rounded px-1 transition-colors block"
                      >
                        <div>
                          <div className="font-medium text-foreground">{opp.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {opp.opportunityNumber}
                          </div>
                        </div>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(opp.amount ?? 0)}
                        </span>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
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
