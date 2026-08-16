"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Download,
  FileSpreadsheet,
  Trash2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import type { Lead, LeadStatus, LeadRating, LeadSource, LeadFollowUpFilter } from "@/lib/types/crm";
import { LeadRatingBadge, LeadStatusBadge } from "@/components/crm/shared/status-badges";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";
import { useCrmUsers, useUserNameLookup } from "@/components/crm/shared/user-select";
import { LeadImportDialog } from "@/components/crm/leads/lead-import-dialog";
import { cn } from "@/lib/utils";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

const STATUS_OPTIONS: LeadStatus[] = [
  "NEW", "CONTACTED", "ATTEMPTED_CONTACT", "INTERESTED", "QUALIFIED",
  "UNQUALIFIED", "NURTURING", "CONVERTED", "LOST",
];
const RATING_OPTIONS: LeadRating[] = ["HOT", "WARM", "COLD"];
const FOLLOWUP_OPTIONS: { value: LeadFollowUpFilter; label: string }[] = [
  { value: "OVERDUE", label: "Overdue" },
  { value: "DUE_TODAY", label: "Due today" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "NONE", label: "No follow-up set" },
];

function useDebounced<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// ...
export function LeadsListClient() {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  // Read once on mount so dashboard/sidebar links like /crm/leads?status=NEW
  // land pre-filtered, and so coming back from a lead's detail page restores
  // exactly what was applied (see the URL-sync effect below).
  const initialParams = useSearchParams();
  const [page, setPage] = React.useState(() => Number(initialParams.get("page") ?? 0));
  const [search, setSearch] = React.useState(() => initialParams.get("search") ?? "");
  const [status, setStatus] = React.useState<string>(() => initialParams.get("status") ?? "");
  const [rating, setRating] = React.useState<string>(() => initialParams.get("rating") ?? "");
  const [sourceId, setSourceId] = React.useState<string>(() => initialParams.get("leadSourceId") ?? "");
  const [assignedUserId, setAssignedUserId] = React.useState<string>(() => initialParams.get("assignedUserId") ?? "");
  const [followUp, setFollowUp] = React.useState<string>(() => initialParams.get("followUp") ?? "");
  // Lost/Unqualified leads are dead ends -- hidden from the working list by
  // default (true unless the URL says otherwise), with an explicit toggle
  // to bring them back when someone actually needs to review them.
  const [excludeLostAndUnqualified, setExcludeLostAndUnqualified] = React.useState<boolean>(() => {
    const raw = initialParams.get("excludeLostAndUnqualified");
    return raw === null ? true : raw === "true";
  });
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: number; name: string } | null>(null);
  const debouncedSearch = useDebounced(search);

  const sourcesQuery = useQuery({
    queryKey: ["crm", "lead-sources"],
    queryFn: () => apiClient.get<LeadSource[]>("crm/settings/lead-sources"),
  });
  const usersQuery = useCrmUsers();

  const params = new URLSearchParams({
    page: String(page),
    size: "20",
    excludeLostAndUnqualified: String(excludeLostAndUnqualified),
  });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (status) params.set("status", status);
  if (rating) params.set("rating", rating);
  if (sourceId) params.set("leadSourceId", sourceId);
  if (assignedUserId) params.set("assignedUserId", assignedUserId);
  if (followUp) params.set("followUp", followUp);

  const listQuery = useQuery({
    queryKey: ["crm", "leads", page, debouncedSearch, status, rating, sourceId, assignedUserId, followUp, excludeLostAndUnqualified],
    queryFn: () => apiClient.get<PagedResult<Lead>>(`crm/leads?${params.toString()}`),
  });

  // Keep the URL in sync with the active filters (via replace, so this
  // doesn't spam browser history) -- that way navigating into a lead and
  // hitting Back returns to this exact filtered/paged view instead of a
  // blank list, and the view is bookmarkable/shareable as-is.
  React.useEffect(() => {
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, status, rating, sourceId, assignedUserId, followUp, excludeLostAndUnqualified]);

  // Small always-on spotlight of the newest unactioned leads, independent of
  // whatever filters are applied to the main table below.
  const newLeadsQuery = useQuery({
    queryKey: ["crm", "leads", "spotlight-new"],
    queryFn: () => apiClient.get<PagedResult<Lead>>("crm/leads?status=NEW&page=0&size=6&sort=createdAt,desc"),
  });

  const sourceNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    (sourcesQuery.data ?? []).forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sourcesQuery.data]);

  const userNameById = useUserNameLookup();

  const activeAdvancedFilterCount = [rating, sourceId, assignedUserId, followUp].filter(Boolean).length;

  function clearAdvancedFilters() {
    setRating("");
    setSourceId("");
    setAssignedUserId("");
    setFollowUp("");
    setPage(0);
  }

  function viewNewLeads() {
    setStatus("NEW");
    setPage(0);
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`crm/leads/${id}`),
    onSuccess: () => {
      toast.success("Lead deleted");
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns: DataTableColumn<Lead>[] = [
    {
      key: "lead",
      header: "Lead",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Link href={`/crm/leads/${row.id}`} className="font-semibold text-[#0F3D3E] hover:underline dark:text-[#7da8a8]">
            {row.fullName}
          </Link>
          {row.status === "NEW" && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#0F3D3E]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#0F3D3E] dark:bg-[#a3cfcf]/15 dark:text-[#a3cfcf]">
              <Sparkles className="h-2.5 w-2.5" />
              New
            </span>
          )}
        </div>
      ),
    },
    { key: "company", header: "Company", render: (row) => <span className="text-[#545f73] dark:text-[#a3cfcf]">{row.companyName ?? "—"}</span> },
    { key: "contact", header: "Contact", render: (row) => <span className="text-[#545f73] dark:text-[#a3cfcf]">{row.phone ?? row.email ?? "—"}</span> },
    { key: "source", header: "Source", render: (row) => <span className="text-[#545f73] dark:text-[#a3cfcf]">{row.leadSourceId ? sourceNameById.get(row.leadSourceId) ?? "—" : "—"}</span> },
    { key: "status", header: "Status", render: (row) => <LeadStatusBadge status={row.status} /> },
    { key: "rating", header: "Rating", render: (row) => <LeadRatingBadge rating={row.rating} /> },
    { key: "value", header: "Est. Value", render: (row) => <span className="font-medium text-[#1a1c1c] dark:text-white">{formatCurrency(row.estimatedDealValue)}</span>, hideOnCard: true },
    { key: "assigned", header: "Assigned To", render: (row) => <span className="text-[#545f73] dark:text-[#a3cfcf]">{row.assignedUserId ? userNameById.get(row.assignedUserId) ?? `User #${row.assignedUserId}` : "Unassigned"}</span>, hideOnCard: true },
    {
      key: "followUp",
      header: "Next Follow-up",
      render: (row) => {
        const pending = row.nextPendingFollowUpDate;
        const isOverdue = !!pending && new Date(pending) < new Date(new Date().toDateString());
        return (
          <span className={isOverdue ? "font-semibold text-[#ba1a1a]" : "text-[#545f73] dark:text-[#a3cfcf]"}>
            {formatDate(pending)}
          </span>
        );
      },
      hideOnCard: true,
    },
    { key: "created", header: "Created", render: (row) => <span className="text-[#545f73] dark:text-[#a3cfcf]">{formatDate(row.createdAt)}</span>, hideOnCard: true },
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
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#1a1c1c] dark:text-white sm:text-3xl">Leads</h1>
          <p className="mt-1 text-sm text-[#545f73] dark:text-[#a3cfcf]">Track and qualify incoming leads.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            className="h-10 flex-1 border-[#c0c8c8] text-[#1a1c1c] hover:bg-[#f3f4f3] dark:border-[#717978] dark:text-white dark:hover:bg-[#2f3131] sm:flex-none"
            onClick={() => setImportDialogOpen(true)}
          >
            <FileSpreadsheet className="mr-1.5 size-4 text-emerald-600 dark:text-emerald-400" />
            Import Excel / CSV
          </Button>
          <Button
            variant="outline"
            className="h-10 flex-1 border-[#c0c8c8] text-[#1a1c1c] hover:bg-[#f3f4f3] dark:border-[#717978] dark:text-white dark:hover:bg-[#2f3131] sm:flex-none"
            onClick={exportCsv}
          >
            <Download className="mr-1.5 size-4" /> Export
          </Button>
          <Button
            nativeButton={false}
            className="h-10 w-full bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90 dark:bg-[#beebeb] dark:text-[#002020] dark:hover:bg-[#beebeb]/90 sm:w-auto"
            render={<Link href="/crm/leads/new" />}
          >
            <Plus className="mr-1.5 size-4" /> New Lead
          </Button>
        </div>
      </div>

      {/* New Leads Spotlight -- highlighted & always pinned above the filterable table */}
      {(newLeadsQuery.data?.content.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-[#0F3D3E]/20 bg-[#0F3D3E]/[0.04] p-4 dark:border-[#a3cfcf]/25 dark:bg-[#a3cfcf]/[0.06] sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-[#0F3D3E] text-white dark:bg-[#a3cfcf] dark:text-[#002020]">
                <Sparkles className="size-3.5" />
              </span>
              <h2 className="font-heading text-sm font-semibold text-[#1a1c1c] dark:text-white sm:text-base">
                New Leads
              </h2>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0F3D3E] px-1.5 text-[10px] font-bold text-white dark:bg-[#a3cfcf] dark:text-[#002020]">
                {newLeadsQuery.data?.totalElements}
              </span>
            </div>
            <button
              type="button"
              onClick={viewNewLeads}
              className="text-xs font-semibold text-[#0F3D3E] hover:underline dark:text-[#a3cfcf]"
            >
              View all
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-1">
            {newLeadsQuery.data?.content.map((lead) => (
              <Link
                key={lead.id}
                href={`/crm/leads/${lead.id}`}
                className="flex w-56 shrink-0 flex-col gap-1.5 rounded-xl border border-[#e2e2e2] bg-white p-3.5 shadow-xs transition-colors hover:border-[#0F3D3E] dark:border-[#404848] dark:bg-[#1a1c1c] dark:hover:border-[#a3cfcf]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-[#1a1c1c] dark:text-white">{lead.fullName}</span>
                  <LeadRatingBadge rating={lead.rating} />
                </div>
                <span className="truncate text-xs text-[#545f73] dark:text-[#a3cfcf]">{lead.companyName ?? lead.phone ?? lead.email ?? "—"}</span>
                <span className="text-[11px] text-[#717978]">{formatDate(lead.createdAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main Table Container / Canvas */}
      <div className="flex flex-col rounded-2xl border border-[#c0c8c8] bg-white shadow-xs dark:border-[#717978] dark:bg-[#1a1c1c]">
        {/* Filter Bar -- primary filters only; everything else lives in the Filters panel */}
        <div className="flex flex-col gap-3 border-b border-[#c0c8c8] bg-[#f9f9f9] p-4 rounded-t-2xl dark:border-[#717978] dark:bg-[#2f3131] lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#717978]" />
            <Input
              placeholder="Search leads by name, company, or email..."
              className="h-10 border-[#c0c8c8] bg-white pl-9 text-sm focus-visible:ring-[#0F3D3E] dark:border-[#717978] dark:bg-[#1a1c1c]"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Select
              items={{
                "": "All Statuses",
                ALL_INCLUDE_LOST_UNQUALIFIED: "All Statuses (incl. Lost/Unqualified)",
                ...Object.fromEntries(STATUS_OPTIONS.map((s) => [s, s.replaceAll("_", " ")])),
              }}
              value={status || (excludeLostAndUnqualified ? "" : "ALL_INCLUDE_LOST_UNQUALIFIED")}
              onValueChange={(v) => {
                if (v === "ALL_INCLUDE_LOST_UNQUALIFIED") {
                  setStatus("");
                  setExcludeLostAndUnqualified(false);
                } else {
                  setStatus(v ?? "");
                  setExcludeLostAndUnqualified(true);
                }
                setPage(0);
              }}
            >
              <SelectTrigger className="h-10 w-full border-[#c0c8c8] bg-white text-sm dark:border-[#717978] dark:bg-[#1a1c1c] sm:w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="ALL_INCLUDE_LOST_UNQUALIFIED">All Statuses (incl. Lost/Unqualified)</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              className="relative h-10 border-[#c0c8c8] text-[#1a1c1c] hover:bg-[#f3f4f3] dark:border-[#717978] dark:text-white dark:hover:bg-[#2f3131]"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="mr-1.5 size-4" />
              Filters
              {activeAdvancedFilterCount > 0 && (
                <span
                  className={cn(
                    "ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white",
                    followUp === "OVERDUE" ? "bg-[#ba1a1a]" : "bg-[#0F3D3E] dark:bg-[#a3cfcf] dark:text-[#002020]"
                  )}
                >
                  {activeAdvancedFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="p-2 sm:p-4">
          <DataTable
            columns={columns}
            data={listQuery.data?.content ?? []}
            rowKey={(row) => row.id}
            rowClassName={(row) => {
              if (followUp === "OVERDUE") return "bg-[#ba1a1a]/[0.05] dark:bg-[#ffb4ab]/[0.08]";
              if (row.status === "NEW") return "bg-[#0F3D3E]/[0.03] dark:bg-[#a3cfcf]/[0.05]";
              return undefined;
            }}
            isLoading={listQuery.isLoading}
            emptyMessage="No leads found. Create your first lead to start building your sales pipeline."
            page={page}
            totalPages={listQuery.data?.totalPages}
            onPageChange={setPage}
            onRowClick={(row) => router.push(`/crm/leads/${row.id}`)}
            actions={(row) => (
              <div className="flex items-center justify-end gap-1">
                <Button nativeButton={false} variant="ghost" size="sm" render={<Link href={`/crm/leads/${row.id}`} />}>
                  View
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  aria-label="Delete lead"
                  onClick={() => setDeleteTarget({ id: row.id, name: row.fullName })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          />
        </div>
      </div>

      {listQuery.isError && (
        <p className="text-sm text-destructive">Failed to load leads.</p>
      )}

      {/* Advanced Filters Panel -- rating, source, assigned to, follow-up */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-5 overflow-y-auto px-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#545f73] dark:text-[#a3cfcf]">Rating</label>
              <Select
                items={{ "": "All Ratings", ...Object.fromEntries(RATING_OPTIONS.map((r) => [r, r])) }}
                value={rating}
                onValueChange={(v) => { setRating(v ?? ""); setPage(0); }}
              >
                <SelectTrigger className="h-10 w-full border-[#c0c8c8] bg-white text-sm dark:border-[#717978] dark:bg-[#1a1c1c]">
                  <SelectValue placeholder="All Ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Ratings</SelectItem>
                  {RATING_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#545f73] dark:text-[#a3cfcf]">Source</label>
              <Select
                items={{ "": "All Sources", ...Object.fromEntries((sourcesQuery.data ?? []).map((s) => [String(s.id), s.name])) }}
                value={sourceId}
                onValueChange={(v) => { setSourceId(v ?? ""); setPage(0); }}
              >
                <SelectTrigger className="h-10 w-full border-[#c0c8c8] bg-white text-sm dark:border-[#717978] dark:bg-[#1a1c1c]">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sources</SelectItem>
                  {(sourcesQuery.data ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#545f73] dark:text-[#a3cfcf]">Assigned To</label>
              <Select
                items={{ "": "Anyone", ...Object.fromEntries((usersQuery.data ?? []).map((u) => [String(u.id), u.fullName])) }}
                value={assignedUserId}
                onValueChange={(v) => { setAssignedUserId(v ?? ""); setPage(0); }}
              >
                <SelectTrigger className="h-10 w-full border-[#c0c8c8] bg-white text-sm dark:border-[#717978] dark:bg-[#1a1c1c]">
                  <SelectValue placeholder="Anyone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Anyone</SelectItem>
                  {(usersQuery.data ?? []).map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#545f73] dark:text-[#a3cfcf]">Follow-up</label>
              <Select
                items={{ "": "Any", ...Object.fromEntries(FOLLOWUP_OPTIONS.map((f) => [f.value, f.label])) }}
                value={followUp}
                onValueChange={(v) => { setFollowUp(v ?? ""); setPage(0); }}
              >
                <SelectTrigger className="h-10 w-full border-[#c0c8c8] bg-white text-sm dark:border-[#717978] dark:bg-[#1a1c1c]">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {FOLLOWUP_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value} className={f.value === "OVERDUE" ? "text-[#ba1a1a] font-semibold" : undefined}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn("flex-1", activeAdvancedFilterCount === 0 && "opacity-50")}
              disabled={activeAdvancedFilterCount === 0}
              onClick={clearAdvancedFilters}
            >
              Clear all
            </Button>
            <Button type="button" className="flex-1 bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90" onClick={() => setFiltersOpen(false)}>
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <LeadImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={() => listQuery.refetch()}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Lead?"
        description={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete Lead"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
