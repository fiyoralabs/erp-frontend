"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { Contact } from "@/lib/types/crm";
import { ActiveBadge } from "@/components/shared/active-badge";
import { ContactDialog } from "@/components/crm/contacts/contact-dialog";

function useDebounced<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function ContactsListClient() {
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounced(search);
  const [dialogState, setDialogState] = React.useState<{ mode: "create" } | { mode: "edit"; row: Contact } | null>(null);

  const params = new URLSearchParams({ page: String(page), size: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);

  const listQuery = useQuery({
    queryKey: ["crm", "contacts", page, debouncedSearch],
    queryFn: () => apiClient.get<PagedResult<Contact>>(`crm/contacts?${params.toString()}`),
  });

  const columns: DataTableColumn<Contact>[] = [
    { key: "name", header: "Name", render: (r) => <Link href={`/crm/contacts/${r.id}`} className="font-medium text-primary hover:underline">{r.firstName} {r.lastName}</Link> },
    { key: "title", header: "Title", render: (r) => r.jobTitle ?? "—" },
    { key: "email", header: "Email", render: (r) => r.email ?? "—" },
    { key: "phone", header: "Phone", render: (r) => r.mobile ?? r.phone ?? "—" },
    { key: "account", header: "Account", render: (r) => r.accountId ? <Link href={`/crm/accounts/${r.accountId}`} className="text-primary hover:underline">#{r.accountId}</Link> : "—" },
    { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.active} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Contacts</h1>
          <p className="text-sm text-muted-foreground">People at your accounts and leads.</p>
        </div>
        <Button className="h-11 gap-1.5 sm:h-8" onClick={() => setDialogState({ mode: "create" })}>
          <Plus className="size-4" /> New Contact
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search contacts..." className="pl-8" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
      </div>

      <DataTable
        columns={columns}
        data={listQuery.data?.content ?? []}
        rowKey={(r) => r.id}
        isLoading={listQuery.isLoading}
        emptyMessage="No contacts yet."
        page={page}
        totalPages={listQuery.data?.totalPages}
        onPageChange={setPage}
        actions={(row) => (
          <>
            <Button nativeButton={false} variant="ghost" size="sm" render={<Link href={`/crm/contacts/${row.id}`} />}>View</Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setDialogState({ mode: "edit", row })} aria-label="Edit contact">
              <Pencil className="size-4" />
            </Button>
          </>
        )}
      />

      <ContactDialog
        open={dialogState !== null}
        onOpenChange={(open) => !open && setDialogState(null)}
        contact={dialogState?.mode === "edit" ? dialogState.row : undefined}
      />
    </div>
  );
}
