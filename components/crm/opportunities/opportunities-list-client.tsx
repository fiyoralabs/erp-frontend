"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, LayoutList, KanbanSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { Opportunity } from "@/lib/types/crm";
import { OpportunityStatusBadge } from "@/components/crm/shared/status-badges";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";
import { OpportunityDialog } from "@/components/crm/opportunities/opportunity-dialog";

export function OpportunitiesListClient() {
  const [page, setPage] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);

  const listQuery = useQuery({
    queryKey: ["crm", "opportunities", "list", page],
    queryFn: () => apiClient.get<PagedResult<Opportunity>>(`crm/opportunities?page=${page}&size=20`),
  });

  const columns: DataTableColumn<Opportunity>[] = [
    { key: "name", header: "Opportunity", render: (r) => <Link href={`/crm/opportunities/${r.id}`} className="font-medium text-primary hover:underline">{r.name}</Link> },
    { key: "account", header: "Account", render: (r) => <Link href={`/crm/accounts/${r.accountId}`} className="text-primary hover:underline">#{r.accountId}</Link> },
    { key: "value", header: "Value", render: (r) => formatCurrency(r.amount) },
    { key: "probability", header: "Probability", render: (r) => `${r.probability}%`, hideOnCard: true },
    { key: "expectedRevenue", header: "Expected Revenue", render: (r) => formatCurrency(r.expectedRevenue), hideOnCard: true },
    { key: "closeDate", header: "Expected Close", render: (r) => formatDate(r.expectedCloseDate), hideOnCard: true },
    { key: "status", header: "Status", render: (r) => <OpportunityStatusBadge status={r.status} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Opportunities</h1>
          <p className="text-sm text-muted-foreground">Deals in progress across your pipelines.</p>
        </div>
        <div className="flex gap-2">
          <Button nativeButton={false} variant="outline" className="h-11 gap-1.5 sm:h-8" render={<Link href="/crm/pipeline" />}>
            <KanbanSquare className="size-4" /> Pipeline View
          </Button>
          <Button className="h-11 gap-1.5 sm:h-8" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New Opportunity
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={listQuery.data?.content ?? []}
        rowKey={(r) => r.id}
        isLoading={listQuery.isLoading}
        emptyMessage="No opportunities yet. Convert a lead or create one directly for an existing customer."
        page={page}
        totalPages={listQuery.data?.totalPages}
        onPageChange={setPage}
        actions={(row) => (
          <Button nativeButton={false} variant="ghost" size="sm" render={<Link href={`/crm/opportunities/${row.id}`} />}>
            <LayoutList className="size-4" /> View
          </Button>
        )}
      />

      <OpportunityDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
