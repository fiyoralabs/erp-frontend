"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, LayoutList, KanbanSquare, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { FiltersButton, FiltersPanel, FilterField } from "@/components/crm/shared/filters-panel";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { Opportunity, OpportunityStatus, Pipeline } from "@/lib/types/crm";
import { OpportunityStatusBadge } from "@/components/crm/shared/status-badges";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";
import { OpportunityDialog } from "@/components/crm/opportunities/opportunity-dialog";
import { useCrmUsers } from "@/components/crm/shared/user-select";
import { useCrmAccounts } from "@/components/crm/shared/account-select";

const STATUS_OPTIONS: OpportunityStatus[] = ["OPEN", "WON", "LOST"];
const SORT_OPTIONS = [
  { value: "createdAt,desc", label: "Newest first" },
  { value: "createdAt,asc", label: "Oldest first" },
  { value: "expectedCloseDate,asc", label: "Closing soonest" },
  { value: "expectedCloseDate,desc", label: "Closing latest" },
  { value: "amount,desc", label: "Value: high to low" },
  { value: "amount,asc", label: "Value: low to high" },
];

function useDebounced<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function OpportunitiesListClient() {
  const router = useRouter();
  const pathname = usePathname();
  // Read once on mount so dashboard links like /crm/opportunities?status=WON
  // land pre-filtered, and so coming back from a deal's detail page restores
  // exactly what was applied (see the URL-sync effect below).
  const initialParams = useSearchParams();
  const [page, setPage] = React.useState(() => Number(initialParams.get("page") ?? 0));
  const [search, setSearch] = React.useState(() => initialParams.get("search") ?? "");
  const [status, setStatus] = React.useState<string>(() => initialParams.get("status") ?? "");
  const [sort, setSort] = React.useState(() => initialParams.get("sort") ?? "createdAt,desc");
  const [pipelineId, setPipelineId] = React.useState<string>(() => initialParams.get("pipelineId") ?? "");
  const [stageId, setStageId] = React.useState<string>(() => initialParams.get("stageId") ?? "");
  const [assignedUserId, setAssignedUserId] = React.useState<string>(() => initialParams.get("assignedUserId") ?? "");
  const [accountId, setAccountId] = React.useState<string>(() => initialParams.get("accountId") ?? "");
  const [closeFrom, setCloseFrom] = React.useState(() => initialParams.get("expectedCloseFrom") ?? "");
  const [closeTo, setCloseTo] = React.useState(() => initialParams.get("expectedCloseTo") ?? "");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const debouncedSearch = useDebounced(search);

  const pipelinesQuery = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => apiClient.get<Pipeline[]>("crm/pipelines"),
  });
  const usersQuery = useCrmUsers();
  const accountsQuery = useCrmAccounts();

  const stages = React.useMemo(() => {
    if (!pipelineId) return [];
    return pipelinesQuery.data?.find((p) => String(p.id) === pipelineId)?.stages ?? [];
  }, [pipelinesQuery.data, pipelineId]);

  const params = new URLSearchParams({ page: String(page), size: "20", sort });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (status) params.set("status", status);
  if (pipelineId) params.set("pipelineId", pipelineId);
  if (stageId) params.set("stageId", stageId);
  if (assignedUserId) params.set("assignedUserId", assignedUserId);
  if (accountId) params.set("accountId", accountId);
  if (closeFrom) params.set("expectedCloseFrom", closeFrom);
  if (closeTo) params.set("expectedCloseTo", closeTo);

  const listQuery = useQuery({
    queryKey: ["crm", "opportunities", "list", page, sort, debouncedSearch, status, pipelineId, stageId, assignedUserId, accountId, closeFrom, closeTo],
    queryFn: () => apiClient.get<PagedResult<Opportunity>>(`crm/opportunities?${params.toString()}`),
  });

  // Keep the URL in sync with the active filters (via replace, so this
  // doesn't spam browser history) -- that way navigating into a deal and
  // hitting Back returns to this exact filtered/paged view instead of a
  // blank list.
  React.useEffect(() => {
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, debouncedSearch, status, pipelineId, stageId, assignedUserId, accountId, closeFrom, closeTo]);

  const accountNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    (accountsQuery.data ?? []).forEach((a) => map.set(a.id, a.name));
    return map;
  }, [accountsQuery.data]);

  const activeAdvancedFilterCount = [pipelineId, stageId, assignedUserId, accountId, closeFrom, closeTo].filter(Boolean).length;

  function clearAdvancedFilters() {
    setPipelineId("");
    setStageId("");
    setAssignedUserId("");
    setAccountId("");
    setCloseFrom("");
    setCloseTo("");
    setPage(0);
  }

  const columns: DataTableColumn<Opportunity>[] = [
    { key: "name", header: "Opportunity", render: (r) => <Link href={`/crm/opportunities/${r.id}`} className="font-medium text-primary hover:underline">{r.name}</Link> },
    { key: "account", header: "Account", render: (r) => <Link href={`/crm/accounts/${r.accountId}`} className="text-primary hover:underline">{accountNameById.get(r.accountId) ?? `#${r.accountId}`}</Link> },
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

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search opportunities..."
            className="pl-8"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            items={{ "": "All Statuses", ...Object.fromEntries(STATUS_OPTIONS.map((s) => [s, s])) }}
            value={status}
            onValueChange={(v) => { setStatus(v ?? ""); setPage(0); }}
          >
            <SelectTrigger className="h-10 w-full sm:w-36">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            items={Object.fromEntries(SORT_OPTIONS.map((s) => [s.value, s.label]))}
            value={sort}
            onValueChange={(v) => { setSort(v ?? "createdAt,desc"); setPage(0); }}
          >
            <SelectTrigger className="h-10 w-full sm:w-44">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <FiltersButton activeCount={activeAdvancedFilterCount} onClick={() => setFiltersOpen(true)} />
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

      <FiltersPanel open={filtersOpen} onOpenChange={setFiltersOpen} activeCount={activeAdvancedFilterCount} onClearAll={clearAdvancedFilters}>
        <FilterField label="Pipeline">
          <Select
            items={{ "": "All Pipelines", ...Object.fromEntries((pipelinesQuery.data ?? []).map((p) => [String(p.id), p.name])) }}
            value={pipelineId}
            onValueChange={(v) => { setPipelineId(v ?? ""); setStageId(""); setPage(0); }}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="All Pipelines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Pipelines</SelectItem>
              {(pipelinesQuery.data ?? []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Stage">
          <Select
            items={{ "": "All Stages", ...Object.fromEntries(stages.map((s) => [String(s.id), s.name])) }}
            value={stageId}
            onValueChange={(v) => { setStageId(v ?? ""); setPage(0); }}
          >
            <SelectTrigger className="h-10 w-full" disabled={!pipelineId}>
              <SelectValue placeholder={pipelineId ? "All Stages" : "Pick a pipeline first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Stages</SelectItem>
              {stages.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Account">
          <Select
            items={{ "": "All Accounts", ...Object.fromEntries((accountsQuery.data ?? []).map((a) => [String(a.id), a.name])) }}
            value={accountId}
            onValueChange={(v) => { setAccountId(v ?? ""); setPage(0); }}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Accounts</SelectItem>
              {(accountsQuery.data ?? []).map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Assigned To">
          <Select
            items={{ "": "Anyone", ...Object.fromEntries((usersQuery.data ?? []).map((u) => [String(u.id), u.fullName])) }}
            value={assignedUserId}
            onValueChange={(v) => { setAssignedUserId(v ?? ""); setPage(0); }}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Anyone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Anyone</SelectItem>
              {(usersQuery.data ?? []).map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Expected close from">
          <Input type="date" className="h-10" value={closeFrom} onChange={(e) => { setCloseFrom(e.target.value); setPage(0); }} />
        </FilterField>

        <FilterField label="Expected close to">
          <Input type="date" className="h-10" value={closeTo} onChange={(e) => { setCloseTo(e.target.value); setPage(0); }} />
        </FilterField>
      </FiltersPanel>

      <OpportunityDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
