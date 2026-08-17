"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { FiltersButton, FiltersPanel, FilterField } from "@/components/crm/shared/filters-panel";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import type { Contact, ContactLinks } from "@/lib/types/crm";
import { ActiveBadge } from "@/components/shared/active-badge";
import { ContactDialog } from "@/components/crm/contacts/contact-dialog";
import { ContactLinkedLeadsDialog } from "@/components/crm/contacts/contact-linked-leads-dialog";
import { useAccountNameLookup, useCrmAccounts } from "@/components/crm/shared/account-select";
import { useCrmUsers } from "@/components/crm/shared/user-select";

const SORT_OPTIONS = [
  { value: "firstName,asc", label: "Name: A to Z" },
  { value: "firstName,desc", label: "Name: Z to A" },
  { value: "createdAt,desc", label: "Newest first" },
  { value: "createdAt,asc", label: "Oldest first" },
];
const ACTIVE_OPTIONS = [
  { value: "", label: "Active & Inactive" },
  { value: "true", label: "Active only" },
  { value: "false", label: "Inactive only" },
];

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
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  // Read once on mount so links like /crm/contacts?accountId=5 land
  // pre-filtered, and so coming back from a contact's detail page restores
  // exactly what was applied (see the URL-sync effect below).
  const initialParams = useSearchParams();
  const [page, setPage] = React.useState(() => Number(initialParams.get("page") ?? 0));
  const [search, setSearch] = React.useState(() => initialParams.get("search") ?? "");
  const [accountId, setAccountId] = React.useState<string>(() => initialParams.get("accountId") ?? "");
  const [sort, setSort] = React.useState(() => initialParams.get("sort") ?? "firstName,asc");
  const [assignedUserId, setAssignedUserId] = React.useState<string>(() => initialParams.get("assignedUserId") ?? "");
  const [active, setActive] = React.useState<string>(() => initialParams.get("active") ?? "");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const debouncedSearch = useDebounced(search);
  const [dialogState, setDialogState] = React.useState<{ mode: "create" } | { mode: "edit"; row: Contact } | null>(null);
  const [linkedInfo, setLinkedInfo] = React.useState<{ contactName: string; links: ContactLinks } | null>(null);

  const accountsQuery = useCrmAccounts();
  const usersQuery = useCrmUsers();

  const params = new URLSearchParams({ page: String(page), size: "20", sort });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (accountId) params.set("accountId", accountId);
  if (assignedUserId) params.set("assignedUserId", assignedUserId);
  if (active) params.set("active", active);

  const listQuery = useQuery({
    queryKey: ["crm", "contacts", page, sort, debouncedSearch, accountId, assignedUserId, active],
    queryFn: () => apiClient.get<PagedResult<Contact>>(`crm/contacts?${params.toString()}`),
  });

  // Keep the URL in sync with the active filters (via replace, so this
  // doesn't spam browser history) -- that way navigating into a contact and
  // hitting Back returns to this exact filtered/paged view instead of a
  // blank list.
  React.useEffect(() => {
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, debouncedSearch, accountId, assignedUserId, active]);

  const accountNameById = useAccountNameLookup();

  const activeAdvancedFilterCount = [assignedUserId, active].filter(Boolean).length;

  function clearAdvancedFilters() {
    setAssignedUserId("");
    setActive("");
    setPage(0);
  }

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
          <h1 className="text-xl font-semibold md:text-2xl">Contacts</h1>
          <p className="text-sm text-muted-foreground">People at your accounts and leads.</p>
        </div>
        <Button className="h-11 gap-1.5 sm:h-8" onClick={() => setDialogState({ mode: "create" })}>
          <Plus className="size-4" /> New Contact
        </Button>
      </div>

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="pl-8"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            items={{ "": "All Accounts", ...Object.fromEntries((accountsQuery.data ?? []).map((a) => [String(a.id), a.name])) }}
            value={accountId}
            onValueChange={(v) => { setAccountId(v ?? ""); setPage(0); }}
          >
            <SelectTrigger className="h-10 w-32 shrink-0 sm:w-44">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Accounts</SelectItem>
              {(accountsQuery.data ?? []).map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            items={Object.fromEntries(SORT_OPTIONS.map((s) => [s.value, s.label]))}
            value={sort}
            onValueChange={(v) => { setSort(v ?? "firstName,asc"); setPage(0); }}
          >
            <SelectTrigger className="h-10 w-28 shrink-0 sm:w-44">
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
