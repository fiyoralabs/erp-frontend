"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { CrmTask } from "@/lib/types/crm";
import { CrmTaskStatusBadge } from "@/components/crm/shared/status-badges";
import { formatDate } from "@/components/crm/shared/format";
import { useUserNameLookup } from "@/components/crm/shared/user-select";
import { TaskDialog } from "@/components/crm/tasks/task-dialog";

const VIEWS = [
  { value: "MY", label: "My Tasks" },
  { value: "ALL", label: "All Tasks" },
  { value: "TODAY", label: "Today" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "COMPLETED", label: "Completed" },
];

export function TasksListClient() {
  const qc = useQueryClient();
  const [view, setView] = React.useState("MY");
  const [page, setPage] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const query = useQuery({
    queryKey: ["crm", "tasks", "list", view, page],
    queryFn: () => apiClient.get<PagedResult<CrmTask>>(`crm/tasks?view=${view}&page=${page}&size=20`),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`crm/tasks/${id}/complete`),
    onSuccess: () => {
      toast.success("Task completed.");
      qc.invalidateQueries({ queryKey: ["crm", "tasks"] });
    },
  });

  const userNameById = useUserNameLookup();

  const columns: DataTableColumn<CrmTask>[] = [
    { key: "title", header: "Title", render: (r) => r.title },
    { key: "related", header: "Related To", render: (r) => (r.relatedType ? `${r.relatedType} #${r.relatedId}` : "—") },
    { key: "assigned", header: "Assigned To", render: (r) => (r.assignedUserId ? userNameById.get(r.assignedUserId) ?? `User #${r.assignedUserId}` : "Unassigned") },
    { key: "priority", header: "Priority", render: (r) => r.priority },
    { key: "due", header: "Due", render: (r) => formatDate(r.dueDate) },
    { key: "status", header: "Status", render: (r) => <CrmTaskStatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Tasks</h1>
          <p className="text-sm text-muted-foreground">Your to-dos across leads, accounts and opportunities.</p>
        </div>
        <Button className="h-11 gap-1.5 sm:h-8" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> Add Task
        </Button>
      </div>
      <Tabs value={view} onValueChange={(v) => { setView(v); setPage(0); }}>
        <TabsList>
          {VIEWS.map((v) => <TabsTrigger key={v.value} value={v.value}>{v.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <DataTable
        columns={columns}
        data={query.data?.content ?? []}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        emptyMessage="No tasks in this view."
        page={page}
        totalPages={query.data?.totalPages}
        onPageChange={setPage}
        actions={(row) => row.status !== "COMPLETED" ? (
          <Button variant="ghost" size="icon" className="size-8" onClick={() => completeMutation.mutate(row.id)} aria-label="Mark complete">
            <CheckCircle2 className="size-4" />
          </Button>
        ) : null}
      />
      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
