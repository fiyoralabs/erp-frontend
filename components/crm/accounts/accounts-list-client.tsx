"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { Account } from "@/lib/types/crm";
import { ActiveBadge } from "@/components/shared/active-badge";
import { AccountDialog } from "@/components/crm/accounts/account-dialog";
import { formatCurrency } from "@/components/crm/shared/format";

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
  const debouncedSearch = useDebounced(search);
  const [dialogState, setDialogState] = React.useState<{ mode: "create" } | { mode: "edit"; row: Account } | null>(null);

  const params = new URLSearchParams({ page: String(page), size: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);

  const listQuery = useQuery({
    queryKey: ["crm", "accounts", page, debouncedSearch],
    queryFn: () => apiClient.get<PagedResult<Account>>(`crm/accounts?${params.toString()}`),
  });

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

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search accounts..." className="pl-8" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
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

      <AccountDialog
        open={dialogState !== null}
        onOpenChange={(open) => !open && setDialogState(null)}
        account={dialogState?.mode === "edit" ? dialogState.row : undefined}
      />
    </div>
  );
}
