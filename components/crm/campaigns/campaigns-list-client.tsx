"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import type { Campaign } from "@/lib/types/crm";
import { CampaignDialog } from "@/components/crm/campaigns/campaign-dialog";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function CampaignsListClient() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [dialogState, setDialogState] = React.useState<{ mode: "create" } | { mode: "edit"; row: Campaign } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Campaign | null>(null);

  const listQuery = useQuery({
    queryKey: ["crm", "campaigns", page],
    queryFn: () => apiClient.get<PagedResult<Campaign>>(`crm/campaigns?page=${page}&size=20`),
  });

  // crm/campaigns has no server-side search param (confirmed against
  // CampaignController -- only page/size) -- this filters within the
  // currently loaded page rather than pretending to search the full list.
  const visibleRows = React.useMemo(() => {
    const rows = listQuery.data?.content ?? [];
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [listQuery.data, search]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`crm/campaigns/${id}`),
    onSuccess: () => {
      toast.success("Campaign deleted.");
      qc.invalidateQueries({ queryKey: ["crm", "campaigns"] });
      setDeleteTarget(null);
    },
    onError: (err) => { toast.error(errorMessage(err)); setDeleteTarget(null); },
  });

  const columns: DataTableColumn<Campaign>[] = [
    { key: "name", header: "Campaign", render: (r) => <Link href={`/crm/campaigns/${r.id}`} className="font-medium text-primary hover:underline">{r.name}</Link> },
    { key: "type", header: "Type", render: (r) => r.type.replaceAll("_", " ") },
    { key: "status", header: "Status", render: (r) => <Badge variant="outline">{r.status}</Badge> },
    { key: "budget", header: "Budget", render: (r) => formatCurrency(r.budget), hideOnCard: true },
    { key: "dates", header: "Dates", render: (r) => `${formatDate(r.startDate)} - ${formatDate(r.endDate)}`, hideOnCard: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Marketing campaigns and their CRM impact.</p>
        </div>
        <Button className="h-11 gap-1.5 sm:h-8" onClick={() => setDialogState({ mode: "create" })}>
          <Plus className="size-4" /> New Campaign
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Filter campaigns on this page..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <DataTable
        columns={columns}
        data={visibleRows}
        rowKey={(r) => r.id}
        isLoading={listQuery.isLoading}
        emptyMessage="No campaigns yet."
        page={page}
        totalPages={listQuery.data?.totalPages}
        onPageChange={setPage}
        actions={(row) => (
          <>
            <Button nativeButton={false} variant="ghost" size="sm" render={<Link href={`/crm/campaigns/${row.id}`} />}>View</Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setDialogState({ mode: "edit", row })} aria-label="Edit campaign">
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteTarget(row)} aria-label="Delete campaign">
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      />

      <CampaignDialog open={dialogState !== null} onOpenChange={(o) => !o && setDialogState(null)} campaign={dialogState?.mode === "edit" ? dialogState.row : undefined} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete campaign?"
        description={`This will permanently delete "${deleteTarget?.name}".`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
