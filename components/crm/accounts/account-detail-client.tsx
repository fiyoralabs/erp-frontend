"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function AccountDetailClient({ accountId }: { accountId: number }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);

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

  return (
    <div className="flex flex-col gap-4">
      <Button nativeButton={false} variant="ghost" size="sm" className="w-fit gap-1.5" render={<Link href="/crm/accounts" />}>
        <ArrowLeft className="size-4" /> Back to Accounts
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold sm:text-2xl">{account.name}</h1>
                <ActiveBadge isActive={account.active} />
              </div>
              <p className="text-sm text-muted-foreground">{account.accountNumber} · {account.accountType} {account.industry ? `· ${account.industry}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
              {!account.customerId && (
                <Button size="sm" className="gap-1.5" disabled={createCustomerMutation.isPending} onClick={() => createCustomerMutation.mutate()}>
                  <UserPlus className="size-4" /> Create ERP Customer
                </Button>
              )}
              {account.customerId && (
                <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/sales?tab=customers`} />}>
                  View ERP Customer #{account.customerId}
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t pt-4 text-sm sm:grid-cols-4">
            <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{account.phone ?? "—"}</p></div>
            <div><p className="text-muted-foreground">Email</p><p className="font-medium">{account.email ?? "—"}</p></div>
            <div><p className="text-muted-foreground">Annual Revenue</p><p className="font-medium">{formatCurrency(account.annualRevenue)}</p></div>
            <div><p className="text-muted-foreground">Employees</p><p className="font-medium">{account.employeeCount ?? "—"}</p></div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
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
        <CardContent className="grid grid-cols-2 gap-4 pt-6 text-sm sm:grid-cols-4">
          <div><p className="text-muted-foreground">Customer</p><p className="font-medium">{summary.customerCode ?? `#${summary.customerId}`}</p></div>
          <div><p className="text-muted-foreground">Credit Limit</p><p className="font-medium">{formatCurrency(summary.creditLimit)}</p></div>
          <div><p className="text-muted-foreground">Outstanding Balance</p><p className="font-medium">{formatCurrency(summary.outstandingBalance)}</p></div>
          <div><p className="text-muted-foreground">Total Purchases</p><p className="font-medium">{formatCurrency(summary.totalPurchaseAmount)}</p></div>
        </CardContent>
      </Card>
      <div>
        <h3 className="mb-2 text-sm font-medium">Recent Invoices</h3>
        <DataTable columns={invoiceColumns} data={summary.recentInvoices} rowKey={(r) => r.id} emptyMessage="No invoices yet." />
      </div>
    </div>
  );
}
