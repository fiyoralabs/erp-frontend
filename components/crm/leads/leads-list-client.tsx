"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { Lead, LeadStatus, LeadRating, LeadSource } from "@/lib/types/crm";
import { LeadRatingBadge, LeadStatusBadge } from "@/components/crm/shared/status-badges";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";
import { useUserNameLookup } from "@/components/crm/shared/user-select";

const STATUS_OPTIONS: LeadStatus[] = [
  "NEW", "CONTACTED", "ATTEMPTED_CONTACT", "INTERESTED", "QUALIFIED",
  "UNQUALIFIED", "NURTURING", "CONVERTED", "LOST",
];
const RATING_OPTIONS: LeadRating[] = ["HOT", "WARM", "COLD"];

function useDebounced<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

import { useRouter } from "next/navigation";

// ...
export function LeadsListClient() {
  const router = useRouter();
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [rating, setRating] = React.useState<string>("");
  const [sourceId, setSourceId] = React.useState<string>("");
  const debouncedSearch = useDebounced(search);

  const sourcesQuery = useQuery({
    queryKey: ["crm", "lead-sources"],
    queryFn: () => apiClient.get<LeadSource[]>("crm/settings/lead-sources"),
  });

  const params = new URLSearchParams({ page: String(page), size: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (status) params.set("status", status);
  if (rating) params.set("rating", rating);
  if (sourceId) params.set("leadSourceId", sourceId);

  const listQuery = useQuery({
    queryKey: ["crm", "leads", page, debouncedSearch, status, rating, sourceId],
    queryFn: () => apiClient.get<PagedResult<Lead>>(`crm/leads?${params.toString()}`),
  });

  const sourceNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    (sourcesQuery.data ?? []).forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sourcesQuery.data]);

  const userNameById = useUserNameLookup();

  const columns: DataTableColumn<Lead>[] = [
    {
      key: "lead",
      header: "Lead",
      render: (row) => (
        <Link href={`/crm/leads/${row.id}`} className="font-medium text-primary hover:underline">
          {row.fullName}
        </Link>
      ),
    },
    { key: "company", header: "Company", render: (row) => row.companyName ?? "—" },
    { key: "contact", header: "Contact", render: (row) => row.phone ?? row.email ?? "—" },
    { key: "source", header: "Source", render: (row) => (row.leadSourceId ? sourceNameById.get(row.leadSourceId) ?? "—" : "—") },
    { key: "status", header: "Status", render: (row) => <LeadStatusBadge status={row.status} /> },
    { key: "rating", header: "Rating", render: (row) => <LeadRatingBadge rating={row.rating} /> },
    { key: "value", header: "Est. Value", render: (row) => formatCurrency(row.estimatedDealValue), hideOnCard: true },
    { key: "assigned", header: "Assigned To", render: (row) => (row.assignedUserId ? userNameById.get(row.assignedUserId) ?? `User #${row.assignedUserId}` : "Unassigned"), hideOnCard: true },
    { key: "followUp", header: "Next Follow-up", render: (row) => formatDate(row.nextFollowUpAt), hideOnCard: true },
    { key: "created", header: "Created", render: (row) => formatDate(row.createdAt), hideOnCard: true },
  ];

  function exportCsv() {
    const rows = listQuery.data?.content ?? [];
    const header = ["Lead Number", "Name", "Company", "Email", "Phone", "Status", "Rating", "Estimated Value", "Created"];
    const lines = rows.map((r) => [r.leadNumber, r.fullName, r.companyName ?? "", r.email ?? "", r.phone ?? "", r.status, r.rating ?? "", r.estimatedDealValue ?? "", r.createdAt]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Leads</h1>
          <p className="text-sm text-muted-foreground">Track and qualify incoming leads.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 gap-1.5 sm:h-8" onClick={exportCsv}>
            <Download className="size-4" /> Export
          </Button>
          <Button nativeButton={false} className="h-11 gap-1.5 sm:h-8" render={<Link href="/crm/leads/new" />}>
            <Plus className="size-4" /> New Lead
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads by name, company, email, phone..."
            className="pl-8"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <Select items={{ "": "All statuses", ...Object.fromEntries(STATUS_OPTIONS.map((s) => [s, s.replaceAll("_", " ")])) }}
          value={status} onValueChange={(v) => { setStatus(v ?? ""); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select items={{ "": "All ratings", ...Object.fromEntries(RATING_OPTIONS.map((r) => [r, r])) }}
          value={rating} onValueChange={(v) => { setRating(v ?? ""); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Rating" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All ratings</SelectItem>
            {RATING_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          items={{ "": "All sources", ...Object.fromEntries((sourcesQuery.data ?? []).map((s) => [String(s.id), s.name])) }}
          value={sourceId} onValueChange={(v) => { setSourceId(v ?? ""); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All sources</SelectItem>
            {(sourcesQuery.data ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={listQuery.data?.content ?? []}
        rowKey={(row) => row.id}
        isLoading={listQuery.isLoading}
        emptyMessage="No leads yet. Create your first lead to start building your sales pipeline."
        page={page}
        totalPages={listQuery.data?.totalPages}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/crm/leads/${row.id}`)}
        actions={(row) => (
          <Button nativeButton={false} variant="ghost" size="sm" render={<Link href={`/crm/leads/${row.id}`} />}>
            View
          </Button>
        )}
      />

      {listQuery.isError && (
        <p className="text-sm text-destructive">Failed to load leads.</p>
      )}
    </div>
  );
}
