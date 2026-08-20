"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, UserPlus, Phone, Mail, DollarSign, Users, CreditCard, Wallet, ShoppingBag } from "lucide-react";

import { resolveReturnTo } from "@/lib/return-to";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import type { Account, AccountCustomerSummary, Contact, Opportunity } from "@/lib/types/crm";
import { ActiveBadge } from "@/components/shared/active-badge";
import { AccountDialog } from "@/components/crm/accounts/account-dialog";
import { ActivitiesTab } from "@/components/crm/activities/activities-tab";
import { TasksTab } from "@/components/crm/tasks/tasks-tab";
import { FollowUpsTab } from "@/components/crm/shared/follow-ups-tab";
import { CrmTimeline } from "@/components/crm/shared/crm-timeline";
import { OpportunityStatusBadge } from "@/components/crm/shared/status-badges";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";
import { StatTile } from "@/components/shared/stat-tile";
import { ScrollableTabsList } from "@/components/crm/shared/scrollable-tabs";
import { useUserNameLookup } from "@/components/crm/shared/user-select";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function AccountDetailClient({ accountId }: { accountId: number }) {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editOpen, setEditOpen] = React.useState(false);
  const userNameById = useUserNameLookup();

  const accountQuery = useQuery({
    queryKey: ["crm", "accounts", accountId],
    queryFn: () => apiClient.get<Account>(`crm/accounts/${accountId}`),
  });

  const contactsQuery = useQuery({
    queryKey: ["crm", "contacts", "by-account", accountId],
    queryFn: () => apiClient.get<Contact[]>(`crm/contacts/by-account/${accountId}`),
  });

  const opportunitiesQuery = useQuery({
    queryKey: ["crm", "opportunities", "by-account", accountId],
    queryFn: () => apiClient.get<PagedResult<Opportunity>>(`crm/opportunities?accountId=${accountId}&size=50`),
  });

  const customerSummaryQuery = useQuery({
    queryKey: ["crm", "accounts", accountId, "customer-summary"],
    queryFn: () => apiClient.get<AccountCustomerSummary>(`crm/accounts/${accountId}/customer-summary`),
  });

  const createCustomerMutation = useMutation({
    mutationFn: () => apiClient.post<Account>(`crm/accounts/${accountId}/create-customer`),
    onSuccess: () => {
      toast.success("ERP customer created and linked.");
      qc.invalidateQueries({ queryKey: ["crm", "accounts", accountId] });
      qc.invalidateQueries({ queryKey: ["crm", "accounts", accountId, "customer-summary"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (accountQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading account...</p>;
  const account = accountQuery.data;
  if (!account) return <p className="text-sm text-destructive">Account not found.</p>;

  const contactColumns: DataTableColumn<Contact>[] = [
    { key: "name", header: "Name", render: (r) => <Link href={`/crm/contacts/${r.id}`} className="text-primary hover:underline">{r.firstName} {r.lastName}</Link> },
    { key: "title", header: "Title", render: (r) => r.jobTitle ?? "—" },
    { key: "email", header: "Email", render: (r) => r.email ?? "—" },
    { key: "phone", header: "Phone", render: (r) => r.mobile ?? r.phone ?? "—" },
  ];

  const opportunityColumns: DataTableColumn<Opportunity>[] = [
    { key: "name", header: "Opportunity", render: (r) => <Link href={`/crm/opportunities/${r.id}`} className="text-primary hover:underline">{r.name}</Link> },
    { key: "amount", header: "Amount", render: (r) => formatCurrency(r.amount) },
    { key: "status", header: "Status", render: (r) => <OpportunityStatusBadge status={r.status} /> },
  ];

  const ownerName = account.assignedUserId ? (userNameById.get(account.assignedUserId) ?? `User #${account.assignedUserId}`) : "Unassigned";

  return (
    <div className="flex flex-col gap-3">
      {/* Back navigation */}
      <Button 
        variant="ghost" 
        size="sm" 
        className="w-fit gap-1 text-[11px] h-7 px-2" 
        onClick={() => router.push(resolveReturnTo(searchParams, "/crm/accounts"))}
      >
        <ArrowLeft className="size-3.5" /> Back to Accounts
      </Button>

      {/* Account Header Section */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{account.name}</h1>
            <ActiveBadge isActive={account.active} />
          </div>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            Account: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{account.accountNumber}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
          {!account.customerId && (
            <Button size="sm" className="h-8 text-xs gap-1 bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90 dark:bg-[#beebeb] dark:text-[#002020] dark:hover:bg-[#beebeb]/90" disabled={createCustomerMutation.isPending} onClick={() => createCustomerMutation.mutate()}>
              <UserPlus className="size-3.5" /> Create ERP Customer
            </Button>
          )}
          {account.customerId && (
            <Button nativeButton={false} variant="outline" size="sm" className="h-8 text-xs font-semibold" render={<Link href={`/sales?tab=customers`} />}>
              View ERP Customer #{account.customerId}
            </Button>
          )}
        </div>
      </div>

      {/* Information Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Account Details Card */}
        <Card className="lg:col-span-2 shadow-xs border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <CardContent className="p-4 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-3">Account Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Account Type</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{account.accountType}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Industry</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{account.industry ?? "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Assigned Owner</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{ownerName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Phone</span>
                  {account.phone ? (
                    <a href={`tel:${account.phone}`} className="text-[#0F3D3E] dark:text-[#a3cfcf] text-xs font-semibold hover:underline mt-0.5 block truncate" title={account.phone}>
                      {account.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-600 text-xs mt-0.5 block">—</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Email</span>
                  {account.email ? (
                    <a href={`mailto:${account.email}`} className="text-[#0F3D3E] dark:text-[#a3cfcf] text-xs font-semibold hover:underline mt-0.5 block truncate" title={account.email}>
                      {account.email}
                    </a>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-600 text-xs mt-0.5 block">—</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Website</span>
                  {account.website ? (
                    <a href={account.website.startsWith("http") ? account.website : `https://${account.website}`} target="_blank" rel="noopener noreferrer" className="text-[#0F3D3E] dark:text-[#a3cfcf] text-xs font-semibold hover:underline mt-0.5 block truncate" title={account.website}>
                      {account.website}
                    </a>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-600 text-xs mt-0.5 block">—</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Annual Revenue</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{formatCurrency(account.annualRevenue)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Employees</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{account.employeeCount ? String(account.employeeCount) : "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Tax ID / GSTIN</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{account.taxId ?? "—"}</span>
                </div>
              </div>
            </div>

            {account.description && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Description</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line leading-relaxed max-w-full overflow-wrap-break-word">
                  {account.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Address Details Card */}
        <Card className="shadow-xs border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <CardContent className="p-4 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-3">Address Information</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Street Address</span>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 whitespace-pre-line leading-relaxed">
                    {account.billingAddress ?? "—"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">City</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{account.billingCity ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">State</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{account.billingState ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Postal Code</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{account.billingPostalCode ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Country</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{account.billingCountry ?? "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Related Content */}
      <Tabs defaultValue="contacts">
        <ScrollableTabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-max min-w-full">
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </ScrollableTabsList>
        <TabsContent value="contacts">
          <DataTable columns={contactColumns} data={contactsQuery.data ?? []} rowKey={(r) => r.id} isLoading={contactsQuery.isLoading} emptyMessage="No contacts linked to this account." />
        </TabsContent>
        <TabsContent value="opportunities">
          <DataTable columns={opportunityColumns} data={opportunitiesQuery.data?.content ?? []} rowKey={(r) => r.id} isLoading={opportunitiesQuery.isLoading} emptyMessage="No opportunities yet." />
        </TabsContent>
        <TabsContent value="sales">
          <AccountSalesSummary summary={customerSummaryQuery.data} isLoading={customerSummaryQuery.isLoading} />
        </TabsContent>
        <TabsContent value="activities"><ActivitiesTab relatedType="ACCOUNT" relatedId={account.id} /></TabsContent>
        <TabsContent value="tasks"><TasksTab relatedType="ACCOUNT" relatedId={account.id} /></TabsContent>
        <TabsContent value="follow-ups"><FollowUpsTab relatedType="ACCOUNT" relatedId={account.id} /></TabsContent>
        <TabsContent value="timeline"><Card><CardContent className="pt-6"><CrmTimeline relatedType="ACCOUNT" relatedId={account.id} /></CardContent></Card></TabsContent>
      </Tabs>

      <AccountDialog open={editOpen} onOpenChange={setEditOpen} account={account} />
    </div>
  );
}

function AccountSalesSummary({ summary, isLoading }: { summary: AccountCustomerSummary | undefined; isLoading: boolean }) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading sales data...</p>;
  if (!summary?.linked) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          This account is not linked to an ERP customer yet. Set the account type to Customer, or use &ldquo;Create ERP Customer&rdquo; above, to see live Sales data here.
        </CardContent>
      </Card>
    );
  }

  const invoiceColumns: DataTableColumn<AccountCustomerSummary["recentInvoices"][number]>[] = [
    { key: "invoiceNumber", header: "Invoice", render: (r) => <Link href={`/sales?tab=invoices`} className="text-primary hover:underline">{r.invoiceNumber}</Link> },
    { key: "invoiceDate", header: "Date", render: (r) => formatDate(r.invoiceDate) },
    { key: "totalAmount", header: "Total", render: (r) => formatCurrency(r.totalAmount) },
    { key: "balanceAmount", header: "Balance", render: (r) => formatCurrency(r.balanceAmount) },
    { key: "status", header: "Status", render: (r) => r.status },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-6">
          <StatTile variant="inline" icon={Users} label="Customer" value={summary.customerCode ?? `#${summary.customerId}`} />
          <StatTile variant="inline" icon={CreditCard} label="Credit Limit" value={formatCurrency(summary.creditLimit)} />
          <StatTile variant="inline" icon={Wallet} tone={(summary.outstandingBalance ?? 0) > 0 ? "warning" : "default"} label="Outstanding Balance" value={formatCurrency(summary.outstandingBalance)} />
          <StatTile variant="inline" icon={ShoppingBag} tone="success" label="Total Purchases" value={formatCurrency(summary.totalPurchaseAmount)} />
        </CardContent>
      </Card>
      <div>
        <h3 className="mb-2 text-sm font-medium">Recent Invoices</h3>
        <DataTable columns={invoiceColumns} data={summary.recentInvoices} rowKey={(r) => r.id} emptyMessage="No invoices yet." />
      </div>
    </div>
  );
}
