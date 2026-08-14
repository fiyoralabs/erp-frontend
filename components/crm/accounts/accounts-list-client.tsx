"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { FiltersButton, FiltersPanel, FilterField } from "@/components/crm/shared/filters-panel";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { Account, AccountType } from "@/lib/types/crm";
import { ActiveBadge } from "@/components/shared/active-badge";
import { AccountDialog } from "@/components/crm/accounts/account-dialog";
import { formatCurrency } from "@/components/crm/shared/format";
import { useCrmUsers } from "@/components/crm/shared/user-select";

const TYPE_OPTIONS: AccountType[] = ["PROSPECT", "CUSTOMER", "PARTNER", "VENDOR", "OTHER"];
const SORT_OPTIONS = [
  { value: "createdAt,desc", label: "Newest first" },
  { value: "createdAt,asc", label: "Oldest first" },
  { value: "name,asc", label: "Name: A to Z" },
  { value: "name,desc", label: "Name: Z to A" },
  { value: "annualRevenue,desc", label: "Revenue: high to low" },
  { value: "annualRevenue,asc", label: "Revenue: low to high" },
];
const ACTIVE_OPTIONS = [
  { value: "", label: "Active & Inactive" },
  { value: "true", label: "Active only" },
  { value: "false", label: "Inactive only" },
];

function useDebounced<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function AccountsListClient() {
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [accountType, setAccountType] = React.useState<string>("");
  const [sort, setSort] = React.useState("createdAt,desc");
  const [assignedUserId, setAssignedUserId] = React.useState<string>("");
  const [active, setActive] = React.useState<string>("");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const debouncedSearch = useDebounced(search);
  const [dialogState, setDialogState] = React.useState<{ mode: "create" } | { mode: "edit"; row: Account } | null>(null);

  const usersQuery = useCrmUsers();

  const params = new URLSearchParams({ page: String(page), size: "20", sort });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (accountType) params.set("accountType", accountType);
  if (assignedUserId) params.set("assignedUserId", assignedUserId);
  if (active) params.set("active", active);

  const listQuery = useQuery({
    queryKey: ["crm", "accounts", page, sort, debouncedSearch, accountType, assignedUserId, active],
    queryFn: () => apiClient.get<PagedResult<Account>>(`crm/accounts?${params.toString()}`),
  });

  const activeAdvancedFilterCount = [assignedUserId, active].filter(Boolean).length;

  function clearAdvancedFilters() {
    setAssignedUserId("");
    setActive("");
    setPage(0);
  }

  const columns: DataTableColumn<Account>[] = [
    { key: "name", header: "Account", render: (r) => <Link href={`/crm/accounts/${r.id}`} className="font-medium text-primary hover:underline">{r.name}</Link> },
    { key: "type", header: "Type", render: (r) => r.accountType },
    { key: "industry", header: "Industry", render: (r) => r.industry ?? "—" },
    { key: "phone", header: "Contact", render: (r) => r.phone ?? r.email ?? "—" },
    { key: "revenue", header: "Annual Revenue", render: (r) => formatCurrency(r.annualRevenue), hideOnCard: true },
    { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.active} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Accounts</h1>
          <p className="text-sm text-muted-foreground">Companies and business customers.</p>
        </div>
        <Button className="h-11 gap-1.5 sm:h-8" onClick={() => setDialogState({ mode: "create" })}>
          <Plus className="size-4" /> New Account
        </Button>
      </div>

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            className="pl-8"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            items={{ "": "All Types", ...Object.fromEntries(TYPE_OPTIONS.map((t) => [t, t])) }}
            value={accountType}
            onValueChange={(v) => { setAccountType(v ?? ""); setPage(0); }}
          >
            <SelectTrigger className="h-10 w-full sm:w-36">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
        emptyMessage="No accounts yet. Create your first account or convert a lead."
        page={page}
        totalPages={listQuery.data?.totalPages}
        onPageChange={setPage}
        actions={(row) => (
          <>
            <Button nativeButton={false} variant="ghost" size="sm" render={<Link href={`/crm/accounts/${row.id}`} />}>View</Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setDialogState({ mode: "edit", row })} aria-label="Edit account">
              <Pencil className="size-4" />
            </Button>
          </>
        )}
      />

      <FiltersPanel open={filtersOpen} onOpenChange={setFiltersOpen} activeCount={activeAdvancedFilterCount} onClearAll={clearAdvancedFilters}>
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

        <FilterField label="Status">
          <Select
            items={Object.fromEntries(ACTIVE_OPTIONS.map((a) => [a.value, a.label]))}
            value={active}
            onValueChange={(v) => { setActive(v ?? ""); setPage(0); }}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Active & Inactive" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVE_OPTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
      </FiltersPanel>

      <AccountDialog
        open={dialogState !== null}
        onOpenChange={(open) => !open && setDialogState(null)}
        account={dialogState?.mode === "edit" ? dialogState.row : undefined}
      />
    </div>
  );
}
