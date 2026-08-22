"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileCheck,
  FileUp,
  Loader2,
  Package,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Truck,
  Undo2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import { localDateInputValue } from "@/lib/date";
import type { Location, PaymentMethod, Tax } from "@/lib/types/master";
import type { ProductSummary, Variant } from "@/lib/types/product";
import type {
  GoodsReceipt,
  PurchaseInvoice,
  PurchaseOrder,
  PurchasePayment,
  PurchaseReturn,
  Supplier,
  SupplierLedger,
} from "@/lib/types/purchase";
import type { InventoryStock } from "@/lib/types/inventory";
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
import { usePaymentMethodsLookup, useTaxesLookup } from "@/lib/hooks/use-master-data";

type Sellable = { productId: number; variantId: number | null; label: string };
type Action = "supplier" | "order" | "receipt" | "invoice" | "payment" | "return" | null;
const today = localDateInputValue;
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const err = (e: unknown) => (e instanceof ApiRequestError || e instanceof Error ? e.message : "Something went wrong");
const key = (p: number, v: number | null) => `${p}:${v ?? "base"}`;

type WorkingLocationContext = { activeLocation: Location | null; allowedLocations: Location[]; locationRequired: boolean };

export function PurchasesClient() {
  const qc = useQueryClient();
  const [action, setAction] = React.useState<Action>(null);
  const [detail, setDetail] = React.useState<PurchaseOrder | GoodsReceipt | PurchaseInvoice | PurchaseReturn | PurchasePayment | null>(null);
  const [ledgerSupplier, setLedgerSupplier] = React.useState<Supplier | null>(null);
  const [historySupplier, setHistorySupplier] = React.useState<Supplier | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [supplierFilter, setSupplierFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  const locationContextQuery = useQuery({
    queryKey: ["users", "me", "context"],
    queryFn: () => apiClient.get<WorkingLocationContext>("users/me/context"),
  });
  const activeLocation = locationContextQuery.data?.activeLocation ?? null;

  const suppliers = useQuery({
    queryKey: ["purchase", "suppliers"],
    queryFn: () => apiClient.get<Supplier[]>("purchases/suppliers"),
  });
  const orders = useQuery({
    queryKey: ["purchase", "orders", activeLocation?.id],
    enabled: !!activeLocation,
    queryFn: () => apiClient.get<PurchaseOrder[]>(`purchases/orders?locationId=${activeLocation!.id}`),
  });
  const receipts = useQuery({
    queryKey: ["purchase", "receipts", activeLocation?.id],
    enabled: !!activeLocation,
    queryFn: () => apiClient.get<GoodsReceipt[]>(`purchases/goods-receipts?locationId=${activeLocation!.id}`),
  });
  const invoices = useQuery({
    queryKey: ["purchase", "invoices", activeLocation?.id],
    enabled: !!activeLocation,
    queryFn: () => apiClient.get<PurchaseInvoice[]>(`purchases/invoices?locationId=${activeLocation!.id}`),
  });
  const returns = useQuery({
    queryKey: ["purchase", "returns", activeLocation?.id],
    enabled: !!activeLocation,
    queryFn: () => apiClient.get<PurchaseReturn[]>(`purchases/returns?locationId=${activeLocation!.id}`),
  });
  const payments = useQuery({
    queryKey: ["purchase", "payments"],
    queryFn: () => apiClient.get<PurchasePayment[]>("purchases/payments"),
  });
  const locations = useQuery({
    queryKey: ["master", "locations", "purchase"],
    queryFn: () => apiClient.get<PagedResult<Location>>("master/locations?page=0&size=100"),
  });
  const taxes = useTaxesLookup();
  const methods = usePaymentMethodsLookup();
  const stockQuery = useQuery({
    queryKey: ["inventory", "stock", activeLocation?.id],
    enabled: !!activeLocation,
    queryFn: () => apiClient.get<InventoryStock[]>(`inventory?locationId=${activeLocation!.id}`),
  });
  const sellables = useQuery({
    queryKey: ["purchase", "sellables"],
    queryFn: async () => {
      const p = await apiClient.get<PagedResult<ProductSummary>>("products?page=0&size=100");
      return (
        await Promise.all(
          p.content
            .filter((x) => x.isActive)
            .map(async (x) =>
              x.hasVariants
                ? (await apiClient.get<Variant[]>(`products/${x.id}/variants`))
                    .filter((v) => v.isActive)
                    .map((v) => ({ productId: x.id, variantId: v.id, label: `${x.name} — ${v.variantName} (${v.sku})` }))
                : [{ productId: x.id, variantId: null, label: `${x.name} (${x.code})` }]
            )
        )
      ).flat() as Sellable[];
    },
  });

  const refresh = () =>
    Promise.all(["suppliers", "orders", "receipts", "invoices", "returns", "payments"].map((x) => qc.invalidateQueries({ queryKey: ["purchase", x] })));

  const o = orders.data ?? [];
  const r = receipts.data ?? [];
  const i = invoices.data ?? [];
  const sList = suppliers.data ?? [];
  const stockItems = stockQuery.data ?? [];

  const stockMap = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of stockItems) {
      const k = `${item.productId}:${item.productVariantId ?? "base"}`;
      map.set(k, item.availableQuantity ?? item.quantityOnHand ?? 0);
    }
    return map;
  }, [stockItems]);

  const toReceive = o.filter((x) => x.status !== "RECEIVED").length;
  const toInvoice = r.filter((x) => !i.some((y) => y.goodsReceiptId === x.id)).length;
  const due = i.reduce((a, x) => a + x.balanceAmount, 0);

  // Filtered Orders
  const filteredOrders = React.useMemo(() => {
    return o.filter((po) => {
      if (supplierFilter !== "ALL" && String(po.supplierId) !== supplierFilter) return false;
      if (statusFilter !== "ALL" && po.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchPO = po.poNumber.toLowerCase().includes(q);
        const matchSup = po.supplierName.toLowerCase().includes(q);
        const matchLines = po.lines && po.lines.some((l) => (l.productName && l.productName.toLowerCase().includes(q)) || (l.sku && l.sku.toLowerCase().includes(q)) || (l.barcode && l.barcode.toLowerCase().includes(q)));
        if (!matchPO && !matchSup && !matchLines) return false;
      }
      return true;
    });
  }, [o, supplierFilter, statusFilter, searchQuery]);

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full max-w-full">
      {/* Header & Main Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Purchases</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Order, receive, verify supplier invoices, pay, and track supplier product history in one workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAction("supplier")} className="h-9 text-xs font-semibold gap-1">
            <Plus className="h-3.5 w-3.5" />
            Supplier
          </Button>
          <Link href="/purchases/new">
            <Button size="sm" className="h-9 text-xs font-semibold gap-1 bg-primary text-primary-foreground">
              <Plus className="h-3.5 w-3.5" />
              Purchase order
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Metric label="Orders to receive" value={String(toReceive)} warn={toReceive > 0} />
        <Metric label="Receipts to invoice" value={String(toInvoice)} warn={toInvoice > 0} />
        <Metric label="Supplier amount due" value={money.format(due)} warn={due > 0} />
      </div>

      {/* Global Search & Filter Bar */}
      <Card className="shadow-xs">
        <CardContent className="p-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO #, supplier, product name, SKU or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Select value={supplierFilter} onValueChange={(val) => setSupplierFilter(val ?? "ALL")}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
                  <SelectValue placeholder="Filter by Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Suppliers</SelectItem>
                  {sList.filter((s) => s.isActive).map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "ALL")}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ORDERED">Ordered / Approved</SelectItem>
                  <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                  <SelectItem value="RECEIVED">Received</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs View */}
      <Tabs defaultValue="orders" className="w-full">
        <div className="border-b overflow-x-auto scrollbar-none">
          <TabsList className="h-10 p-1 justify-start flex-nowrap bg-muted/40 w-max sm:w-auto">
            <TabsTrigger value="orders" className="text-xs font-semibold">Orders</TabsTrigger>
            <TabsTrigger value="receipts" className="text-xs font-semibold">Goods receipts</TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs font-semibold">Invoices</TabsTrigger>
            <TabsTrigger value="suppliers" className="text-xs font-semibold">Suppliers</TabsTrigger>
            <TabsTrigger value="returns" className="text-xs font-semibold">Returns</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs font-semibold">Payments</TabsTrigger>
          </TabsList>
        </div>

        {/* --- ORDERS TAB --- */}
        <Tab
          value="orders"
          title="Purchase orders"
          desc="Approved commitments, supplier tracking, and receipt progress."
          action={
            toReceive > 0 ? (
              <Link href="/purchases">
                <Button size="sm" onClick={() => setAction("receipt")} className="h-8 text-xs gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  Receive goods
                </Button>
              </Link>
            ) : undefined
          }
        >
          {/* Mobile Orders Cards (<md) */}
          <div className="md:hidden space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border rounded-xl bg-muted/10 p-4">
                No purchase orders found matching your search and filter criteria.
              </div>
            ) : (
              filteredOrders.map((x) => {
                const totalQty = x.lines ? x.lines.reduce((a, l) => a + (l.orderedQuantity ?? l.quantity ?? 0), 0) : 0;
                const recQty = x.lines ? x.lines.reduce((a, l) => a + (l.receivedQuantity ?? l.acceptedQuantity ?? 0), 0) : 0;
                const pendQty = Math.max(0, totalQty - recQty);
                const prodCount = x.lines ? x.lines.length : 0;

                return (
                  <div key={x.id} className="p-3.5 border rounded-xl bg-card space-y-3 shadow-xs min-w-0">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="font-bold text-sm text-foreground font-mono truncate">{x.poNumber}</span>
                      <Status text={x.status} />
                    </div>

                    <div className="text-xs space-y-1 bg-muted/20 p-2.5 rounded-lg border">
                      <div className="font-bold text-sm text-foreground break-words">{x.supplierName}</div>
                      <div className="flex flex-wrap items-center justify-between text-muted-foreground text-[11px] pt-1">
                        <span>{prodCount} Product{prodCount === 1 ? "" : "s"} • {x.locationName}</span>
                        <span>Date: {x.orderDate}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted/20 rounded-lg border text-center text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-medium">Ordered Qty</span>
                        <span className="font-bold font-mono text-foreground">{totalQty}</span>
                      </div>
                      <div className="border-x">
                        <span className="text-[10px] text-muted-foreground block font-medium">Received</span>
                        <span className="font-bold font-mono text-emerald-600">{recQty}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-medium">Pending</span>
                        <span className="font-bold font-mono text-amber-600">{pendQty}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Amount</span>
                        <span className="font-bold text-sm text-foreground font-mono">{money.format(x.totalAmount)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {["APPROVED", "PARTIALLY_RECEIVED", "ORDERED"].includes(x.status) && (
                          <Link href={`/purchases/receive?poId=${x.id}`}>
                            <Button size="sm" className="gap-1 h-8 text-xs font-semibold px-2.5">
                              <Truck className="h-3.5 w-3.5" /> Receive
                            </Button>
                          </Link>
                        )}
                        <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={() => setDetail(x)}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (≥md) */}
          <div className="hidden md:block">
            <TableWrap heads={["PO #", "Supplier", "Products", "Total Qty", "Received", "Pending", "Purchase Amount", "Status", "Date", "Warehouse", "Actions"]}>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground text-xs">
                    No purchase orders found matching your search and filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((x) => {
                  const totalQty = x.lines ? x.lines.reduce((a, l) => a + (l.orderedQuantity ?? l.quantity ?? 0), 0) : 0;
                  const recQty = x.lines ? x.lines.reduce((a, l) => a + (l.receivedQuantity ?? l.acceptedQuantity ?? 0), 0) : 0;
                  const pendQty = Math.max(0, totalQty - recQty);
                  const prodCount = x.lines ? x.lines.length : 0;

                  return (
                    <TableRow key={x.id}>
                      <TableCell className="font-medium text-xs font-mono">{x.poNumber}</TableCell>
                      <TableCell className="font-medium text-xs">{x.supplierName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{prodCount} {prodCount === 1 ? "Product" : "Products"}</TableCell>
                      <TableCell className="text-xs font-semibold text-right">{totalQty}</TableCell>
                      <TableCell className="text-xs text-right">{recQty}</TableCell>
                      <TableCell className="text-xs text-right font-bold text-amber-600">{pendQty}</TableCell>
                      <TableCell className="text-xs font-semibold">{money.format(x.totalAmount)}</TableCell>
                      <TableCell>
                        <Status text={x.status} />
                      </TableCell>
                      <TableCell className="text-xs">{x.orderDate}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{x.locationName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {["APPROVED", "PARTIALLY_RECEIVED", "ORDERED"].includes(x.status) && (
                            <Link href={`/purchases/receive?poId=${x.id}`}>
                              <Button size="sm" className="gap-1 h-7 text-xs">
                                <Truck className="h-3.5 w-3.5" />
                                Receive
                              </Button>
                            </Link>
                          )}
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDetail(x)}>
                            View Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableWrap>
          </div>
        </Tab>

        {/* --- GOODS RECEIPTS TAB --- */}
        <Tab value="receipts" title="Goods receipts" desc="Accepted stock is already reflected in Inventory.">
          {/* Mobile Receipts Cards (<md) */}
          <div className="md:hidden space-y-3">
            {r.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border rounded-xl bg-muted/10 p-4">
                No goods receipts recorded.
              </div>
            ) : (
              r.map((x) => {
                const isAlreadyInvoiced = i.some((inv) => String(inv.goodsReceiptId) === String(x.id));
                return (
                  <div key={x.id} className="p-3.5 border rounded-xl bg-card space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-foreground font-mono">{x.grnNumber}</span>
                      {isAlreadyInvoiced ? (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-normal py-0.5 px-2 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Invoiced
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Pending Invoice</Badge>
                      )}
                    </div>

                    <div className="text-xs space-y-1 bg-muted/20 p-2.5 rounded-lg border">
                      <div className="font-bold text-sm text-foreground break-words">{x.supplierName}</div>
                      <div className="flex flex-wrap items-center justify-between text-muted-foreground text-[11px] pt-1">
                        <span>PO: <strong className="font-mono text-foreground">{x.poNumber}</strong> • {x.locationName}</span>
                        <span>Date: {x.receiptDate}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t text-xs">
                      <span className="text-muted-foreground">{x.lines.length} Line item(s)</span>
                      <div className="flex items-center gap-1.5">
                        {!isAlreadyInvoiced && (
                          <Link href={`/purchases/invoice/new?grnId=${x.id}`}>
                            <Button size="sm" className="gap-1 h-8 text-xs font-semibold px-2.5">
                              <ReceiptText className="h-3.5 w-3.5" /> Post Invoice
                            </Button>
                          </Link>
                        )}
                        <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={() => setDetail(x)}>
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (≥md) */}
          <div className="hidden md:block">
            <TableWrap heads={["GRN", "PO", "Supplier", "Location", "Date", "Lines", "Actions"]}>
              {r.map((x) => {
                const isAlreadyInvoiced = i.some((inv) => String(inv.goodsReceiptId) === String(x.id));
                return (
                  <TableRow key={x.id}>
                    <TableCell className="font-medium font-mono">{x.grnNumber}</TableCell>
                    <TableCell className="font-mono text-xs">{x.poNumber}</TableCell>
                    <TableCell>{x.supplierName}</TableCell>
                    <TableCell>{x.locationName}</TableCell>
                    <TableCell>{x.receiptDate}</TableCell>
                    <TableCell>{x.lines.length}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isAlreadyInvoiced ? (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-normal py-1 px-2.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Invoiced
                          </Badge>
                        ) : (
                          <Link href={`/purchases/invoice/new?grnId=${x.id}`}>
                            <Button size="sm" className="gap-1">
                              <ReceiptText className="h-3.5 w-3.5" />
                              Post invoice
                            </Button>
                          </Link>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setDetail(x)}>
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableWrap>
          </div>
        </Tab>

        {/* --- INVOICES TAB --- */}
        <Tab value="invoices" title="Supplier invoices" desc="Balances are tied to payments, returns, supplier ledger, and Finance journals.">
          {/* Mobile Invoices Cards (<md) */}
          <div className="md:hidden space-y-3">
            {i.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border rounded-xl bg-muted/10 p-4">
                No supplier invoices recorded.
              </div>
            ) : (
              i.map((x) => (
                <div key={x.id} className="p-3.5 border rounded-xl bg-card space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-foreground font-mono">{x.invoiceNumber}</span>
                    <Status text={x.status} />
                  </div>

                  <div className="text-xs space-y-1 bg-muted/20 p-2.5 rounded-lg border">
                    <div className="font-bold text-sm text-foreground break-words">{x.supplierName}</div>
                    <div className="flex flex-wrap items-center justify-between text-muted-foreground text-[11px] pt-1">
                      <span>GRN: <strong className="font-mono text-foreground">{x.grnNumber}</strong></span>
                      <span>Due: {x.dueDate ?? "—"}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Balance Due</span>
                      <span className="font-bold text-sm text-amber-600 font-mono">{money.format(x.balanceAmount)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {x.balanceAmount > 0 && (
                        <Link href={`/purchases/payment/new?invoiceId=${x.id}`}>
                          <Button size="sm" className="gap-1 h-8 text-xs font-semibold px-2.5">
                            <WalletCards className="h-3.5 w-3.5" /> Pay
                          </Button>
                        </Link>
                      )}
                      <Link href={`/purchases/return/new?invoiceId=${x.id}`}>
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1 px-2.5 text-amber-700 border-amber-200">
                          <Undo2 className="h-3.5 w-3.5" /> Return
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={() => setDetail(x)}>
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (≥md) */}
          <div className="hidden md:block">
            <TableWrap heads={["Invoice", "Supplier", "GRN", "Due", "Status", "Balance", "Actions"]}>
              {i.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-medium font-mono">{x.invoiceNumber}</TableCell>
                  <TableCell>{x.supplierName}</TableCell>
                  <TableCell className="font-mono text-xs">{x.grnNumber}</TableCell>
                  <TableCell>{x.dueDate ?? "—"}</TableCell>
                  <TableCell>
                    <Status text={x.status} />
                  </TableCell>
                  <TableCell className="font-medium font-mono">{money.format(x.balanceAmount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {x.balanceAmount > 0 && (
                        <Link href={`/purchases/payment/new?invoiceId=${x.id}`}>
                          <Button size="sm" className="gap-1">
                            <WalletCards className="h-3.5 w-3.5" />
                            Record payment
                          </Button>
                        </Link>
                      )}
                      <Link href={`/purchases/return/new?invoiceId=${x.id}`}>
                        <Button size="sm" variant="outline" className="gap-1 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/40">
                          <Undo2 className="h-3.5 w-3.5" />
                          Return
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => setDetail(x)}>
                        View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableWrap>
          </div>
        </Tab>

        {/* --- SUPPLIERS TAB --- */}
        <Tab value="suppliers" title="Suppliers" desc="Outstanding balances and supplier product history.">
          {/* Mobile Suppliers Cards (<md) */}
          <div className="md:hidden space-y-3">
            {sList.filter((x) => x.isActive).length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border rounded-xl bg-muted/10 p-4">
                No active suppliers.
              </div>
            ) : (
              sList
                .filter((x) => x.isActive)
                .map((x) => (
                  <div key={x.id} className="p-3.5 border rounded-xl bg-card space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-sm text-foreground break-words min-w-0 flex-1">{x.name}</h3>
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0">{x.code}</Badge>
                    </div>

                    <div className="text-xs space-y-0.5 bg-muted/20 p-2.5 rounded-lg border text-muted-foreground">
                      {x.contactPerson && <div>Contact: <strong className="text-foreground">{x.contactPerson}</strong></div>}
                      {x.phone && <div>Phone: <strong className="text-foreground">{x.phone}</strong></div>}
                      {!x.contactPerson && !x.phone && <div>No contact details</div>}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Outstanding Balance</span>
                        <span className="font-bold text-sm text-foreground font-mono">{money.format(x.outstandingBalance)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1 px-2.5" onClick={() => setHistorySupplier(x)}>
                          <Package className="h-3.5 w-3.5" /> Products
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={() => setLedgerSupplier(x)}>
                          Ledger
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Desktop Table (≥md) */}
          <div className="hidden md:block">
            <TableWrap heads={["Code", "Supplier Name", "Contact", "Outstanding", "Status", "Actions"]}>
              {sList
                .filter((x) => x.isActive)
                .map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="font-mono text-xs">{x.code}</TableCell>
                    <TableCell className="font-medium">{x.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {x.contactPerson ? <div>{x.contactPerson}</div> : null}
                      {x.phone ? <div>{x.phone}</div> : null}
                      {!x.contactPerson && !x.phone ? "—" : null}
                    </TableCell>
                    <TableCell className="font-semibold font-mono">{money.format(x.outstandingBalance)}</TableCell>
                    <TableCell>
                      <Status text="ACTIVE" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setHistorySupplier(x)}>
                          <Package className="h-3.5 w-3.5" /> Product History
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLedgerSupplier(x)}>
                          Ledger
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableWrap>
          </div>
        </Tab>

        {/* --- RETURNS TAB --- */}
        <Tab
          value="returns"
          title="Purchase returns"
          desc="Posted returns reduce original receipt batch and supplier balance."
          action={
            <Link href="/purchases">
              <Button variant="outline" size="sm" onClick={() => setAction("return")} className="h-8 text-xs">
                New return
              </Button>
            </Link>
          }
        >
          {/* Mobile Returns Cards (<md) */}
          <div className="md:hidden space-y-3">
            {(returns.data ?? []).length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border rounded-xl bg-muted/10 p-4">
                No purchase returns recorded.
              </div>
            ) : (
              (returns.data ?? []).map((x) => (
                <div key={x.id} className="p-3.5 border rounded-xl bg-card space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-foreground font-mono">{x.returnNumber}</span>
                    <span className="text-xs text-muted-foreground">Date: {x.returnDate}</span>
                  </div>

                  <div className="text-xs space-y-1 bg-muted/20 p-2.5 rounded-lg border">
                    <div className="font-bold text-sm text-foreground break-words">{x.supplierName}</div>
                    <div className="text-[11px] text-muted-foreground">Invoice: <strong className="font-mono text-foreground">{x.invoiceNumber}</strong></div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Return Amount</span>
                      <span className="font-bold text-sm text-foreground font-mono">{money.format(x.totalAmount)}</span>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={() => setDetail(x)}>
                      View Details
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (≥md) */}
          <div className="hidden md:block">
            <TableWrap heads={["Return", "Invoice", "Supplier", "Date", "Total", "Action"]}>
              {(returns.data ?? []).map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-medium font-mono">{x.returnNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{x.invoiceNumber}</TableCell>
                  <TableCell>{x.supplierName}</TableCell>
                  <TableCell>{x.returnDate}</TableCell>
                  <TableCell className="font-semibold font-mono">{money.format(x.totalAmount)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setDetail(x)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableWrap>
          </div>
        </Tab>

        {/* --- PAYMENTS TAB --- */}
        <Tab value="payments" title="Supplier payments" desc="Posted payments are reflected in supplier ledger and Finance.">
          {/* Mobile Payments Cards (<md) */}
          <div className="md:hidden space-y-3">
            {(payments.data ?? []).length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border rounded-xl bg-muted/10 p-4">
                No supplier payments recorded.
              </div>
            ) : (
              (payments.data ?? []).map((x) => (
                <div key={x.id} className="p-3.5 border rounded-xl bg-card space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Date: {x.paymentDate}</span>
                    <Status text={x.status} />
                  </div>

                  <div className="text-xs space-y-1 bg-muted/20 p-2.5 rounded-lg border">
                    <div className="font-bold text-sm text-foreground break-words">{x.supplierName ?? "—"}</div>
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Invoice: <strong className="font-mono text-foreground">{x.invoiceNumber ? x.invoiceNumber : `#${x.purchaseInvoiceId}`}</strong></span>
                      <span>{x.paymentMethodCode.replaceAll("_", " ")}</span>
                    </div>
                    {x.referenceNumber && <div className="text-[10px] font-mono text-muted-foreground">Ref: {x.referenceNumber}</div>}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Amount Paid</span>
                      <span className="font-bold text-sm text-emerald-600 font-mono">{money.format(x.amount)}</span>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={() => setDetail(x)}>
                      View Details
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (≥md) */}
          <div className="hidden md:block">
            <TableWrap heads={["Date", "Invoice", "Supplier", "Method", "Reference", "Amount", "Status", "Actions"]}>
              {(payments.data ?? []).map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="text-xs">{x.paymentDate}</TableCell>
                  <TableCell className="font-mono text-xs">{x.invoiceNumber ? x.invoiceNumber : `Invoice #${x.purchaseInvoiceId}`}</TableCell>
                  <TableCell className="font-medium">{x.supplierName ?? "—"}</TableCell>
                  <TableCell className="text-xs">{x.paymentMethodCode.replaceAll("_", " ")}</TableCell>
                  <TableCell className="font-mono text-xs">{x.referenceNumber ?? "—"}</TableCell>
                  <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{money.format(x.amount)}</TableCell>
                  <TableCell>
                    <Status text={x.status} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setDetail(x)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableWrap>
          </div>
        </Tab>
      </Tabs>

      <ActionDialog
        action={action}
        close={() => setAction(null)}
        saved={async () => {
          await refresh();
          setAction(null);
        }}
        activeLocation={activeLocation}
        suppliers={sList}
        orders={o}
        receipts={r}
        invoices={i}
        locations={(locations.data?.content ?? []).filter((x) => x.isActive)}
        taxes={(taxes.data?.content ?? []).filter((x) => x.isActive)}
        methods={(methods.data?.content ?? []).filter((x) => x.isActive)}
        sellables={sellables.data ?? []}
      />
      <DetailDialog value={detail} close={() => setDetail(null)} stockMap={stockMap} suppliers={sList} />
      <LedgerDialog supplier={ledgerSupplier} close={() => setLedgerSupplier(null)} />
      <SupplierProductsHistoryDialog supplier={historySupplier} close={() => setHistorySupplier(null)} orders={o} />
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Card className="shadow-xs">
      <CardContent className="p-3.5 sm:p-5 space-y-1">
        <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{label}</p>
        <p className={warn ? "text-xl sm:text-2xl font-bold text-amber-600 font-mono" : "text-xl sm:text-2xl font-bold font-mono"}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Status({ text }: { text: string }) {
  return <Badge variant={["PAID", "RECEIVED", "POSTED", "ACTIVE"].includes(text) ? "secondary" : "default"}>{text.replaceAll("_", " ")}</Badge>;
}

function Tab({ value, title, desc, action, children }: { value: string; title: string; desc: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <TabsContent value={value} className="mt-4 space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6 border-b flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{desc}</CardDescription>
          </div>
          {action}
        </CardHeader>
        <CardContent className="p-3 sm:p-6">{children}</CardContent>
      </Card>
    </TabsContent>
  );
}

function TableWrap({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border rounded-xl">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            {heads.map((h, n) => (
              <TableHead key={n}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

function ActionDialog({
  action,
  close,
  saved,
  activeLocation,
  suppliers,
  orders,
  receipts,
  invoices,
  locations,
  taxes,
  methods,
  sellables,
}: {
  action: Action;
  close: () => void;
  saved: () => Promise<void>;
  activeLocation: Location | null;
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  receipts: GoodsReceipt[];
  invoices: PurchaseInvoice[];
  locations: Location[];
  taxes: Tax[];
  methods: PaymentMethod[];
  sellables: Sellable[];
}) {
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [supplierId, setSupplierId] = React.useState("");
  const [poId, setPoId] = React.useState("");
  const [grnId, setGrnId] = React.useState("");
  const [invoiceId, setInvoiceId] = React.useState("");

  React.useEffect(() => {
    if (action) {
      setCode("");
      setName("");
      setContact("");
      setPhone("");
      setEmail("");
      setGstin("");
      setSupplierId(suppliers[0] ? String(suppliers[0].id) : "");
      setPoId(orders[0] ? String(orders[0].id) : "");
      setGrnId(receipts[0] ? String(receipts[0].id) : "");
      setInvoiceId(invoices[0] ? String(invoices[0].id) : "");
    }
  }, [action, suppliers, orders, receipts, invoices]);

  const mutSupplier = useMutation({
    mutationFn: () => apiClient.post<Supplier>("suppliers", { code, name, contactPerson: contact || null, phone: phone || null, email: email || null, gstNumber: gstin || null }),
    onSuccess: async () => {
      toast.success("Supplier created");
      await saved();
    },
    onError: (e) => toast.error(err(e)),
  });

  return (
    <Dialog open={action != null} onOpenChange={(x) => { if (!x) close(); }}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        {action === "supplier" ? (
          <form onSubmit={(e) => { e.preventDefault(); mutSupplier.mutate(); }}>
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-bold">New supplier</DialogTitle>
              <DialogDescription className="text-xs">Create a supplier profile for purchase orders, inventory receipts, and invoices.</DialogDescription>
            </DialogHeader>

            <div className="my-4 grid gap-3 sm:grid-cols-2 text-xs">
              <Field label="Code"><Input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="SUP-001" className="text-xs h-9" /></Field>
              <Field label="Name"><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Suppliers Pvt Ltd" className="text-xs h-9" /></Field>
              <Field label="Contact person"><Input value={contact} onChange={(e) => setContact(e.target.value)} className="text-xs h-9" /></Field>
              <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="text-xs h-9" /></Field>
              <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="text-xs h-9" /></Field>
              <Field label="GSTIN / Tax ID"><Input value={gstin} onChange={(e) => setGstin(e.target.value)} className="text-xs h-9 font-mono" /></Field>
            </div>

            <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close} className="h-9 text-xs">Cancel</Button>
              <Button disabled={mutSupplier.isPending} className="h-9 text-xs bg-primary text-primary-foreground font-semibold">
                {mutSupplier.isPending && <Loader2 className="animate-spin h-3.5 w-3.5" />}Save supplier
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div>
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-bold">Quick Workflow Action</DialogTitle>
              <DialogDescription className="text-xs">Choose the item to proceed with the transaction step.</DialogDescription>
            </DialogHeader>

            <div className="my-4 space-y-3 text-xs">
              {action === "receipt" && (
                <Field label="Select Purchase Order">
                  <Select items={Object.fromEntries(orders.map((x) => [String(x.id), `${x.poNumber} — ${x.supplierName}`]))} value={poId} onValueChange={(v) => setPoId(v ?? "")}>
                    <SelectTrigger className="w-full h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{orders.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.poNumber} — {x.supplierName}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}

              {action === "invoice" && (
                <Field label="Select Goods Receipt">
                  <Select items={Object.fromEntries(receipts.map((x) => [String(x.id), `${x.grnNumber} — ${x.supplierName}`]))} value={grnId} onValueChange={(v) => setGrnId(v ?? "")}>
                    <SelectTrigger className="w-full h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{receipts.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.grnNumber} — {x.supplierName}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}

              {action === "payment" && (
                <Field label="Select Supplier Invoice">
                  <Select items={Object.fromEntries(invoices.map((x) => [String(x.id), `${x.invoiceNumber} — ${x.supplierName} (${money.format(x.balanceAmount)} due)`]))} value={invoiceId} onValueChange={(v) => setInvoiceId(v ?? "")}>
                    <SelectTrigger className="w-full h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{invoices.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.invoiceNumber} — {x.supplierName} ({money.format(x.balanceAmount)} due)</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}

              {action === "return" && (
                <Field label="Select Supplier Invoice to Return">
                  <Select items={Object.fromEntries(invoices.map((x) => [String(x.id), `${x.invoiceNumber} — ${x.supplierName}`]))} value={invoiceId} onValueChange={(v) => setInvoiceId(v ?? "")}>
                    <SelectTrigger className="w-full h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{invoices.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.invoiceNumber} — {x.supplierName}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
            </div>

            <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={close} className="h-9 text-xs">Cancel</Button>
              {action === "receipt" && poId && (
                <Link href={`/purchases/receive?poId=${poId}`}>
                  <Button onClick={close} className="h-9 text-xs font-semibold">Continue to Receipt</Button>
                </Link>
              )}
              {action === "invoice" && grnId && (
                <Link href={`/purchases/invoice/new?grnId=${grnId}`}>
                  <Button onClick={close} className="h-9 text-xs font-semibold">Continue to Invoice</Button>
                </Link>
              )}
              {action === "payment" && invoiceId && (
                <Link href={`/purchases/payment/new?invoiceId=${invoiceId}`}>
                  <Button onClick={close} className="h-9 text-xs font-semibold">Continue to Payment</Button>
                </Link>
              )}
              {action === "return" && invoiceId && (
                <Link href={`/purchases/return/new?invoiceId=${invoiceId}`}>
                  <Button onClick={close} className="h-9 text-xs font-semibold">Continue to Return</Button>
                </Link>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({
  value,
  close,
  stockMap,
  suppliers,
}: {
  value: PurchaseOrder | GoodsReceipt | PurchaseInvoice | PurchaseReturn | PurchasePayment | null;
  close: () => void;
  stockMap: Map<string, number>;
  suppliers: Supplier[];
}) {
  if (!value) return null;

  const isPayment = "amount" in value && !("lines" in value);
  const ref = "poNumber" in value ? value.poNumber : "grnNumber" in value ? value.grnNumber : "invoiceNumber" in value ? (value as any).invoiceNumber : "returnNumber" in value ? (value as any).returnNumber : "—";
  const supplier = "supplierName" in value ? (value as any).supplierName : "—";
  const supplierId = "supplierId" in value ? (value as any).supplierId : null;
  const supplierObj = suppliers.find((s) => s.id === supplierId);
  const date = "orderDate" in value ? (value as any).orderDate : "receiptDate" in value ? (value as any).receiptDate : "invoiceDate" in value ? (value as any).invoiceDate : "returnDate" in value ? (value as any).returnDate : "paymentDate" in value ? (value as any).paymentDate : "—";
  const location = "locationName" in value ? (value as any).locationName : "—";
  const lines = "lines" in value ? (value.lines as any[]) : [];
  const total = "totalAmount" in value ? (value as any).totalAmount : "amount" in value ? (value as any).amount : 0;
  const paid = "paidAmount" in value ? (value as any).paidAmount : null;
  const balance = "balanceAmount" in value ? (value as any).balanceAmount : null;

  return (
    <Dialog open={!!value} onOpenChange={(x) => { if (!x) close(); }}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-base sm:text-lg font-bold">
            <span className="font-mono truncate">{ref}</span>
            <Status text={String(value.status)} />
          </DialogTitle>
          <DialogDescription className="text-xs">
            {supplier} • {date} • {location}
          </DialogDescription>
        </DialogHeader>

        {isPayment ? (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg border bg-muted/20">
              <div>
                <span className="text-muted-foreground block">Target Invoice:</span>
                <strong className="text-sm font-mono font-bold">
                  {(value as { invoiceNumber?: string }).invoiceNumber ?? `Invoice #${(value as { purchaseInvoiceId?: number }).purchaseInvoiceId}`}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground block">Payment Date:</span>
                <strong className="text-sm">{date}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block">Payment Method:</span>
                <strong className="text-sm">{String((value as { paymentMethodCode?: string }).paymentMethodCode).replaceAll("_", " ")}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20">
              <div>
                <span className="text-xs text-muted-foreground block">Transaction Reference / UTR #</span>
                <strong className="text-sm font-mono">{(value as { referenceNumber?: string }).referenceNumber ?? "—"}</strong>
              </div>
              <div className="sm:text-right">
                <span className="text-xs text-muted-foreground block">Amount Paid</span>
                <strong className="text-xl font-bold text-emerald-600 font-mono">{money.format(total ?? 0)}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-3.5 rounded-xl border text-xs">
              <div className="space-y-1">
                <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Purchase Information</div>
                <div><span className="text-muted-foreground">PO / Doc Number: </span><strong className="font-mono">{ref}</strong></div>
                <div><span className="text-muted-foreground">Order / Document Date: </span><strong>{date}</strong></div>
                {(value as { expectedDate?: string }).expectedDate && (
                  <div><span className="text-muted-foreground">Expected Delivery: </span><strong>{(value as { expectedDate?: string }).expectedDate}</strong></div>
                )}
                <div><span className="text-muted-foreground">Receiving Warehouse: </span><strong>{location}</strong></div>
                <div className="flex items-center gap-1 mt-1"><span className="text-muted-foreground">Status: </span><Status text={String(value.status)} /></div>
              </div>

              <div className="space-y-1 sm:border-l sm:pl-3 pt-2 sm:pt-0 border-t sm:border-t-0">
                <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Supplier Details</div>
                <div className="font-bold text-sm text-foreground break-words">{supplier} {supplierObj?.code && <Badge variant="outline" className="text-[10px] font-mono ml-1">{supplierObj.code}</Badge>}</div>
                {supplierObj?.contactPerson && <div><span className="text-muted-foreground">Contact: </span><strong>{supplierObj.contactPerson}</strong></div>}
                {supplierObj?.phone && <div><span className="text-muted-foreground">Phone: </span><strong>{supplierObj.phone}</strong></div>}
                {supplierObj?.email && <div className="break-all"><span className="text-muted-foreground">Email: </span><strong>{supplierObj.email}</strong></div>}
                {supplierObj?.gstNumber && <div><span className="text-muted-foreground">GSTIN: </span><strong className="font-mono">{supplierObj.gstNumber}</strong></div>}
              </div>
            </div>

            {/* Line Items Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purchased Items ({lines.length})</div>
              </div>

              {/* Mobile Item List (<md) */}
              <div className="md:hidden space-y-2.5 border rounded-xl p-2.5 bg-muted/10 divide-y">
                {lines.map((x, n) => {
                  const ordered = (x as { orderedQuantity?: number; quantity?: number }).orderedQuantity ?? (x as { quantity?: number }).quantity ?? 1;
                  const received = (x as { receivedQuantity?: number; acceptedQuantity?: number }).receivedQuantity ?? (x as { acceptedQuantity?: number }).acceptedQuantity ?? 0;
                  const pending = Math.max(0, ordered - received);
                  const price = (x as { unitPrice?: number; purchasePrice?: number }).unitPrice ?? (x as { purchasePrice?: number }).purchasePrice ?? 0;
                  const discount = (x as { discountAmount?: number }).discountAmount ?? 0;
                  const taxAmt = (x as { taxAmount?: number }).taxAmount ?? 0;
                  const lineTotal = (x as { lineTotal?: number }).lineTotal ?? ordered * price - discount + taxAmt;

                  const sKey = `${x.productId}:${x.productVariantId ?? "base"}`;
                  const currentStock = stockMap.has(sKey) ? stockMap.get(sKey)! : 0;

                  return (
                    <div key={n} className="pt-2 pb-1 space-y-1.5 text-xs">
                      <div className="font-bold text-foreground break-words">{x.productName}</div>
                      {x.variantName && <div className="text-[11px] text-muted-foreground">{x.variantName}</div>}
                      {x.sku && <div className="text-[10px] font-mono text-muted-foreground">SKU: {x.sku}</div>}

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span>Ordered: <strong className="text-foreground">{ordered}</strong> • Received: <strong className="text-emerald-600">{received}</strong> • Pending: <strong className="text-amber-600">{pending}</strong></span>
                        <span className="font-bold text-foreground font-mono">{money.format(lineTotal)}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Unit Rate: {money.format(price)} • Warehouse Stock: <strong className="text-primary font-mono">{currentStock} units</strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (≥md) */}
              <div className="hidden md:block">
                <TableWrap heads={["Product & Variant", "SKU", "Ordered", "Received", "Pending", "Unit Price (₹)", "Discount", "Tax", "Line Total", "Warehouse Stock", "Status"]}>
                  {lines.map((x, n) => {
                    const ordered = (x as { orderedQuantity?: number; quantity?: number }).orderedQuantity ?? (x as { quantity?: number }).quantity ?? 1;
                    const received = (x as { receivedQuantity?: number; acceptedQuantity?: number }).receivedQuantity ?? (x as { acceptedQuantity?: number }).acceptedQuantity ?? 0;
                    const pending = Math.max(0, ordered - received);
                    const price = (x as { unitPrice?: number; purchasePrice?: number }).unitPrice ?? (x as { purchasePrice?: number }).purchasePrice ?? 0;
                    const discount = (x as { discountAmount?: number }).discountAmount ?? 0;
                    const taxPct = (x as { taxPercentage?: number }).taxPercentage ?? 0;
                    const taxAmt = (x as { taxAmount?: number }).taxAmount ?? 0;
                    const lineTotal = (x as { lineTotal?: number }).lineTotal ?? ordered * price - discount + taxAmt;

                    const sKey = `${x.productId}:${x.productVariantId ?? "base"}`;
                    const currentStock = stockMap.has(sKey) ? stockMap.get(sKey)! : 0;

                    let lineStatus = "Pending";
                    if (received >= ordered && ordered > 0) lineStatus = "Received";
                    else if (received > 0 && received < ordered) lineStatus = "Partially Received";

                    return (
                      <TableRow key={n}>
                        <TableCell className="font-medium text-xs">
                          <div className="break-words">{x.productName}</div>
                          {x.variantName && <span className="block text-[10px] text-muted-foreground">{x.variantName}</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{x.sku ?? "—"}</TableCell>
                        <TableCell className="font-semibold text-xs text-right font-mono">{ordered}</TableCell>
                        <TableCell className="text-xs text-right text-emerald-600 font-medium font-mono">{received}</TableCell>
                        <TableCell className="text-xs text-right font-bold text-amber-600 font-mono">{pending}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{money.format(price)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground text-right font-mono">{discount > 0 ? money.format(discount) : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground text-right">{taxPct > 0 ? `${taxPct}%` : "—"}</TableCell>
                        <TableCell className="font-semibold text-xs text-right font-mono">{money.format(lineTotal)}</TableCell>
                        <TableCell className="text-xs text-right font-bold tabular-nums text-primary font-mono">{currentStock} units</TableCell>
                        <TableCell>
                          <Badge variant={lineStatus === "Received" ? "secondary" : lineStatus === "Partially Received" ? "outline" : "default"} className="text-[10px]">
                            {lineStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableWrap>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-muted/30 border text-xs text-right">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Amount</span>
                <strong className="text-sm font-bold text-foreground font-mono">{money.format(total ?? 0)}</strong>
              </div>
              {paid != null && (
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Amount Paid</span>
                  <strong className="text-sm font-bold text-emerald-600 font-mono">{money.format(paid)}</strong>
                </div>
              )}
              {balance != null && (
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Balance Due</span>
                  <strong className="text-sm font-bold text-amber-600 font-mono">{money.format(balance)}</strong>
                </div>
              )}
              <div className="text-left sm:text-right">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Warehouse</span>
                <strong className="text-xs font-semibold text-foreground truncate block">{location}</strong>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LedgerDialog({ supplier, close }: { supplier: Supplier | null; close: () => void }) {
  const q = useQuery({
    queryKey: ["purchase", "ledger", supplier?.id],
    enabled: !!supplier,
    queryFn: () => apiClient.get<SupplierLedger>(`suppliers/${supplier!.id}/ledger?page=0&size=100`),
  });

  return (
    <Dialog open={!!supplier} onOpenChange={(x) => { if (!x) close(); }}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-bold break-words">{supplier?.name} Ledger</DialogTitle>
          <DialogDescription className="text-xs">
            Outstanding Balance: <strong className="font-mono text-emerald-600 font-bold">{money.format(q.data?.outstandingBalance ?? 0)}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Mobile Ledger Cards (<md) */}
        <div className="md:hidden space-y-2 border rounded-xl p-2.5 bg-muted/10 divide-y">
          {(q.data?.transactions.content ?? []).length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">No ledger transactions found.</div>
          ) : (
            (q.data?.transactions.content ?? []).map((x, n) => (
              <div key={n} className="pt-2 pb-1 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{x.type}</span>
                  <span className="font-bold text-emerald-600 font-mono">{money.format(x.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-mono">Ref: {x.reference}</span>
                  <span>Date: {x.date}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table (≥md) */}
        <div className="hidden md:block">
          <TableWrap heads={["Date", "Type", "Reference", "Amount"]}>
            {(q.data?.transactions.content ?? []).map((x, n) => (
              <TableRow key={n}>
                <TableCell className="text-xs">{x.date}</TableCell>
                <TableCell className="text-xs">{x.type}</TableCell>
                <TableCell className="text-xs font-mono">{x.reference}</TableCell>
                <TableCell className="text-xs font-semibold font-mono">{money.format(x.amount)}</TableCell>
              </TableRow>
            ))}
          </TableWrap>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SupplierProductsHistoryDialog({ supplier, close, orders }: { supplier: Supplier | null; close: () => void; orders: PurchaseOrder[] }) {
  if (!supplier) return null;

  const supplierOrders = orders.filter((po) => po.supplierId === supplier.id);

  const supplierProductsMap = new Map<
    string,
    {
      productId: number;
      variantId: number | null;
      productName: string;
      variantName: string | null;
      sku: string | null;
      lastDate: string;
      lastPrice: number;
      totalPurchased: number;
      pendingQty: number;
      status: string;
    }
  >();

  for (const po of supplierOrders) {
    if (!po.lines) continue;
    for (const line of po.lines) {
      const k = `${line.productId}:${line.productVariantId ?? "base"}`;
      const ordered = line.orderedQuantity ?? line.quantity ?? 0;
      const received = line.receivedQuantity ?? line.acceptedQuantity ?? 0;
      const pending = Math.max(0, ordered - received);
      const price = line.unitPrice ?? line.purchasePrice ?? 0;

      if (!supplierProductsMap.has(k)) {
        supplierProductsMap.set(k, {
          productId: line.productId,
          variantId: line.productVariantId,
          productName: line.productName,
          variantName: line.variantName,
          sku: line.sku,
          lastDate: po.orderDate,
          lastPrice: price,
          totalPurchased: ordered,
          pendingQty: pending,
          status: po.status,
        });
      } else {
        const item = supplierProductsMap.get(k)!;
        item.totalPurchased += ordered;
        item.pendingQty += pending;
        if (new Date(po.orderDate).getTime() > new Date(item.lastDate).getTime()) {
          item.lastDate = po.orderDate;
          item.lastPrice = price;
          item.status = po.status;
        }
      }
    }
  }

  const supplierProductsList = Array.from(supplierProductsMap.values());

  return (
    <Dialog open={!!supplier} onOpenChange={(x) => { if (!x) close(); }}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold break-words">
            <ShoppingBag className="h-5 w-5 text-primary shrink-0" /> Products Purchased from {supplier.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Supplier Code: <strong className="font-mono">{supplier.code}</strong> • Total POs: <strong>{supplierOrders.length}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Mobile History Cards (<md) */}
        <div className="md:hidden space-y-2.5">
          {supplierProductsList.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground border rounded-xl bg-muted/10 p-4">
              No products have been purchased from this supplier yet.
            </div>
          ) : (
            supplierProductsList.map((p, idx) => (
              <div key={idx} className="p-3 border rounded-xl bg-card space-y-2 text-xs shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-foreground break-words">{p.productName}</h4>
                    {p.variantName && <Badge variant="secondary" className="px-1.5 py-0 text-[10px] mt-0.5">{p.variantName}</Badge>}
                  </div>
                  <Status text={p.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 p-2 bg-muted/20 rounded-lg border text-[11px]">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Last Price</span>
                    <strong className="font-mono font-bold text-foreground">{money.format(p.lastPrice)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Last Date</span>
                    <strong className="text-muted-foreground">{p.lastDate}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t">
                  <span>Total Purchased: <strong className="font-mono text-foreground">{p.totalPurchased}</strong></span>
                  <span>Pending: <strong className="font-mono text-amber-600">{p.pendingQty}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table (≥md) */}
        <div className="hidden md:block">
          <TableWrap heads={["Product & Variant", "SKU", "Last Purchase Date", "Last Price (₹)", "Total Purchased Qty", "Pending Qty", "Status"]}>
            {supplierProductsList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground text-xs">
                  No products have been purchased from this supplier yet.
                </TableCell>
              </TableRow>
            ) : (
              supplierProductsList.map((p, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium text-xs">
                    <div className="break-words">{p.productName}</div>
                    {p.variantName && <span className="block text-[10px] text-muted-foreground">{p.variantName}</span>}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{p.sku ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.lastDate}</TableCell>
                  <TableCell className="text-xs font-semibold font-mono">{money.format(p.lastPrice)}</TableCell>
                  <TableCell className="text-xs text-right font-semibold font-mono">{p.totalPurchased}</TableCell>
                  <TableCell className="text-xs text-right font-bold text-amber-600 font-mono">{p.pendingQty}</TableCell>
                  <TableCell>
                    <Status text={p.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableWrap>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-semibold">{label}</Label>{children}</div>;
}
