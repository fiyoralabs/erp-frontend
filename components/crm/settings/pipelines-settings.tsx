"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { Pipeline, PipelineStage } from "@/lib/types/crm";
import { PipelineDialog } from "@/components/crm/settings/pipeline-dialog";
import { PipelineStageDialog } from "@/components/crm/settings/pipeline-stage-dialog";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function PipelinesSettings() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [stageDialog, setStageDialog] = React.useState<{ pipelineId: number; stage?: PipelineStage; nextSequence: number } | null>(null);
  const [deleteStageTarget, setDeleteStageTarget] = React.useState<{ pipelineId: number; stage: PipelineStage } | null>(null);

  const listQuery = useQuery({ queryKey: ["crm", "pipelines"], queryFn: () => apiClient.get<Pipeline[]>("crm/pipelines") });

  const deleteStageMutation = useMutation({
    mutationFn: ({ pipelineId, stageId }: { pipelineId: number; stageId: number }) => apiClient.delete(`crm/pipelines/${pipelineId}/stages/${stageId}`),
    onSuccess: () => {
      toast.success("Stage deleted.");
      qc.invalidateQueries({ queryKey: ["crm", "pipelines"] });
      setDeleteStageTarget(null);
    },
    onError: (err) => { toast.error(errorMessage(err)); setDeleteStageTarget(null); },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New Pipeline
        </Button>
      </div>

      {(listQuery.data ?? []).map((pipeline) => (
        <Card key={pipeline.id}>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              {pipeline.name}
              {pipeline.isDefault && <Badge variant="secondary">Default</Badge>}
              {!pipeline.active && <Badge variant="outline">Inactive</Badge>}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="w-fit gap-1.5"
              onClick={() => setStageDialog({ pipelineId: pipeline.id, nextSequence: (pipeline.stages.at(-1)?.sequence ?? 0) + 1 })}
            >
              <Plus className="size-4" /> Add Stage
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-1.5">
              {[...pipeline.stages].sort((a, b) => a.sequence - b.sequence).map((stage, i, arr) => (
                <React.Fragment key={stage.id}>
                  <div className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-sm" style={{ borderLeft: `3px solid ${stage.color ?? "#94a3b8"}` }}>
                    <span>{stage.name}</span>
                    <span className="text-xs text-muted-foreground">({stage.probability}%)</span>
                    {stage.isWon && <Badge variant="outline" className="text-emerald-600">Won</Badge>}
                    {stage.isLost && <Badge variant="outline" className="text-red-600">Lost</Badge>}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setStageDialog({ pipelineId: pipeline.id, stage, nextSequence: stage.sequence })}
                      aria-label={`Edit ${stage.name}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteStageTarget({ pipelineId: pipeline.id, stage })}
                      aria-label={`Delete ${stage.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {i < arr.length - 1 && <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />}
                </React.Fragment>
              ))}
              {pipeline.stages.length === 0 && <p className="text-sm text-muted-foreground">No stages configured yet.</p>}
            </div>
          </CardContent>
        </Card>
      ))}
      {listQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No pipelines configured yet.</p>}

      <PipelineDialog open={createOpen} onOpenChange={setCreateOpen} />
      {stageDialog && (
        <PipelineStageDialog
          open
          onOpenChange={(o) => !o && setStageDialog(null)}
          pipelineId={stageDialog.pipelineId}
          stage={stageDialog.stage}
          nextSequence={stageDialog.nextSequence}
        />
      )}
      <ConfirmDialog
        open={deleteStageTarget !== null}
        onOpenChange={(o) => !o && setDeleteStageTarget(null)}
        title="Delete stage?"
        description={`This will delete "${deleteStageTarget?.stage.name}". Stages currently used by opportunities cannot be deleted.`}
        confirmLabel="Delete"
        onConfirm={() => deleteStageTarget && deleteStageMutation.mutate({ pipelineId: deleteStageTarget.pipelineId, stageId: deleteStageTarget.stage.id })}
        isPending={deleteStageMutation.isPending}
      />
    </div>
  );
}
