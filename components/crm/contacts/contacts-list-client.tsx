"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import type { Contact, ContactLinks } from "@/lib/types/crm";
import { ActiveBadge } from "@/components/shared/active-badge";
import { ContactDialog } from "@/components/crm/contacts/contact-dialog";
import { ContactLinkedLeadsDialog } from "@/components/crm/contacts/contact-linked-leads-dialog";
import { useAccountNameLookup } from "@/components/crm/shared/account-select";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

function useDebounced<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function ContactsListClient() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounced(search);
  const [dialogState, setDialogState] = React.useState<{ mode: "create" } | { mode: "edit"; row: Contact } | null>(null);
  const [linkedInfo, setLinkedInfo] = React.useState<{ contactName: string; links: ContactLinks } | null>(null);

  const params = new URLSearchParams({ page: String(page), size: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);

  const listQuery = useQuery({
    queryKey: ["crm", "contacts", page, debouncedSearch],
    queryFn: () => apiClient.get<PagedResult<Contact>>(`crm/contacts?${params.toString()}`),
  });

  const accountNameById = useAccountNameLookup();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`crm/contacts/${id}`),
    onSuccess: () => {
      toast.success("Contact deleted");
      qc.invalidateQueries({ queryKey: ["crm", "contacts"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Checks whether the contact is linked to any lead or opportunity before
  // deleting -- both Lead.convertedContactId and Opportunity.primaryContactId
  // are real FKs onto crm.contact, so the backend rejects the delete anyway
  // while either link exists. If linked, show which record(s) instead.
  const checkAndDeleteMutation = useMutation({
    mutationFn: (row: Contact) =>
      apiClient.get<ContactLinks>(`crm/contacts/${row.id}/linked-records`).then((links) => ({ row, links })),
    onSuccess: ({ row, links }) => {
      if (links.leads.length > 0 || links.opportunities.length > 0) {
        setLinkedInfo({ contactName: `${row.firstName} ${row.lastName ?? ""}`.trim(), links });
      } else {
        deleteMutation.mutate(row.id);
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns: DataTableColumn<Contact>[] = [
    { key: "name", header: "Name", render: (r) => <Link href={`/crm/contacts/${r.id}`} className="font-medium text-primary hover:underline">{r.firstName} {r.lastName}</Link> },
    { key: "title", header: "Title", render: (r) => r.jobTitle ?? "—", hideOnCard: true },
    { key: "email", header: "Email", render: (r) => r.email ?? "—" },
    { key: "phone", header: "Phone", render: (r) => r.mobile ?? r.phone ?? "—" },
    { key: "account", header: "Account", render: (r) => r.accountId ? <Link href={`/crm/accounts/${r.accountId}`} className="text-primary hover:underline">{accountNameById.get(r.accountId) ?? `#${r.accountId}`}</Link> : "—" },
    { key: "status", header: "Status", render: (r) => <ActiveBadge isActive={r.active} />, hideOnCard: true },
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
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              aria-label="Delete contact"
              disabled={checkAndDeleteMutation.isPending || deleteMutation.isPending}
              onClick={() => checkAndDeleteMutation.mutate(row)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      />

      <ContactDialog
        open={dialogState !== null}
        onOpenChange={(open) => !open && setDialogState(null)}
        contact={dialogState?.mode === "edit" ? dialogState.row : undefined}
      />

      <ContactLinkedLeadsDialog
        open={!!linkedInfo}
        onOpenChange={(open) => !open && setLinkedInfo(null)}
        contactName={linkedInfo?.contactName ?? ""}
        links={linkedInfo?.links ?? { leads: [], opportunities: [] }}
      />
    </div>
  );
}
