"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { CrmTask, RelatedEntityType } from "@/lib/types/crm";
import { TaskDialog } from "@/components/crm/tasks/task-dialog";
import { CrmTaskStatusBadge } from "@/components/crm/shared/status-badges";
import { formatDate } from "@/components/crm/shared/format";
import { useUserNameLookup } from "@/components/crm/shared/user-select";

export function TasksTab({ relatedType, relatedId }: { relatedType: RelatedEntityType; relatedId: number }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const query = useQuery({
    queryKey: ["crm", "tasks", "by-related", relatedType, relatedId],
    queryFn: () => apiClient.get<CrmTask[]>(`crm/tasks/by-related/${relatedType}/${relatedId}`),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`crm/tasks/${id}/complete`),
    onSuccess: () => {
      toast.success("Task completed.");
      qc.invalidateQueries({ queryKey: ["crm", "tasks", "by-related", relatedType, relatedId] });
    },
  });

  const tasks = query.data ?? [];
  const userNameById = useUserNameLookup();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> Add Task
        </Button>
      </div>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : tasks.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No tasks yet.</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(t.dueDate)} · {t.priority}
                    {t.assignedUserId && <> · {userNameById.get(t.assignedUserId) ?? `User #${t.assignedUserId}`}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CrmTaskStatusBadge status={t.status} />
                  {t.status !== "COMPLETED" && (
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => completeMutation.mutate(t.id)} aria-label="Mark complete">
                      <CheckCircle2 className="size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} relatedType={relatedType} relatedId={relatedId} />
    </div>
  );
}
