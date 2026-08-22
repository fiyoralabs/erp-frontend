"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, CreditCard, Loader2, Plus, RotateCcw, Search, Store, Users, X } from "lucide-react";
import { toast } from "sonner";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import { localDateInputValue } from "@/lib/date";
import type { Location, PaymentMethod, PriceList } from "@/lib/types/master";
import type { ProductSummary, Variant } from "@/lib/types/product";
import type { Customer, CustomerLedger, SalesInvoice, SalesReturn, Wishlist } from "@/lib/types/sales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CustomerCrmDialog } from "@/components/crm/customer-360/customer-crm-dialog";
import { SalesInvoiceDialog } from "@/components/sales/sales-invoice-dialog";
import { usePaymentMethodsLookup, usePriceListsLookup } from "@/lib/hooks/use-master-data";
// Same responsive filter pattern as CRM Leads: primary Search + Status stay inline, everything
// else (Customer, Date range) lives behind the Filters button so a company with thousands of
// customers never has to render them all into a single dropdown.
import { FiltersButton, FiltersPanel, FilterField } from "@/components/crm/shared/filters-panel";

type Sellable = { productId: number; variantId: number | null; label: string };
type Action = "customer" | "invoice" | "payment" | "return" | null;
const today = localDateInputValue;
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const message = (e: unknown) => (e instanceof ApiRequestError || e instanceof Error ? e.message : "Something went wrong");
const itemKey = (p: number, v: number | null) => `${p}:${v ?? "base"}`;

export function SalesClient() {
  const qc = useQueryClient();
  const [action, setAction] = React.useState<Action>(null);
  const [returnPresetInvoiceId, setReturnPresetInvoiceId] = React.useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [detail, setDetail] = React.useState<SalesInvoice | SalesReturn | null>(null);
  const [ledgerCustomer, setLedgerCustomer] = React.useState<Customer | null>(null);
  const [wishlistCustomer, setWishlistCustomer] = React.useState<Customer | null>(null);
  const [crmCustomerId, setCrmCustomerId] = React.useState<number | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [invoicePage, setInvoicePage] = React.useState(0);

  // Applied Customer/Date filters -- a shop can have thousands of customers, so this is a
  // resolved customerId from a search-as-you-type picker, never a dropdown of every customer.
  const [customerIdFilter, setCustomerIdFilter] = React.useState<number | null>(null);
  const [customerNameFilter, setCustomerNameFilter] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // Draft filter state for the Filters panel -- only committed to the applied state above on "Done".
  const [draftCustomerId, setDraftCustomerId] = React.useState<number | null>(null);
  const [draftCustomerName, setDraftCustomerName] = React.useState("");
  const [draftDateFrom, setDraftDateFrom] = React.useState("");
  const [draftDateTo, setDraftDateTo] = React.useState("");

  const activeFilterCount = (customerIdFilter ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);

  function handleOpenFilters() {
    setDraftCustomerId(customerIdFilter);
    setDraftCustomerName(customerNameFilter);
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setFiltersOpen(true);
  }
  function applyFilters() {
    setCustomerIdFilter(draftCustomerId);
    setCustomerNameFilter(draftCustomerName);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setInvoicePage(0);
  }
  function clearDraftFilters() {
    setDraftCustomerId(null);
    setDraftCustomerName("");
    setDraftDateFrom("");
    setDraftDateTo("");
  }
  function clearAllFilters() {
    setCustomerIdFilter(null);
    setCustomerNameFilter("");
    setDateFrom("");
    setDateTo("");
    setInvoicePage(0);
  }

  const customers = useQuery({ queryKey: ["sales", "customers"], queryFn: () => apiClient.get<PagedResult<Customer>>("sales/customers?page=0&size=100") });
  // Full, unfiltered recent-invoices window -- kept only to back the Returns tab's
  // invoice-number lookup and the Payments tab's payment listing (neither is paginated
  // today; unrelated to the filter below). The Invoices tab itself uses invoicesPageQuery.
  const invoices = useQuery({ queryKey: ["sales", "invoices"], queryFn: () => apiClient.get<PagedResult<SalesInvoice>>("sales/invoices?page=0&size=100") });
  // Server-side paginated + filtered Invoices list -- the actual data source for the
  // Invoices tab, so filtering/paging works correctly regardless of how many invoices
  // or customers the company has (never capped at the first page like the query above).
  const invoicesPageQuery = useQuery({
    queryKey: ["sales", "invoices", "page", invoicePage, customerIdFilter, statusFilter, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(invoicePage), size: "20" });
      if (customerIdFilter) params.set("customerId", String(customerIdFilter));
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      return apiClient.get<PagedResult<SalesInvoice>>(`sales/invoices?${params.toString()}`);
    },
  });
  const returns = useQuery({ queryKey: ["sales", "returns"], queryFn: () => apiClient.get<PagedResult<SalesReturn>>("sales/returns?page=0&size=100") });
  const locations = useQuery({ queryKey: ["master", "locations", "sales"], queryFn: () => apiClient.get<PagedResult<Location>>("master/locations?page=0&size=100") });
  const methods = usePaymentMethodsLookup();
  const priceLists = usePriceListsLookup();

  const sellables = useQuery({
    queryKey: ["sales", "sellables"],
    queryFn: async () => {
      const products = await apiClient.get<PagedResult<ProductSummary>>("products?page=0&size=100");
      return (
        await Promise.all(
          products.content
            .filter((p) => p.isActive)
            .map(async (p) =>
              p.hasVariants
                ? (await apiClient.get<Variant[]>(`products/${p.id}/variants`))
                    .filter((v) => v.isActive)
                    .map((v) => ({ productId: p.id, variantId: v.id, label: `${p.name} — ${v.variantName} (${v.sku})` }))
                : [{ productId: p.id, variantId: null, label: `${p.name} (${p.code})` }]
            )
        )
      ).flat() as Sellable[];
    },
  });

  const refresh = () => Promise.all(["customers", "invoices", "returns"].map((k) => qc.invalidateQueries({ queryKey: ["sales", k] })));
  const c = (customers.data?.content ?? []).filter((x) => x.active);
  const inv = invoices.data?.content ?? [];
  const ret = returns.data?.content ?? [];
  const due = inv.reduce((sum, x) => sum + x.balanceAmount, 0);
  const todaySales = inv.filter((x) => x.invoiceDate === today()).reduce((sum, x) => sum + x.totalAmount, 0);

  // Customer/status/date are already applied server-side (invoicesPageQuery); free-text
  // search only narrows the current page by invoice number, so it stays instant/local.
  const filteredInvoices = React.useMemo(() => {
    const invoicesPage = invoicesPageQuery.data?.content ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return invoicesPage;
    return invoicesPage.filter((item) => item.invoiceNumber.toLowerCase().includes(q));
  }, [invoicesPageQuery.data, searchQuery]);

  return (
    <div className="flex flex-col gap-5 w-full max-w-full">
      {/* Header & Main Actions - Original Typography Locked */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sales</h1>
          <p className="text-sm text-muted-foreground">
            Sell by exact SKU, collect payments, manage customers, and restore stock through controlled returns.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/sales/pos" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto gap-1.5 font-bold border-[#0F3D3E] text-[#0F3D3E] hover:bg-[#0F3D3E]/10">
              <Store className="h-4 w-4" /> Open POS Terminal
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              setSelectedCustomer(null);
              setAction("customer");
            }}
          >
            <Users />
            New customer
          </Button>
        </div>
      </div>

      {/* Metrics Cards - Original Typography Locked */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Today’s sales" value={money.format(todaySales)} />
        <Metric label="Receivables" value={money.format(due)} warn={due > 0} />
        <Metric label="Active customers" value={String(customers.data?.totalElements ?? c.length)} />
      </div>

      {/* Global Search & Filter Bar -- primary Search + Status stay inline; Customer (search-as-
          you-type, never a full dropdown) and Date range live behind the Filters panel. */}
      <Card className="shadow-xs">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val ?? "ALL"); setInvoicePage(0); }}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PAID">Paid / Completed</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid / Due</SelectItem>
                </SelectContent>
              </Select>
              <FiltersButton activeCount={activeFilterCount} onClick={handleOpenFilters} className="h-10" />
            </div>
          </div>

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="text-xs font-semibold text-muted-foreground">Active filters:</span>
              {customerIdFilter && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  Customer: {customerNameFilter}
                  <button type="button" onClick={() => { setCustomerIdFilter(null); setCustomerNameFilter(""); setInvoicePage(0); }} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {(dateFrom || dateTo) && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  Date: {dateFrom || "any"} – {dateTo || "any"}
                  <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setInvoicePage(0); }} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={clearAllFilters}>
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters Panel -- Customer (search-as-you-type) + Date range */}
      <FiltersPanel open={filtersOpen} onOpenChange={setFiltersOpen} activeCount={activeFilterCount} onClearAll={clearDraftFilters} onApply={applyFilters}>
        <FilterField label="Customer">
          <CustomerPicker
            value={draftCustomerId}
            label={draftCustomerName}
            onChange={(id, name) => { setDraftCustomerId(id); setDraftCustomerName(name); }}
          />
        </FilterField>
        <div className="grid grid-cols-2 gap-2">
          <FilterField label="From date">
            <Input type="date" value={draftDateFrom} onChange={(e) => setDraftDateFrom(e.target.value)} />
          </FilterField>
          <FilterField label="To date">
            <Input type="date" value={draftDateTo} onChange={(e) => setDraftDateTo(e.target.value)} />
          </FilterField>
        </div>
      </FiltersPanel>

      {/* Tabs View */}
      <Tabs defaultValue="invoices" className="w-full">
        <div className="border-b overflow-x-auto scrollbar-none">
          <TabsList className="flex h-auto flex-wrap w-max sm:w-auto">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
        </div>

        {/* --- INVOICES TAB --- */}
        <Tab
          value="invoices"
          title="Sales invoices"
          desc="Posted sales immediately deduct stock and create receivables."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setAction("invoice")} className="gap-1.5 bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
                <Plus className="h-4 w-4" /> New invoice
              </Button>
              {due > 0 && (
                <Button variant="outline" onClick={() => setAction("payment")} className="gap-1.5">
                  <CreditCard className="h-4 w-4" /> Record payment
                </Button>
              )}
            </div>
          }
        >
          {/* Mobile Invoices Cards (<md) - Exact Original Typography Locked */}
          <div className="md:hidden space-y-3">
            {filteredInvoices.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10 p-4">
                No sales invoices found matching your criteria.
              </div>
            ) : (
              filteredInvoices.map((x) => {
                const custName = x.customerName ?? `Customer #${x.customerId}`;
                return (
                  <div key={x.id} className="p-4 border rounded-2xl bg-card space-y-3 shadow-xs min-w-0">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="font-medium break-all">{x.invoiceNumber}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {x.returnedAmount > 0 && (
                          <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-500/40">
                            <RotateCcw className="h-3 w-3" /> Returned
                          </Badge>
                        )}
                        <Status value={x.status} />
                      </div>
                    </div>

                    <div className="space-y-1 bg-muted/20 p-3 rounded-xl border">
                      <div className="font-medium min-w-0 break-words">{custName}</div>
                      <div className="text-xs text-muted-foreground">Date: {x.invoiceDate}</div>
                      {x.returnedAmount > 0 && (
                        <div className="text-xs text-amber-700 dark:text-amber-400">Returned: {money.format(x.returnedAmount)}</div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-3 bg-muted/20 rounded-xl border text-center">
                      <div>
                        <span className="text-xs text-muted-foreground block">Total Amount</span>
                        <span className="font-medium">{money.format(x.totalAmount)}</span>
                      </div>
                      <div className="border-l border-slate-200">
                        <span className="text-xs text-muted-foreground block">Balance Due</span>
                        <span className="font-medium text-amber-600">{money.format(x.balanceAmount)}</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => setDetail(x)}>
                        View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setReturnPresetInvoiceId(x.id); setAction("return"); }}>
                        <RotateCcw className="h-3.5 w-3.5" /> Return
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (≥md) - Original Table & Typography */}
          <div className="hidden md:block">
            <Grid heads={["Invoice", "Date", "Customer", "Status", "Total", "Balance", ""]}>
              {filteredInvoices.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-medium">{x.invoiceNumber}</TableCell>
                  <TableCell>{x.invoiceDate}</TableCell>
                  <TableCell>{x.customerName ?? `Customer #${x.customerId}`}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Status value={x.status} />
                      {x.returnedAmount > 0 && (
                        <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-500/40">
                          <RotateCcw className="h-3 w-3" /> Returned
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{money.format(x.totalAmount)}</TableCell>
                  <TableCell className="font-medium">
                    {money.format(x.balanceAmount)}
                    {x.returnedAmount > 0 && (
                      <span className="block text-xs font-normal text-amber-700 dark:text-amber-400">
                        -{money.format(x.returnedAmount)} returned
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetail(x)}>
                        View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setReturnPresetInvoiceId(x.id); setAction("return"); }}>
                        <RotateCcw className="h-3.5 w-3.5" /> Return
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </Grid>
          </div>

          {/* Pagination -- server-side, so this scales regardless of invoice/customer volume */}
          <div className="flex items-center justify-between sm:justify-end gap-2 pt-4">
            <Button variant="outline" size="sm" disabled={invoicePage === 0} onClick={() => setInvoicePage((p) => p - 1)}>Previous</Button>
            <span className="text-xs sm:text-sm text-muted-foreground">
              Page {invoicePage + 1} of {Math.max(1, invoicesPageQuery.data?.totalPages ?? 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={invoicePage + 1 >= (invoicesPageQuery.data?.totalPages ?? 1)}
              onClick={() => setInvoicePage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </Tab>

        {/* --- CUSTOMERS TAB --- */}
        <Tab value="customers" title="Customers" desc="Profiles, preferred store terms, and independently calculated ledger.">
          {/* Mobile Customers Cards (<md) - Exact Original Typography Locked */}
          <div className="md:hidden space-y-3">
            {c.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10 p-4">
                No customers recorded.
              </div>
            ) : (
              c.map((x) => (
                <div key={x.id} className="p-4 border rounded-2xl bg-card space-y-3 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium min-w-0 break-words flex-1">{x.name}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline">{x.code}</Badge>
                      <Status value="ACTIVE" />
                    </div>
                  </div>

                  <div className="space-y-1 bg-muted/20 p-3 rounded-xl border">
                    <div className="text-xs text-muted-foreground">Type: {x.customerType}</div>
                    <div className="text-xs text-muted-foreground">{x.phone || x.email || "No contact"}</div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t">
                    <div>
                      <span className="text-xs text-muted-foreground block">Lifetime Sales</span>
                      <span className="font-medium">{money.format(x.totalPurchaseAmount)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedCustomer(x);
                          setAction("customer");
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setLedgerCustomer(x)}>
                        Ledger
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setCrmCustomerId(x.id)}>
                        CRM
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (≥md) - Original Table & Typography */}
          <div className="hidden md:block">
            <Grid heads={["Code", "Customer", "Type", "Lifetime sales", "Status", ""]}>
              {c.map((x) => (
                <TableRow key={x.id}>
                  <TableCell>{x.code}</TableCell>
                  <TableCell className="font-medium">
                    {x.name}
                    <span className="block text-xs text-muted-foreground">{x.phone || x.email || "No contact"}</span>
                  </TableCell>
                  <TableCell>{x.customerType}</TableCell>
                  <TableCell>{money.format(x.totalPurchaseAmount)}</TableCell>
                  <TableCell>
                    <Status value="ACTIVE" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedCustomer(x);
                          setAction("customer");
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setLedgerCustomer(x)}>
                        Ledger
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setCrmCustomerId(x.id)}>
                        CRM
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </Grid>
          </div>
        </Tab>

        {/* --- RETURNS TAB --- */}
        <Tab
          value="returns"
          title="Sales returns"
          desc="Return quantities are validated against the invoice and tracked goods are added back to Inventory."
          action={
            <Button variant="outline" onClick={() => { setReturnPresetInvoiceId(null); setAction("return"); }}>
              <RotateCcw />
              New return
            </Button>
          }
        >
          {/* Mobile Returns Cards (<md) - Exact Original Typography Locked */}
          <div className="md:hidden space-y-3">
            {ret.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10 p-4">
                No sales returns recorded.
              </div>
            ) : (
              ret.map((x) => {
                const invNum = inv.find((i) => i.id === x.invoiceId)?.invoiceNumber ?? `#${x.invoiceId}`;
                return (
                  <div key={x.id} className="p-4 border rounded-2xl bg-card space-y-3 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{x.returnNumber}</span>
                      <span className="text-xs text-muted-foreground">{x.returnDate}</span>
                    </div>

                    <div className="space-y-1 bg-muted/20 p-3 rounded-xl border">
                      <div className="text-xs text-muted-foreground">Target Invoice: {invNum}</div>
                      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1">
                        <span>Receivable: {money.format(x.receivableAppliedAmount)}</span>
                        <span>Credit: {money.format(x.creditAmount)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t">
                      <div>
                        <span className="text-xs text-muted-foreground block">Return Total</span>
                        <span className="font-medium">{money.format(x.totalAmount)}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setDetail(x)}>
                        View
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (≥md) - Original Table & Typography */}
          <div className="hidden md:block">
            <Grid heads={["Return", "Invoice", "Date", "Total", "Receivable", "Customer credit", ""]}>
              {ret.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-medium">{x.returnNumber}</TableCell>
                  <TableCell>{inv.find((i) => i.id === x.invoiceId)?.invoiceNumber ?? `#${x.invoiceId}`}</TableCell>
                  <TableCell>{x.returnDate}</TableCell>
                  <TableCell>{money.format(x.totalAmount)}</TableCell>
                  <TableCell>{money.format(x.receivableAppliedAmount)}</TableCell>
                  <TableCell>{money.format(x.creditAmount)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setDetail(x)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </Grid>
          </div>
        </Tab>

        {/* --- PAYMENTS TAB --- */}
        <Tab value="payments" title="Customer payments" desc="Invoice collections are reflected in the customer ledger and Finance journals.">
          {/* Mobile Payments Cards (<md) - Exact Original Typography Locked */}
          <div className="md:hidden space-y-3">
            {inv.flatMap((i) => i.payments).length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10 p-4">
                No customer payments recorded.
              </div>
            ) : (
              inv.flatMap((i) =>
                i.payments.map((p) => (
                  <div key={p.id} className="p-4 border rounded-2xl bg-card space-y-3 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Date: {p.paymentDate}</span>
                      <Status value={p.status} />
                    </div>

                    <div className="space-y-1 bg-muted/20 p-3 rounded-xl border">
                      <div className="flex items-center justify-between text-xs">
                        <span>Invoice: <strong className="font-medium">{i.invoiceNumber}</strong></span>
                        <span>{p.paymentMethodName}</span>
                      </div>
                      {p.referenceNumber && <div className="text-xs text-muted-foreground">Ref: {p.referenceNumber}</div>}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t">
                      <div>
                        <span className="text-xs text-muted-foreground block">Amount</span>
                        <span className="font-medium text-emerald-600">{money.format(p.amount)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>

          {/* Desktop Table (≥md) - Original Table & Typography */}
          <div className="hidden md:block">
            <Grid heads={["Date", "Invoice", "Method", "Reference", "Amount", "Status"]}>
              {inv.flatMap((i) =>
                i.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.paymentDate}</TableCell>
                    <TableCell>{i.invoiceNumber}</TableCell>
                    <TableCell>{p.paymentMethodName}</TableCell>
                    <TableCell>{p.referenceNumber ?? "—"}</TableCell>
                    <TableCell>{money.format(p.amount)}</TableCell>
                    <TableCell>
                      <Status value={p.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </Grid>
          </div>
        </Tab>
      </Tabs>

      {/* Action Dialogs */}
      <CustomerDialog
        open={action === "customer"}
        customer={selectedCustomer}
        priceLists={(priceLists.data?.content ?? []).filter((x) => x.isActive)}
        locations={(locations.data?.content ?? []).filter((x) => x.isActive)}
        close={() => setAction(null)}
        saved={async () => {
          await refresh();
          setAction(null);
        }}
      />
      <InvoiceDialog
        open={action === "invoice"}
        customers={c}
        locations={(locations.data?.content ?? []).filter((x) => x.isActive)}
        methods={(methods.data?.content ?? []).filter((x) => x.isActive)}
        sellables={sellables.data ?? []}
        close={() => setAction(null)}
        saved={async () => {
          await refresh();
          setAction(null);
        }}
      />
      <PaymentDialog
        open={action === "payment"}
        invoices={inv.filter((x) => x.balanceAmount > 0)}
        methods={(methods.data?.content ?? []).filter((x) => x.isActive)}
        close={() => setAction(null)}
        saved={async () => {
          await refresh();
          setAction(null);
        }}
      />
      <ReturnDialog
        open={action === "return"}
        presetInvoiceId={returnPresetInvoiceId}
        close={() => { setAction(null); setReturnPresetInvoiceId(null); }}
        saved={async () => {
          await refresh();
          setAction(null);
          setReturnPresetInvoiceId(null);
        }}
      />
      <DetailDialog value={detail} customer={detail ? c.find((x) => x.id === detail.customerId) : undefined} close={() => setDetail(null)} />
      <LedgerDialog customer={ledgerCustomer} close={() => setLedgerCustomer(null)} />
      <WishlistDialog customer={wishlistCustomer} sellables={sellables.data ?? []} close={() => setWishlistCustomer(null)} />
      <CustomerCrmDialog customerId={crmCustomerId} close={() => setCrmCustomerId(null)} />
    </div>
  );
}

// Search-as-you-type customer picker for the Invoices filter -- a company can have thousands
// of customers, so this never loads/renders the full list; it debounces a query against the
// backend's own search and resolves to a single (id, name) pair.
function CustomerPicker({ value, label, onChange }: { value: number | null; label: string; onChange: (id: number | null, name: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [search, setSearch] = React.useState("");
  const query = useQuery({
    queryKey: ["sales", "customers", "picker", search],
    queryFn: () => apiClient.get<PagedResult<Customer>>(`sales/customers?search=${encodeURIComponent(search)}&page=0&size=10`),
    enabled: open && search.trim().length > 0,
  });
  React.useEffect(() => {
    const t = setTimeout(() => setSearch(draft.trim()), 300);
    return () => clearTimeout(t);
  }, [draft]);
  const results = (query.data?.content ?? []).filter((x) => x.active);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-between font-normal" />}>
        <span className="truncate">{value ? label : "Any customer"}</span>
        <ChevronDown />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 pl-8" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search customers by name, code or phone" autoFocus />
        </div>
        <div className="mt-2 max-h-56 overflow-y-auto">
          <button
            type="button"
            className="flex min-h-9 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted"
            onClick={() => { onChange(null, ""); setOpen(false); }}
          >
            Any customer
          </button>
          {!search.trim() ? (
            <p className="p-3 text-center text-sm text-muted-foreground">Start typing to search customers.</p>
          ) : query.isLoading ? (
            <p className="p-3 text-center text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-center text-sm text-muted-foreground">No customers found.</p>
          ) : (
            results.map((cust) => (
              <button
                key={cust.id}
                type="button"
                className={`flex min-h-9 w-full flex-col items-start rounded-md px-2 py-1 text-left text-sm hover:bg-muted ${value === cust.id ? "bg-muted font-medium" : ""}`}
                onClick={() => { onChange(cust.id, cust.name); setOpen(false); }}
              >
                <span className="truncate w-full">{cust.name}</span>
                <span className="text-xs text-muted-foreground">{cust.code}{cust.phone ? ` · ${cust.phone}` : ""}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ORIGINAL TYPOGRAPHY COMPONENT IMPLEMENTATIONS
function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={warn ? "text-2xl font-semibold text-amber-600" : "text-2xl font-semibold"}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Status({ value }: { value: string }) {
  return <Badge variant={["PAID", "POSTED", "ACTIVE"].includes(value) ? "secondary" : "default"}>{value.replaceAll("_", " ")}</Badge>;
}

function Tab({ value, title, desc, action, children }: { value: string; title: string; desc: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <TabsContent value={value} className="mt-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{desc}</CardDescription>
          </div>
          {action}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </TabsContent>
  );
}

function Grid({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border rounded-xl">
      <Table>
        <TableHeader>
          <TableRow>
            {heads.map((h) => (
              <TableHead key={h}>{h}</TableHead>
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
    <div className={"grid gap-2 " + className}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Picker({ value, set, items, placeholder = "Select" }: { value: string; set: (v: string) => void; items: [string, string][]; placeholder?: string }) {
  return (
    <Select items={Object.fromEntries(items)} value={value} onValueChange={(v) => set(v ?? "")}>
      <SelectTrigger className="w-full h-9">
        <SelectValue placeholder={placeholder} />
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

function Footer({ busy, close, label = "Post" }: { busy: boolean; close: () => void; label?: string }) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={close}>
        Cancel
      </Button>
      <Button type="submit" disabled={busy} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
        {busy && <Loader2 className="animate-spin" />}
        {label}
      </Button>
    </DialogFooter>
  );
}

function CustomerDialog({
  open,
  customer,
  priceLists,
  locations,
  close,
  saved,
}: {
  open: boolean;
  customer: Customer | null;
  priceLists: PriceList[];
  locations: Location[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [form, setForm] = React.useState({
    customerType: "INDIVIDUAL",
    name: "",
    phone: "",
    email: "",
    priceListId: "",
    preferredLocationId: "",
    creditLimit: "0",
    creditDays: "0",
    remarks: "",
  });

  React.useEffect(() => {
    if (open)
      setForm({
        customerType: customer?.customerType ?? "INDIVIDUAL",
        name: customer?.name ?? "",
        phone: customer?.phone ?? "",
        email: customer?.email ?? "",
        priceListId: String(customer?.priceListId ?? ""),
        preferredLocationId: String(customer?.preferredLocationId ?? ""),
        creditLimit: String(customer?.creditLimit ?? 0),
        creditDays: String(customer?.creditDays ?? 0),
        remarks: customer?.remarks ?? "",
      });
  }, [open, customer]);

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        priceListId: form.priceListId ? Number(form.priceListId) : null,
        preferredLocationId: form.preferredLocationId ? Number(form.preferredLocationId) : null,
        creditLimit: Number(form.creditLimit),
        creditDays: Number(form.creditDays),
        active: true,
      };
      return customer ? apiClient.put(`sales/customers/${customer.id}`, body) : apiClient.post("sales/customers", body);
    },
    onSuccess: async () => {
      toast.success(customer ? "Customer updated" : "Customer created");
      await saved();
    },
    onError: (e) => toast.error(message(e)),
  });

  const deactivate = useMutation({
    mutationFn: () => apiClient.delete(`sales/customers/${customer!.id}`),
    onSuccess: async () => {
      toast.success("Customer deactivated");
      await saved();
    },
    onError: (e) => toast.error(message(e)),
  });

  const set = (k: string, v: string) => setForm((x) => ({ ...x, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <DialogHeader>
            <DialogTitle>{customer ? "Edit customer" : "New customer"}</DialogTitle>
            <DialogDescription>Enter basic contact information and remarks for the customer record.</DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-4 sm:grid-cols-2">
            <Field label="Customer type">
              <Picker value={form.customerType} set={(v) => set("customerType", v)} items={[["INDIVIDUAL", "Individual"], ["BUSINESS", "Business"]]} />
            </Field>
            <Field label="Name">
              <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Phone">
              <PhoneInput value={form.phone} onChange={(v) => set("phone", v)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Remarks" className="sm:col-span-2">
              <Textarea value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            {customer && (
              <Button type="button" variant="destructive" onClick={() => deactivate.mutate()} disabled={deactivate.isPending}>
                Deactivate
              </Button>
            )}
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
              {mutation.isPending && <Loader2 className="animate-spin" />}Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDialog({
  open,
  customers,
  locations,
  methods,
  sellables,
  close,
  saved,
}: {
  open: boolean;
  customers: Customer[];
  locations: Location[];
  methods: PaymentMethod[];
  sellables: Sellable[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [customer, setCustomer] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [due, setDue] = React.useState(today());
  const [remarks, setRemarks] = React.useState("");
  const [lines, setLines] = React.useState([{ item: "", quantity: "1", price: "", discount: "0" }]);
  const [payment, setPayment] = React.useState({ method: "", amount: "", reference: "" });

  React.useEffect(() => {
    if (open) {
      setCustomer("");
      setLocation(locations.length > 0 ? String(locations[0].id) : "");
      setDate(today());
      setDue(today());
      setRemarks("");
      setLines([{ item: "", quantity: "1", price: "", discount: "0" }]);
      setPayment({ method: "", amount: "", reference: "" });
    }
  }, [open, locations]);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post<SalesInvoice>("sales/invoices", {
        customerId: Number(customer),
        locationId: Number(location),
        invoiceDate: date,
        dueDate: due,
        remarks,
        lines: lines.map((l) => {
          const s = sellables.find((x) => itemKey(x.productId, x.variantId) === l.item);
          if (!s) throw new Error("Select every SKU");
          return {
            productId: s.productId,
            productVariantId: s.variantId,
            quantity: Number(l.quantity),
            sellingPrice: l.price ? Number(l.price) : null,
            discountPercentage: Number(l.discount),
          };
        }),
        payments: payment.amount ? [{ paymentMethodCode: payment.method, amount: Number(payment.amount), paymentDate: date, referenceNumber: payment.reference || null }] : [],
      }),
    onSuccess: async (x) => {
      toast.success(`${x.invoiceNumber} posted — tracked stock reduced`);
      await saved();
    },
    onError: (e) => toast.error(message(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <DialogHeader>
            <DialogTitle>New sales invoice</DialogTitle>
            <DialogDescription>
              Prices and taxes resolve from the customer/location price list. Selling price is only an explicit override.
            </DialogDescription>
          </DialogHeader>

          <div className="my-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Customer">
              <Picker value={customer} set={setCustomer} items={customers.map((x) => [String(x.id), `${x.name} (${x.code})`])} />
            </Field>
            <Field label="Selling location">
              <Picker value={location} set={setLocation} items={locations.map((x) => [String(x.id), x.name])} />
            </Field>
            <Field label="Invoice date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Due date">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Sale items</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setLines((x) => [...x, { item: "", quantity: "1", price: "", discount: "0" }])}>
                <Plus /> Add line
              </Button>
            </div>

            {lines.map((line, n) => (
              <div key={n} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(220px,1fr)_100px_130px_100px_auto]">
                <Picker value={line.item} set={(v) => setLines((x) => x.map((r, i) => (i === n ? { ...r, item: v } : r)))} items={sellables.map((x) => [itemKey(x.productId, x.variantId), x.label])} placeholder="Product / variant" />
                <Input aria-label="Quantity" type="number" min=".001" step=".001" value={line.quantity} onChange={(e) => setLines((x) => x.map((r, i) => (i === n ? { ...r, quantity: e.target.value } : r)))} />
                <Input aria-label="Price override" type="number" min=".01" step=".01" placeholder="Auto price" value={line.price} onChange={(e) => setLines((x) => x.map((r, i) => (i === n ? { ...r, price: e.target.value } : r)))} />
                <Input aria-label="Discount percent" type="number" min="0" max="100" step=".01" value={line.discount} onChange={(e) => setLines((x) => x.map((r, i) => (i === n ? { ...r, discount: e.target.value } : r)))} />
                <Button type="button" variant="ghost" disabled={lines.length === 1} onClick={() => setLines((x) => x.filter((_, i) => i !== n))}>
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="my-5 grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-3">
            <Field label="Payment method (optional)">
              <Picker value={payment.method} set={(v) => setPayment((x) => ({ ...x, method: v }))} items={methods.map((x) => [x.code, x.name])} />
            </Field>
            <Field label="Amount collected">
              <Input type="number" min=".01" step=".01" value={payment.amount} onChange={(e) => setPayment((x) => ({ ...x, amount: e.target.value }))} />
            </Field>
            <Field label="Reference">
              <Input value={payment.reference} onChange={(e) => setPayment((x) => ({ ...x, reference: e.target.value }))} />
            </Field>
          </div>

          <Field label="Remarks">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>

          <Footer busy={mutation.isPending} close={close} label="Post sale" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  open,
  invoices,
  methods,
  close,
  saved,
}: {
  open: boolean;
  invoices: SalesInvoice[];
  methods: PaymentMethod[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [invoice, setInvoice] = React.useState("");
  const [method, setMethod] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [reference, setReference] = React.useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ creditIssuedAmount: number | null; creditNumber: string | null }>(`sales/invoices/${invoice}/payments`, {
        paymentMethodCode: method,
        amount: Number(amount),
        paymentDate: date,
        referenceNumber: reference || null,
        remarks: "Recorded from Sales workspace",
      }),
    onSuccess: async (res) => {
      if (res.creditIssuedAmount) {
        toast.success(`Customer payment posted — ${money.format(res.creditIssuedAmount)} overpaid, saved as store credit ${res.creditNumber ?? ""}`);
      } else {
        toast.success("Customer payment posted");
      }
      await saved();
    },
    onError: (e) => toast.error(message(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <DialogHeader>
            <DialogTitle>Record customer payment</DialogTitle>
            <DialogDescription>The collectible balance is locked and validated by the backend.</DialogDescription>
          </DialogHeader>

          <div className="my-5 grid gap-4 sm:grid-cols-2">
            <Field label="Invoice">
              <Picker value={invoice} set={setInvoice} items={invoices.map((x) => [String(x.id), `${x.invoiceNumber} — due ${money.format(x.balanceAmount)}`])} />
            </Field>
            <Field label="Method">
              <Picker value={method} set={setMethod} items={methods.map((x) => [x.code, x.name])} />
            </Field>
            <Field label="Amount">
              <Input required type="number" min=".01" step=".01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Reference" className="sm:col-span-2">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          </div>

          <Footer busy={mutation.isPending} close={close} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

// A shop can have thousands of invoices, so this never dumps them into a dropdown -- either
// the invoice is already known (opened via the "Return" button on a specific invoice row, see
// presetInvoiceId) or the cashier searches for it by customer (phone/name/code) and/or invoice
// date, and picks from a small server-filtered result list.
function ReturnDialog({
  open,
  presetInvoiceId,
  close,
  saved,
}: {
  open: boolean;
  presetInvoiceId: number | null;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [manualInvoice, setManualInvoice] = React.useState<SalesInvoice | null>(null);
  const [searchCustomerId, setSearchCustomerId] = React.useState<number | null>(null);
  const [searchCustomerName, setSearchCustomerName] = React.useState("");
  const [searchDateFrom, setSearchDateFrom] = React.useState("");
  const [searchDateTo, setSearchDateTo] = React.useState("");
  const [lineId, setLineId] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [reason, setReason] = React.useState("");

  // Reset everything each time the dialog opens (it stays mounted between opens, only the
  // Dialog's own visibility toggles, so state needs an explicit reset rather than relying on
  // unmount). presetInvoiceId's own fetched invoice is derived below, not copied into state.
  React.useEffect(() => {
    if (!open) return;
    setManualInvoice(null);
    setSearchCustomerId(null);
    setSearchCustomerName("");
    setSearchDateFrom("");
    setSearchDateTo("");
    setLineId("");
    setQuantity("");
    setDate(today());
    setReason("");
  }, [open, presetInvoiceId]);

  const presetQuery = useQuery({
    queryKey: ["sales", "returns", "preset-invoice", presetInvoiceId],
    queryFn: () => apiClient.get<SalesInvoice>(`sales/invoices/${presetInvoiceId}`),
    enabled: open && presetInvoiceId != null,
  });
  // Preset mode derives straight from the fetch (no "Change" option, so no local copy needed);
  // search mode is purely whatever the cashier explicitly picked from the result list.
  const selectedInvoice = presetInvoiceId != null ? (presetQuery.data ?? null) : manualInvoice;

  const searchEnabled = open && presetInvoiceId == null && (searchCustomerId != null || !!searchDateFrom || !!searchDateTo);
  const searchQuery = useQuery({
    queryKey: ["sales", "returns", "invoice-search", searchCustomerId, searchDateFrom, searchDateTo],
    queryFn: () => {
      const params = new URLSearchParams({ page: "0", size: "10" });
      if (searchCustomerId) params.set("customerId", String(searchCustomerId));
      if (searchDateFrom) params.set("from", searchDateFrom);
      if (searchDateTo) params.set("to", searchDateTo || searchDateFrom);
      return apiClient.get<PagedResult<SalesInvoice>>(`sales/invoices?${params.toString()}`);
    },
    enabled: searchEnabled,
  });
  const searchResults = searchQuery.data?.content ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post("sales/returns", {
        invoiceId: selectedInvoice!.id,
        returnDate: date,
        reason,
        lines: [{ invoiceItemId: Number(lineId), quantity: Number(quantity), reason }],
      }),
    onSuccess: async () => {
      toast.success("Sales return posted — tracked stock restored");
      await saved();
    },
    onError: (e) => toast.error(message(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Post sales return</DialogTitle>
          <DialogDescription>
            {selectedInvoice
              ? "Select the exact invoice line. The backend prevents returning more than was sold and restores its product variant."
              : "Find the invoice by customer (name, code or phone) and/or invoice date."}
          </DialogDescription>
        </DialogHeader>

        {!selectedInvoice ? (
          <div className="my-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Customer" className="sm:col-span-1">
                <CustomerPicker
                  value={searchCustomerId}
                  label={searchCustomerName}
                  onChange={(id, name) => { setSearchCustomerId(id); setSearchCustomerName(name); }}
                />
              </Field>
              <Field label="From date">
                <Input type="date" value={searchDateFrom} onChange={(e) => setSearchDateFrom(e.target.value)} />
              </Field>
              <Field label="To date">
                <Input type="date" value={searchDateTo} onChange={(e) => setSearchDateTo(e.target.value)} />
              </Field>
            </div>

            <div className="rounded-xl border divide-y max-h-72 overflow-y-auto">
              {!searchEnabled ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Pick a customer and/or a date to find their invoice.</p>
              ) : searchQuery.isLoading ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">No invoices found.</p>
              ) : (
                searchResults.map((inv2) => (
                  <button
                    key={inv2.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-muted"
                    onClick={() => { setManualInvoice(inv2); setLineId(""); }}
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{inv2.invoiceNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {inv2.invoiceDate} · {inv2.customerName ?? `Customer #${inv2.customerId}`}
                      </div>
                    </div>
                    <div className="font-mono text-xs shrink-0">{money.format(inv2.totalAmount)}</div>
                  </button>
                ))
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
            <div className="my-5 space-y-4">
              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3 text-sm">
                <div>
                  <div className="font-medium">{selectedInvoice.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedInvoice.invoiceDate} · {selectedInvoice.customerName ?? `Customer #${selectedInvoice.customerId}`}
                  </div>
                </div>
                {presetInvoiceId == null && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setManualInvoice(null); setLineId(""); }}>
                    Change
                  </Button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Invoice line">
                  <Picker value={lineId} set={setLineId} items={(selectedInvoice.lines ?? []).map((x) => [String(x.id), `${x.productName} ${x.variantName ?? ""} — sold ${x.quantity}`])} />
                </Field>
                <Field label="Return quantity">
                  <Input required type="number" min=".001" step=".001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </Field>
                <Field label="Return date">
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Reason" className="sm:col-span-2">
                  <Textarea required value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
              </div>
            </div>

            <Footer busy={mutation.isPending} close={close} label="Post return" />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({
  value,
  customer,
  close,
}: {
  value: SalesInvoice | SalesReturn | null;
  customer?: Customer;
  close: () => void;
}) {
  return <SalesInvoiceDialog open={!!value} invoice={value} customer={customer} onClose={close} />;
}

function LedgerDialog({ customer, close }: { customer: Customer | null; close: () => void }) {
  const q = useQuery({
    queryKey: ["sales", "ledger", customer?.id],
    queryFn: () => apiClient.get<CustomerLedger>(`sales/customers/${customer!.id}/ledger?page=0&size=100`),
    enabled: !!customer,
  });

  return (
    <Dialog open={!!customer} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{customer?.name} ledger</DialogTitle>
          <DialogDescription>Outstanding: {money.format(q.data?.summary.outstandingBalance ?? 0)}</DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Grid heads={["Date", "Type", "Document", "Receivable effect"]}>
            {(q.data?.transactions.content ?? []).map((x, n) => (
              <TableRow key={n}>
                <TableCell>{x.businessDate}</TableCell>
                <TableCell>{x.entryType}</TableCell>
                <TableCell>{x.documentNumber}</TableCell>
                <TableCell>{money.format(x.receivableEffect)}</TableCell>
              </TableRow>
            ))}
          </Grid>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WishlistDialog({ customer, sellables, close }: { customer: Customer | null; sellables: Sellable[]; close: () => void }) {
  const qc = useQueryClient();
  const [item, setItem] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [remarks, setRemarks] = React.useState("");

  const q = useQuery({
    queryKey: ["sales", "wishlist", customer?.id],
    queryFn: () => apiClient.get<Wishlist>(`sales/customers/${customer!.id}/wishlist`),
    enabled: !!customer,
    retry: false,
  });

  const save = useMutation({
    mutationFn: () => {
      const s = sellables.find((x) => itemKey(x.productId, x.variantId) === item);
      if (!s) throw new Error("Select an item");
      const body = { remarks, items: [{ productId: s.productId, productVariantId: s.variantId, quantity: Number(quantity), remarks }] };
      return q.data ? apiClient.put(`sales/customers/${customer!.id}/wishlist`, body) : apiClient.post(`sales/customers/${customer!.id}/wishlist`, body);
    },
    onSuccess: async () => {
      toast.success("Wishlist saved");
      await qc.invalidateQueries({ queryKey: ["sales", "wishlist", customer?.id] });
    },
    onError: (e) => toast.error(message(e)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiClient.delete(`sales/customers/${customer!.id}/wishlist/items/${id}`),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["sales", "wishlist", customer?.id] }),
    onError: (e) => toast.error(message(e)),
  });

  return (
    <Dialog open={!!customer} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer?.name} wishlist</DialogTitle>
          <DialogDescription>Record requested product variants for follow-up and future conversion.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Product / variant">
            <Picker value={item} set={setItem} items={sellables.map((x) => [itemKey(x.productId, x.variantId), x.label])} />
          </Field>
          <Field label="Quantity">
            <Input type="number" min=".001" step=".001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Remarks" className="sm:col-span-2">
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>
        </div>

        {(q.data?.items ?? []).map((x) => (
          <div key={x.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
            <span>
              {sellables.find((s) => s.productId === x.productId && s.variantId === x.productVariantId)?.label ?? `Product #${x.productId}`} · {x.quantity}
            </span>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(x.id)}>
              Remove
            </Button>
          </div>
        ))}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Close
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-[#0F3D3E] text-white hover:bg-[#0c3132]">
            {save.isPending && <Loader2 className="animate-spin" />}
            {q.data ? "Replace wishlist" : "Create wishlist"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
