"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Building2, CalendarRange, Landmark, Loader2, Plus, RefreshCw, Scale, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { ReconciliationDetail, TreasuryEditDialog } from "@/components/finance/treasury-dialogs";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import { localDateInputValue } from "@/lib/date";
import type {
  Account,
  AccountType,
  BalanceSheet,
  BankAccount,
  CashAccount,
  FiscalPeriod,
  GeneralLedger,
  JournalEntry,
  JournalStatus,
  JournalSummary,
  JournalType,
  ProfitLoss,
  Reconciliation,
  TrialBalance,
} from "@/lib/types/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const err = (e: unknown) => (e instanceof ApiRequestError || e instanceof Error ? e.message : "Something went wrong");
const today = () => localDateInputValue();
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const accountTypes: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
const journalTypes: JournalType[] = ["MANUAL", "SYSTEM_SALES", "SYSTEM_PURCHASE", "SYSTEM_EXPENSE", "CLOSING", "ADJUSTMENT"];

export function FinanceClient() {
  const qc = useQueryClient();
  const [cashEdit, setCashEdit] = React.useState<CashAccount | null>(null);
  const [bankEdit, setBankEdit] = React.useState<BankAccount | null>(null);
  const [reconciliationDetailId, setReconciliationDetailId] = React.useState<number | null>(null);

  const [journalOpen, setJournalOpen] = React.useState(false);
  const [accountEdit, setAccountEdit] = React.useState<Account | null | undefined>(undefined);
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const [cashOpen, setCashOpen] = React.useState(false);
  const [bankOpen, setBankOpen] = React.useState(false);
  const [reconcile, setReconcile] = React.useState<BankAccount | null>(null);
  const [detailId, setDetailId] = React.useState<number | null>(null);

  // Filters
  const [from, setFrom] = React.useState(yearStart());
  const [to, setTo] = React.useState(today());
  const [status, setStatus] = React.useState("all");
  const [jtype, setJtype] = React.useState("all");
  const [reference, setReference] = React.useState("");

  const jq = React.useMemo(() => {
    const p = new URLSearchParams({ page: "0", size: "100", sort: "entryDate,desc" });
    if (from) p.set("fromDate", from);
    if (to) p.set("toDate", to);
    if (status !== "all") p.set("status", status);
    if (jtype !== "all") p.set("entryType", jtype);
    if (reference) p.set("referenceNumber", reference);
    return p.toString();
  }, [from, to, status, jtype, reference]);

  const accounts = useQuery({ queryKey: ["finance", "accounts"], queryFn: () => apiClient.get<Account[]>("finance/accounts") });
  const periods = useQuery({ queryKey: ["finance", "periods"], queryFn: () => apiClient.get<FiscalPeriod[]>("finance/fiscal-periods") });
  const journals = useQuery({
    queryKey: ["finance", "journals", jq],
    queryFn: () => apiClient.get<PagedResult<JournalSummary>>(`finance/journal-entries?${jq}`),
  });
  const cash = useQuery({ queryKey: ["finance", "cash"], queryFn: () => apiClient.get<CashAccount[]>("finance/cash-accounts") });
  const banks = useQuery({ queryKey: ["finance", "banks"], queryFn: () => apiClient.get<BankAccount[]>("finance/bank-accounts") });
  const recs = useQuery({ queryKey: ["finance", "reconciliations"], queryFn: () => apiClient.get<Reconciliation[]>("finance/reconciliations") });
  const detail = useQuery({
    queryKey: ["finance", "journal", detailId],
    queryFn: () => apiClient.get<JournalEntry>(`finance/journal-entries/${detailId}`),
    enabled: detailId !== null,
  });

  const tb = useQuery({
    queryKey: ["finance", "tb", to],
    queryFn: () => apiClient.get<TrialBalance>(`finance/reports/trial-balance?asOfDate=${to}&includeZeroBalances=false`),
    enabled: !!to,
  });
  const bs = useQuery({
    queryKey: ["finance", "bs", to],
    queryFn: () => apiClient.get<BalanceSheet>(`finance/reports/balance-sheet?asOfDate=${to}`),
    enabled: !!to,
  });
  const pl = useQuery({
    queryKey: ["finance", "pl", from, to],
    queryFn: () => apiClient.get<ProfitLoss>(`finance/reports/profit-loss?startDate=${from}&endDate=${to}`),
    enabled: !!from && !!to,
  });

  const accts = accounts.data ?? [];
  const rows = journals.data?.content ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["finance"] });

  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) => apiClient.post(path, body),
    onSuccess: async () => {
      toast.success("Finance record updated");
      await refresh();
    },
    onError: (e) => toast.error(err(e)),
  });

  return (
    <div className="flex flex-col gap-5 w-full max-w-full">
      {/* Header & Main Actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Your general ledger, period controls, treasury accounts and statutory statements in one workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => refresh()}>
            <RefreshCw /> Refresh
          </Button>
          <Button onClick={() => setJournalOpen(true)} className="w-full sm:w-auto bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
            <Plus /> Manual journal
          </Button>
        </div>
      </div>

      {/* Financial Metrics Strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Scale} label="Trial balance" value={tb.data?.isBalanced ? "Balanced" : "Review required"} good={tb.data?.isBalanced} />
        <Metric icon={BookOpen} label="Posted debits" value={money.format(tb.data?.totalDebit ?? 0)} />
        <Metric icon={Landmark} label="Net profit / loss" value={money.format(pl.data?.netProfitLoss ?? 0)} good={(pl.data?.netProfitLoss ?? 0) >= 0} />
        <Metric icon={CalendarRange} label="Current open periods" value={String((periods.data ?? []).filter((x) => x.status === "OPEN").length)} />
      </div>

      {/* Tabs View */}
      <Tabs defaultValue="journals" className="w-full">
        <div className="border-b overflow-x-auto scrollbar-none">
          <TabsList className="flex h-auto flex-wrap w-max sm:w-auto">
            <TabsTrigger value="journals">Journals</TabsTrigger>
            <TabsTrigger value="accounts">Chart of accounts</TabsTrigger>
            <TabsTrigger value="periods">Fiscal periods</TabsTrigger>
            <TabsTrigger value="treasury">Cash & banks</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
            <TabsTrigger value="reports">Statements</TabsTrigger>
          </TabsList>
        </div>

        {/* --- JOURNALS TAB --- */}
        <TabsContent value="journals" className="mt-4">
          <Card className="shadow-xs border-slate-200/80">
            <CardHeader>
              <CardTitle>General journal</CardTitle>
              <CardDescription>
                Manual and system postings from Sales, Purchases, Expenses and Inventory. Posted entries are immutable; correct them by reversal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Journal Search & Filter Inputs */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                <Picker
                  value={status}
                  set={setStatus}
                  items={[
                    ["all", "All statuses"],
                    ["DRAFT", "Draft"],
                    ["POSTED", "Posted"],
                    ["REVERSED", "Reversed"],
                  ]}
                />
                <Picker
                  value={jtype}
                  set={setJtype}
                  items={[["all", "All sources"], ...journalTypes.map((x) => [x, x.replaceAll("_", " ")] as [string, string])]}
                />
                <Input placeholder="Exact reference" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>

              {/* Mobile Journal Cards (<md) */}
              <div className="md:hidden space-y-3">
                {rows.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10 p-4">
                    No journal entries found matching criteria.
                  </div>
                ) : (
                  rows.map((x) => (
                    <div key={x.id} className="p-4 border rounded-2xl bg-card space-y-3 shadow-xs min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium break-all">{x.entryNumber}</span>
                        <Status value={x.status} />
                      </div>

                      <div className="space-y-1 bg-muted/20 p-3 rounded-xl border">
                        <div className="text-xs text-muted-foreground">Source: <strong className="font-medium text-foreground">{x.entryType.replaceAll("_", " ")}</strong></div>
                        <div className="text-xs text-muted-foreground">Date: {x.entryDate}</div>
                        <div className="text-xs text-muted-foreground">Ref: {x.referenceNumber ?? "—"}</div>
                        <p className="text-sm font-medium text-foreground break-words pt-1">{x.description}</p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t">
                        <div>
                          <span className="text-xs text-muted-foreground block">Debit / Credit</span>
                          <span className="font-medium">{money.format(x.totalDebit)}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setDetailId(x.id)}>
                            View
                          </Button>
                          {x.status === "DRAFT" && (
                            <Button size="sm" className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]" onClick={() => act.mutate({ path: `finance/journal-entries/${x.id}/post` })}>
                              Post
                            </Button>
                          )}
                          {x.status === "POSTED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const reason = window.prompt("Reversal reason");
                                if (reason)
                                  act.mutate({
                                    path: `finance/journal-entries/${x.id}/reverse`,
                                    body: { reversalDate: today(), reversalReason: reason },
                                  });
                              }}
                            >
                              Reverse
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table (≥md) */}
              <div className="hidden md:block">
                <Grid heads={["Entry", "Date", "Source", "Description", "Reference", "Status", "Debit / credit", "Actions"]}>
                  {rows.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell className="font-medium">{x.entryNumber}</TableCell>
                      <TableCell>{x.entryDate}</TableCell>
                      <TableCell>{x.entryType.replaceAll("_", " ")}</TableCell>
                      <TableCell className="max-w-64 truncate">{x.description}</TableCell>
                      <TableCell>{x.referenceNumber ?? "—"}</TableCell>
                      <TableCell>
                        <Status value={x.status} />
                      </TableCell>
                      <TableCell className="font-medium">{money.format(x.totalDebit)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setDetailId(x.id)}>
                            View
                          </Button>
                          {x.status === "DRAFT" && (
                            <Button size="sm" className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]" onClick={() => act.mutate({ path: `finance/journal-entries/${x.id}/post` })}>
                              Post
                            </Button>
                          )}
                          {x.status === "POSTED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const reason = window.prompt("Reversal reason");
                                if (reason)
                                  act.mutate({
                                    path: `finance/journal-entries/${x.id}/reverse`,
                                    body: { reversalDate: today(), reversalReason: reason },
                                  });
                              }}
                            >
                              Reverse
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </Grid>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- CHART OF ACCOUNTS TAB --- */}
        <TabsContent value="accounts" className="mt-4">
          <Card className="shadow-xs border-slate-200/80">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Chart of accounts</CardTitle>
                  <CardDescription>Control accounts connect operational modules to the general ledger.</CardDescription>
                </div>
                <Button onClick={() => setAccountEdit(null)} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
                  <Plus /> Account
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mobile Accounts Cards (<md) */}
              <div className="md:hidden space-y-3">
                {accts.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10 p-4">
                    No GL accounts defined.
                  </div>
                ) : (
                  accts.map((x) => (
                    <div key={x.id} className="p-4 border rounded-2xl bg-card space-y-3 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium font-mono">{x.code}</span>
                          <span className="font-medium break-words">{x.name}</span>
                        </div>
                        <Status value={x.isActive ? "ACTIVE" : "INACTIVE"} />
                      </div>
                      <div className="space-y-1 bg-muted/20 p-3 rounded-xl border text-xs text-muted-foreground">
                        <div>Type: <strong className="text-foreground">{x.type}</strong></div>
                        <div>Parent: <strong className="text-foreground">{accts.find((a) => a.id === x.parentId)?.name ?? "—"}</strong></div>
                        <div>Control: <strong className="text-foreground">{x.controlType ?? "—"}</strong></div>
                      </div>
                      <div className="flex justify-end pt-1 border-t">
                        <Button size="sm" variant="outline" onClick={() => setAccountEdit(x)}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table (≥md) */}
              <div className="hidden md:block">
                <Grid heads={["Code", "Account", "Type", "Parent", "Control", "Status", "Actions"]}>
                  {accts.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell className="font-medium">{x.code}</TableCell>
                      <TableCell>{x.name}</TableCell>
                      <TableCell>{x.type}</TableCell>
                      <TableCell>{accts.find((a) => a.id === x.parentId)?.name ?? "—"}</TableCell>
                      <TableCell>{x.controlType ?? "—"}</TableCell>
                      <TableCell>
                        <Status value={x.isActive ? "ACTIVE" : "INACTIVE"} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setAccountEdit(x)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </Grid>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- FISCAL PERIODS TAB --- */}
        <TabsContent value="periods" className="mt-4">
          <Card className="shadow-xs border-slate-200/80">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Fiscal periods</CardTitle>
                  <CardDescription>Closing blocks new postings; locking is final. Review statements before either action.</CardDescription>
                </div>
                <Button onClick={() => setPeriodOpen(true)} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
                  <Plus /> Generate year
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mobile Periods Cards (<md) */}
              <div className="md:hidden space-y-3">
                {(periods.data ?? []).length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10 p-4">
                    No fiscal periods generated.
                  </div>
                ) : (
                  (periods.data ?? []).map((x) => (
                    <div key={x.id} className="p-4 border rounded-2xl bg-card space-y-3 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{x.periodName}</span>
                        <Status value={x.status} />
                      </div>
                      <div className="space-y-1 bg-muted/20 p-3 rounded-xl border text-xs text-muted-foreground">
                        <div>Start: <strong className="text-foreground">{x.startDate}</strong></div>
                        <div>End: <strong className="text-foreground">{x.endDate}</strong></div>
                        <div>Closed: <strong className="text-foreground">{x.closedAt ? new Date(x.closedAt).toLocaleString() : "—"}</strong></div>
                      </div>
                      <div className="flex justify-end pt-1 border-t">
                        {x.status === "OPEN" ? (
                          <Button size="sm" variant="outline" onClick={() => act.mutate({ path: `finance/fiscal-periods/${x.id}/close` })}>
                            Close
                          </Button>
                        ) : x.status === "CLOSED" ? (
                          <Button size="sm" variant="destructive" onClick={() => act.mutate({ path: `finance/fiscal-periods/${x.id}/lock` })}>
                            Lock permanently
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table (≥md) */}
              <div className="hidden md:block">
                <Grid heads={["Period", "Start", "End", "Status", "Closed", "Actions"]}>
                  {(periods.data ?? []).map((x) => (
                    <TableRow key={x.id}>
                      <TableCell className="font-medium">{x.periodName}</TableCell>
                      <TableCell>{x.startDate}</TableCell>
                      <TableCell>{x.endDate}</TableCell>
                      <TableCell>
                        <Status value={x.status} />
                      </TableCell>
                      <TableCell>{x.closedAt ? new Date(x.closedAt).toLocaleString() : "—"}</TableCell>
                      <TableCell>
                        {x.status === "OPEN" ? (
                          <Button size="sm" variant="outline" onClick={() => act.mutate({ path: `finance/fiscal-periods/${x.id}/close` })}>
                            Close
                          </Button>
                        ) : x.status === "CLOSED" ? (
                          <Button size="sm" variant="destructive" onClick={() => act.mutate({ path: `finance/fiscal-periods/${x.id}/lock` })}>
                            Lock permanently
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </Grid>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- CASH & BANKS TAB --- */}
        <TabsContent value="treasury" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Cash Accounts */}
            <Card className="shadow-xs border-slate-200/80">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Cash accounts</CardTitle>
                    <CardDescription>Physical tills and petty-cash books linked to GL accounts.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setCashOpen(true)} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
                    <Plus /> Cash
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mobile Cash Cards (<md) */}
                <div className="md:hidden space-y-3">
                  {(cash.data ?? []).length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10 p-4">
                      No cash accounts recorded.
                    </div>
                  ) : (
                    (cash.data ?? []).map((x) => (
                      <div key={x.id} className="p-4 border rounded-2xl bg-card space-y-3 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{x.name}</span>
                          <Status value={x.isActive ? "ACTIVE" : "INACTIVE"} />
                        </div>
                        <div className="space-y-1 bg-muted/20 p-3 rounded-xl border text-xs text-muted-foreground">
                          <div>Code: <strong className="font-mono text-foreground">{x.code}</strong></div>
                          <div>GL Account: <strong className="font-mono text-foreground">{x.glAccountCode}</strong></div>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t">
                          <div>
                            <span className="text-xs text-muted-foreground block">Balance</span>
                            <span className="font-medium">{money.format(x.currentBalance)}</span>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setCashEdit(x)}>
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table (≥md) */}
                <div className="hidden md:block">
                  <Grid heads={["Code", "Name", "GL", "Balance", "Status", "Actions"]}>
                    {(cash.data ?? []).map((x) => (
                      <TableRow key={x.id}>
                        <TableCell>{x.code}</TableCell>
                        <TableCell>{x.name}</TableCell>
                        <TableCell>{x.glAccountCode}</TableCell>
                        <TableCell>{money.format(x.currentBalance)}</TableCell>
                        <TableCell>
                          <Status value={x.isActive ? "ACTIVE" : "INACTIVE"} />
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => setCashEdit(x)}>
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Grid>
                </div>
              </CardContent>
            </Card>

            {/* Bank Accounts */}
            <Card className="shadow-xs border-slate-200/80">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Bank accounts</CardTitle>
                    <CardDescription>Bank books linked to asset GL accounts.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setBankOpen(true)} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
                    <Plus /> Bank
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mobile Bank Cards (<md) */}
                <div className="md:hidden space-y-3">
                  {(banks.data ?? []).length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10 p-4">
                      No bank accounts recorded.
                    </div>
                  ) : (
                    (banks.data ?? []).map((x) => (
                      <div key={x.id} className="p-4 border rounded-2xl bg-card space-y-3 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{x.bankName}</span>
                          <Badge variant="outline" className="font-mono">GL: {x.glAccountCode}</Badge>
                        </div>
                        <div className="space-y-1 bg-muted/20 p-3 rounded-xl border text-xs text-muted-foreground">
                          <div>Account: <strong className="text-foreground">{x.accountName}</strong></div>
                          <div>Number: <strong className="font-mono text-foreground">••••{x.accountNumber.slice(-4)}</strong></div>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t">
                          <div>
                            <span className="text-xs text-muted-foreground block">Balance</span>
                            <span className="font-medium">{money.format(x.currentBalance)}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setBankEdit(x)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setReconcile(x)}>
                              Reconcile
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table (≥md) */}
                <div className="hidden md:block">
                  <Grid heads={["Bank", "Account", "GL", "Balance", "Actions"]}>
                    {(banks.data ?? []).map((x) => (
                      <TableRow key={x.id}>
                        <TableCell>{x.bankName}</TableCell>
                        <TableCell>
                          {x.accountName}
                          <span className="block text-xs text-muted-foreground">••••{x.accountNumber.slice(-4)}</span>
                        </TableCell>
                        <TableCell>{x.glAccountCode}</TableCell>
                        <TableCell>{money.format(x.currentBalance)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setBankEdit(x)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setReconcile(x)}>
                              Reconcile
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Grid>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- RECONCILIATION TAB --- */}
        <TabsContent value="reconciliation" className="mt-4">
          <Card className="shadow-xs border-slate-200/80">
            <CardHeader>
              <CardTitle>Bank reconciliation history</CardTitle>
              <CardDescription>Statement balance compared with the bank book at the reconciliation date.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile Reconciliation Cards (<md) */}
              <div className="md:hidden space-y-3">
                {(recs.data ?? []).length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10 p-4">
                    No reconciliation history recorded.
                  </div>
                ) : (
                  (recs.data ?? []).map((x) => (
                    <div key={x.id} className="p-4 border rounded-2xl bg-card space-y-3 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{x.bankAccountName}</span>
                        <Status value={x.status} />
                      </div>
                      <div className="space-y-1 bg-muted/20 p-3 rounded-xl border text-xs text-muted-foreground">
                        <div>Statement Date: <strong className="text-foreground">{x.statementDate}</strong></div>
                        <div className="flex justify-between pt-1">
                          <span>Statement: {money.format(x.statementBalance)}</span>
                          <span>Book: {money.format(x.bookBalance)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t">
                        <div>
                          <span className="text-xs text-muted-foreground block">Difference</span>
                          <span className={x.difference !== 0 ? "font-medium text-destructive" : "font-medium text-emerald-600"}>
                            {money.format(x.difference)}
                          </span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setReconciliationDetailId(x.id)}>
                          View
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table (≥md) */}
              <div className="hidden md:block">
                <Grid heads={["Date", "Bank", "Statement", "Book", "Difference", "Status", "Actions"]}>
                  {(recs.data ?? []).map((x) => (
                    <TableRow key={x.id}>
                      <TableCell>{x.statementDate}</TableCell>
                      <TableCell>{x.bankAccountName}</TableCell>
                      <TableCell>{money.format(x.statementBalance)}</TableCell>
                      <TableCell>{money.format(x.bookBalance)}</TableCell>
                      <TableCell className={x.difference !== 0 ? "text-destructive font-medium" : ""}>{money.format(x.difference)}</TableCell>
                      <TableCell>
                        <Status value={x.status} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setReconciliationDetailId(x.id)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </Grid>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- STATEMENTS / REPORTS TAB --- */}
        <TabsContent value="reports" className="mt-4">
          <Reports
            accounts={accts}
            from={from}
            to={to}
            setFrom={setFrom}
            setTo={setTo}
            tb={tb.data}
            bs={bs.data}
            pl={pl.data}
          />
        </TabsContent>
      </Tabs>

      {/* Action Dialogs */}
      <JournalDialog
        open={journalOpen}
        accounts={accts.filter((x) => x.isActive)}
        close={() => setJournalOpen(false)}
        saved={async () => {
          await refresh();
          setJournalOpen(false);
        }}
      />
      <AccountDialog
        value={accountEdit}
        accounts={accts}
        close={() => setAccountEdit(undefined)}
        saved={async () => {
          await refresh();
          setAccountEdit(undefined);
        }}
      />
      <PeriodDialog
        open={periodOpen}
        close={() => setPeriodOpen(false)}
        saved={async () => {
          await refresh();
          setPeriodOpen(false);
        }}
      />
      <CashDialog
        open={cashOpen}
        accounts={accts}
        close={() => setCashOpen(false)}
        saved={async () => {
          await refresh();
          setCashOpen(false);
        }}
      />
      <BankDialog
        open={bankOpen}
        accounts={accts}
        close={() => setBankOpen(false)}
        saved={async () => {
          await refresh();
          setBankOpen(false);
        }}
      />
      <TreasuryEditDialog
        cash={cashEdit}
        bank={bankEdit}
        close={() => {
          setCashEdit(null);
          setBankEdit(null);
        }}
        saved={async () => {
          await refresh();
          setCashEdit(null);
          setBankEdit(null);
        }}
      />
      <ReconciliationDetail id={reconciliationDetailId} close={() => setReconciliationDetailId(null)} />
      <ReconcileDialog
        bank={reconcile}
        close={() => setReconcile(null)}
        saved={async () => {
          await refresh();
          setReconcile(null);
        }}
      />
      <JournalDetail value={detail.data ?? null} loading={detail.isLoading} close={() => setDetailId(null)} />
    </div>
  );
}

function Metric({ icon: Icon, label, value, good }: { icon: typeof Scale; label: string; value: string; good?: boolean }) {
  return (
    <Card className="shadow-xs border-slate-200/80">
      <CardContent className="flex items-center gap-3 pt-5">
        <span className="rounded-lg bg-muted p-2">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={good ? "font-semibold text-emerald-600" : "font-semibold"}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Status({ value }: { value: string }) {
  const good = ["POSTED", "OPEN", "ACTIVE", "COMPLETED"].includes(value);
  return (
    <Badge variant={good ? "secondary" : value === "LOCKED" || value === "DISCREPANCY" ? "destructive" : "outline"}>
      {value}
    </Badge>
  );
}

function Grid({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border rounded-xl">
      <Table>
        <TableHeader>
          <TableRow>
            {heads.map((x) => (
              <TableHead key={x}>{x}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-2 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Picker({ value, set, items }: { value: string; set: (v: string) => void; items: [string, string][] }) {
  return (
    <Select items={Object.fromEntries(items)} value={value} onValueChange={(v) => set(v ?? "")}>
      <SelectTrigger className="w-full h-9">
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent>
        {items.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function JournalDialog({
  open,
  accounts,
  close,
  saved,
}: {
  open: boolean;
  accounts: Account[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [date, setDate] = React.useState(today());
  const [description, setDescription] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [lines, setLines] = React.useState([
    { accountId: "", debit: "", credit: "", memo: "" },
    { accountId: "", debit: "", credit: "", memo: "" },
  ]);

  React.useEffect(() => {
    if (open) {
      setDate(today());
      setDescription("");
      setRef("");
      setLines([
        { accountId: "", debit: "", credit: "", memo: "" },
        { accountId: "", debit: "", credit: "", memo: "" },
      ]);
    }
  }, [open]);

  const debit = lines.reduce((s, x) => s + Number(x.debit || 0), 0);
  const credit = lines.reduce((s, x) => s + Number(x.credit || 0), 0);
  const balanced = debit > 0 && Math.abs(debit - credit) < 0.001;

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post("finance/journal-entries", {
        entryDate: date,
        description,
        referenceType: "MANUAL",
        referenceNumber: ref || null,
        lines: lines.map((x) => ({
          accountId: Number(x.accountId),
          debitAmount: Number(x.debit || 0),
          creditAmount: Number(x.credit || 0),
          memo: x.memo || null,
        })),
      }),
    onSuccess: async () => {
      toast.success("Journal saved as draft; review and post it from the register");
      await saved();
    },
    onError: (e) => toast.error(err(e)),
  });

  const update = (i: number, k: string, v: string) =>
    setLines((x) => x.map((l, n) => (n === i ? { ...l, [k]: v } : l)));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>New manual journal</DialogTitle>
            <DialogDescription>Every line must be debit or credit, and the entry must balance before it can be posted.</DialogDescription>
          </DialogHeader>

          <div className="my-5 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Accounting date">
                <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Description">
                <Input required value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <Field label="Reference">
                <Input value={ref} onChange={(e) => setRef(e.target.value)} />
              </Field>
            </div>

            {lines.map((l, i) => (
              <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-5 items-center">
                <Field label={`Line ${i + 1} account`} className="sm:col-span-2">
                  <Picker
                    value={l.accountId}
                    set={(v) => update(i, "accountId", v)}
                    items={accounts.map((a) => [String(a.id), `${a.code} — ${a.name}`])}
                  />
                </Field>
                <Field label="Debit">
                  <Input
                    type="number"
                    min="0"
                    step=".01"
                    value={l.debit}
                    onChange={(e) => {
                      update(i, "debit", e.target.value);
                      if (Number(e.target.value) > 0) update(i, "credit", "");
                    }}
                  />
                </Field>
                <Field label="Credit">
                  <Input
                    type="number"
                    min="0"
                    step=".01"
                    value={l.credit}
                    onChange={(e) => {
                      update(i, "credit", e.target.value);
                      if (Number(e.target.value) > 0) update(i, "debit", "");
                    }}
                  />
                </Field>
                <Field label="Memo">
                  <Input value={l.memo} onChange={(e) => update(i, "memo", e.target.value)} />
                </Field>
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setLines((x) => [...x, { accountId: "", debit: "", credit: "", memo: "" }])}>
                Add line
              </Button>
              <p className={balanced ? "font-medium text-emerald-600" : "font-medium text-destructive"}>
                Debit {money.format(debit)} · Credit {money.format(credit)} · {balanced ? "Balanced" : "Out of balance"}
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button disabled={!balanced || lines.some((x) => !x.accountId) || mutation.isPending} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
              {mutation.isPending && <Loader2 className="animate-spin" />}Save draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountDialog({
  value,
  accounts,
  close,
  saved,
}: {
  value: Account | null | undefined;
  accounts: Account[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const open = value !== undefined;
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<AccountType>("ASSET");
  const [parent, setParent] = React.useState("none");
  const [control, setControl] = React.useState("none");
  const [active, setActive] = React.useState(true);

  React.useEffect(() => {
    if (open) {
      setCode(value?.code ?? "");
      setName(value?.name ?? "");
      setType(value?.type ?? "ASSET");
      setParent(value?.parentId ? String(value.parentId) : "none");
      setControl(value?.controlType ?? "none");
      setActive(value?.isActive ?? true);
    }
  }, [open, value]);

  const m = useMutation({
    mutationFn: () =>
      value
        ? apiClient.put(`finance/accounts/${value.id}`, { name, parentId: parent === "none" ? null : Number(parent), isActive: active })
        : apiClient.post("finance/accounts", {
            code,
            name,
            type,
            parentId: parent === "none" ? null : Number(parent),
            isControlAccount: control !== "none",
            controlType: control === "none" ? null : control,
          }),
    onSuccess: async () => {
      toast.success(value ? "Account updated" : "Account created");
      await saved();
    },
    onError: (e) => toast.error(err(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{value ? "Edit account" : "New account"}</DialogTitle>
            <DialogDescription>Codes and account types are permanent after creation to protect reporting history.</DialogDescription>
          </DialogHeader>

          <div className="my-5 grid gap-4 sm:grid-cols-2">
            <Field label="Code">
              <Input required disabled={!!value} value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Name">
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Type">
              <Picker value={type} set={(v) => setType(v as AccountType)} items={accountTypes.map((x) => [x, x])} />
            </Field>
            <Field label="Parent">
              <Picker
                value={parent}
                set={setParent}
                items={[["none", "No parent"], ...accounts.filter((x) => x.id !== value?.id).map((x) => [String(x.id), `${x.code} — ${x.name}`] as [string, string])]}
              />
            </Field>
            {!value && (
              <Field label="Operational control">
                <Picker
                  value={control}
                  set={setControl}
                  items={[
                    ["none", "Not a control account"],
                    ...(["AR", "AP", "CASH", "BANK", "INVENTORY", "COGS", "SALES_REVENUE"] as const).map((x) => [x, x] as [string, string]),
                  ]}
                />
              </Field>
            )}
            {value && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Account active
              </label>
            )}
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button disabled={m.isPending} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
              {m.isPending && <Loader2 className="animate-spin" />}Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PeriodDialog({
  open,
  close,
  saved,
}: {
  open: boolean;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const next = new Date().getFullYear() + 1;
  const [year, setYear] = React.useState(String(next));
  const [start, setStart] = React.useState(`${next}-01-01`);
  const [end, setEnd] = React.useState(`${next}-12-31`);

  const m = useMutation({
    mutationFn: () =>
      apiClient.post("finance/fiscal-periods/generate", {
        fiscalYear: Number(year),
        startDate: start,
        endDate: end,
      }),
    onSuccess: async () => {
      toast.success("Twelve fiscal periods generated");
      await saved();
    },
    onError: (e) => toast.error(err(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Generate fiscal year</DialogTitle>
            <DialogDescription>Creates twelve consecutive accounting periods. Existing years cannot be generated again.</DialogDescription>
          </DialogHeader>

          <div className="my-5 grid gap-4">
            <Field label="Fiscal year">
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </Field>
            <Field label="Start date">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button disabled={m.isPending} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
              {m.isPending && <Loader2 className="animate-spin" />}Generate periods
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CashDialog({
  open,
  accounts,
  close,
  saved,
}: {
  open: boolean;
  accounts: Account[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [gl, setGl] = React.useState("");
  const [opening, setOpening] = React.useState("0");

  const m = useMutation({
    mutationFn: () =>
      apiClient.post("finance/cash-accounts", {
        code,
        name,
        glAccountId: Number(gl),
        currency: "INR",
        openingBalance: Number(opening),
      }),
    onSuccess: async () => {
      toast.success("Cash account created");
      await saved();
    },
    onError: (e) => toast.error(err(e)),
  });

  return (
    <SimpleDialog
      open={open}
      title="New cash account"
      description="Create a physical cash book linked to an asset GL account."
      close={close}
      submit={() => m.mutate()}
      pending={m.isPending}
    >
      <Field label="Code">
        <Input required value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <Field label="Name">
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="GL account">
        <Picker value={gl} set={setGl} items={accounts.filter((x) => x.type === "ASSET" && x.isActive).map((x) => [String(x.id), `${x.code} — ${x.name}`])} />
      </Field>
      <Field label="Opening balance">
        <Input type="number" step=".01" value={opening} onChange={(e) => setOpening(e.target.value)} />
      </Field>
    </SimpleDialog>
  );
}

function BankDialog({
  open,
  accounts,
  close,
  saved,
}: {
  open: boolean;
  accounts: Account[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [bank, setBank] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [name, setName] = React.useState("");
  const [swift, setSwift] = React.useState("");
  const [gl, setGl] = React.useState("");
  const [opening, setOpening] = React.useState("0");

  const m = useMutation({
    mutationFn: () =>
      apiClient.post("finance/bank-accounts", {
        bankName: bank,
        accountNumber: number,
        accountName: name,
        swiftCode: swift || null,
        currency: "INR",
        glAccountId: Number(gl),
        openingBalance: Number(opening),
      }),
    onSuccess: async () => {
      toast.success("Bank account created");
      await saved();
    },
    onError: (e) => toast.error(err(e)),
  });

  return (
    <SimpleDialog
      open={open}
      title="New bank account"
      description="Create a bank book linked to an asset GL account."
      close={close}
      submit={() => m.mutate()}
      pending={m.isPending}
    >
      <Field label="Bank name">
        <Input required value={bank} onChange={(e) => setBank(e.target.value)} />
      </Field>
      <Field label="Account number">
        <Input required value={number} onChange={(e) => setNumber(e.target.value)} />
      </Field>
      <Field label="Account name">
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="SWIFT / IFSC">
        <Input value={swift} onChange={(e) => setSwift(e.target.value)} />
      </Field>
      <Field label="GL account">
        <Picker value={gl} set={setGl} items={accounts.filter((x) => x.type === "ASSET" && x.isActive).map((x) => [String(x.id), `${x.code} — ${x.name}`])} />
      </Field>
      <Field label="Opening balance">
        <Input type="number" step=".01" value={opening} onChange={(e) => setOpening(e.target.value)} />
      </Field>
    </SimpleDialog>
  );
}

function ReconcileDialog({
  bank,
  close,
  saved,
}: {
  bank: BankAccount | null;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [date, setDate] = React.useState(today());
  const [balance, setBalance] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (bank) {
      setDate(today());
      setBalance("");
      setNotes("");
    }
  }, [bank]);

  const m = useMutation({
    mutationFn: () =>
      apiClient.post("finance/reconciliations", {
        bankAccountId: bank!.id,
        reconciliationDate: date,
        statementBalance: Number(balance),
        notes: notes || null,
      }),
    onSuccess: async () => {
      toast.success("Bank reconciliation recorded");
      await saved();
    },
    onError: (e) => toast.error(err(e)),
  });

  return (
    <SimpleDialog
      open={!!bank}
      title={`Reconcile ${bank?.accountName ?? "bank"}`}
      description={`Book balance currently shown as ${money.format(bank?.currentBalance ?? 0)}. Enter the closing balance from the bank statement.`}
      close={close}
      submit={() => m.mutate()}
      pending={m.isPending}
    >
      <Field label="Statement date">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Statement balance">
        <Input required type="number" step=".01" value={balance} onChange={(e) => setBalance(e.target.value)} />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </SimpleDialog>
  );
}

function SimpleDialog({
  open,
  title,
  description,
  close,
  submit,
  pending,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  close: () => void;
  submit: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="my-5 grid gap-4 sm:grid-cols-2">{children}</div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button disabled={pending} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
              {pending && <Loader2 className="animate-spin" />}Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Reports({
  accounts,
  from,
  to,
  setFrom,
  setTo,
  tb,
  bs,
  pl,
}: {
  accounts: Account[];
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  tb?: TrialBalance;
  bs?: BalanceSheet;
  pl?: ProfitLoss;
}) {
  const [account, setAccount] = React.useState("");
  const ledger = useQuery({
    queryKey: ["finance", "ledger", account, from, to],
    queryFn: () =>
      apiClient.get<GeneralLedger>(
        `finance/reports/general-ledger?accountId=${account}&startDate=${from}&endDate=${to}&page=0&size=100`
      ),
    enabled: !!account && !!from && !!to,
  });

  return (
    <div className="space-y-4">
      <Card className="shadow-xs border-slate-200/80">
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-3">
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To / as of">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="General ledger account">
            <Picker value={account} set={setAccount} items={accounts.map((x) => [String(x.id), `${x.code} — ${x.name}`])} />
          </Field>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Statement
          title="Trial balance"
          note={tb?.isBalanced ? "Debits equal credits" : "Out of balance"}
          rows={tb?.rows.map((x) => [`${x.accountCode} — ${x.accountName}`, x.netBalance]) ?? []}
          total={tb?.totalDebit ?? 0}
        />
        <Statement
          title="Profit & loss"
          note={`${from} to ${to}`}
          rows={[
            ...(pl?.revenues.rows.map((x) => [`${x.accountCode} — ${x.accountName}`, x.amount] as [string, number]) ?? []),
            ...(pl?.expenses.rows.map((x) => [`${x.accountCode} — ${x.accountName}`, -x.amount] as [string, number]) ?? []),
          ]}
          total={pl?.netProfitLoss ?? 0}
        />
        <Statement
          title="Balance sheet"
          note={bs?.isBalanced ? "Balanced" : "Review retained earnings / opening balances"}
          rows={[
            ...(bs?.assets.rows.map((x) => [`${x.accountCode} — ${x.accountName}`, x.balance] as [string, number]) ?? []),
            ...(bs?.liabilities.rows.map((x) => [`${x.accountCode} — ${x.accountName}`, x.balance] as [string, number]) ?? []),
            ...(bs?.equity.rows.map((x) => [`${x.accountCode} — ${x.accountName}`, x.balance] as [string, number]) ?? []),
          ]}
          total={bs?.totalAssets ?? 0}
        />
        <Statement
          title={ledger.data ? `Ledger: ${ledger.data.accountCode} — ${ledger.data.accountName}` : "General ledger"}
          note={
            ledger.data
              ? `Opening ${money.format(ledger.data.openingBalance)} · Closing ${money.format(ledger.data.closingBalance)}`
              : "Choose an account above"
          }
          rows={
            ledger.data?.transactions.content.map(
              (x) => [`${x.entryDate} · ${x.entryNumber} · ${x.description}`, x.runningBalance]
            ) ?? []
          }
          total={ledger.data?.closingBalance ?? 0}
        />
      </div>
    </div>
  );
}

function Statement({ title, note, rows, total }: { title: string; note: string; rows: [string, number][]; total: number }) {
  return (
    <Card className="shadow-xs border-slate-200/80">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{note}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 space-y-2 overflow-auto pr-1">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posted activity for this selection.</p>
          ) : (
            rows.map(([n, v], i) => (
              <div key={`${n}-${i}`} className="flex justify-between gap-4 border-b py-2 text-sm min-w-0">
                <span className="break-words min-w-0 flex-1">{n}</span>
                <span className="font-medium tabular-nums shrink-0">{money.format(v)}</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-3 flex justify-between border-t pt-3 font-semibold text-sm">
          <span>Total</span>
          <span className="tabular-nums">{money.format(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function JournalDetail({ value, loading, close }: { value: JournalEntry | null; loading: boolean; close: () => void }) {
  return (
    <Dialog open={loading || !!value} onOpenChange={(v) => !v && close()}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#0F3D3E]" />
            <span>Loading journal details...</span>
          </div>
        ) : (
          value && (
            <>
              <DialogHeader>
                <DialogTitle>{value.entryNumber}</DialogTitle>
                <DialogDescription>
                  {value.entryDate} · {value.entryType.replaceAll("_", " ")} · {value.description}
                </DialogDescription>
              </DialogHeader>

              {/* Mobile Lines (<md) */}
              <div className="md:hidden space-y-2 border rounded-xl p-3 bg-muted/10 divide-y">
                {value.lines.map((x) => (
                  <div key={x.id} className="pt-2 pb-1 space-y-1 text-xs">
                    <div className="font-medium text-foreground">{x.accountCode} — {x.accountName}</div>
                    {x.memo && <div className="text-[11px] text-muted-foreground">{x.memo}</div>}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span>Debit: <strong className="font-mono text-foreground">{money.format(x.debitAmount)}</strong></span>
                      <span>Credit: <strong className="font-mono text-foreground">{money.format(x.creditAmount)}</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (≥md) */}
              <div className="hidden md:block">
                <Grid heads={["Account", "Memo", "Debit", "Credit"]}>
                  {value.lines.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell className="font-medium">
                        {x.accountCode} — {x.accountName}
                      </TableCell>
                      <TableCell>{x.memo ?? "—"}</TableCell>
                      <TableCell>{money.format(x.debitAmount)}</TableCell>
                      <TableCell>{money.format(x.creditAmount)}</TableCell>
                    </TableRow>
                  ))}
                </Grid>
              </div>

              <div className="flex justify-end gap-6 font-semibold text-sm pt-2 border-t">
                <span>Debit {money.format(value.totalDebit)}</span>
                <span>Credit {money.format(value.totalCredit)}</span>
              </div>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
