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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchases</h1>
          <p className="text-sm text-muted-foreground">Order, receive, verify supplier invoices, pay, and track supplier product history in one connected workspace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAction("supplier")}>
            <Plus />
            Supplier
          </Button>
          <Link href="/purchases/new">
            <Button>
              <Plus />
              Purchase order
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Orders to receive" value={String(toReceive)} warn={toReceive > 0} />
        <Metric label="Receipts to invoice" value={String(toInvoice)} warn={toInvoice > 0} />
        <Metric label="Supplier amount due" value={money.format(due)} warn={due > 0} />
      </div>

      {/* Global Search & Filter Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO #, supplier, product name, SKU or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={supplierFilter} onValueChange={(val) => setSupplierFilter(val ?? "ALL")}>
                <SelectTrigger className="w-[180px] h-9 text-xs">
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
                <SelectTrigger className="w-[160px] h-9 text-xs">
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

      <Tabs defaultValue="orders">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="receipts">Goods receipts</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <Tab
          value="orders"
          title="Purchase orders"
          desc="Approved commitments, supplier tracking, and receipt progress."
          action={
            toReceive > 0 ? (
              <Link href="/purchases">
                <Button onClick={() => setAction("receipt")}>
                  <Truck />
                  Receive goods
                </Button>
              </Link>
            ) : undefined
          }
        >
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
        </Tab>

        <Tab value="receipts" title="Goods receipts" desc="Accepted stock is already reflected in Inventory.">
          <TableWrap heads={["GRN", "PO", "Supplier", "Location", "Date", "Lines", "Actions"]}>
            {r.map((x) => {
              const isAlreadyInvoiced = i.some((inv) => String(inv.goodsReceiptId) === String(x.id));
              return (
                <TableRow key={x.id}>
                  <TableCell className="font-medium">{x.grnNumber}</TableCell>
                  <TableCell>{x.poNumber}</TableCell>
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
        </Tab>

        <Tab value="invoices" title="Supplier invoices" desc="Balances are tied to payments, returns, supplier ledger, and Finance journals.">
          <TableWrap heads={["Invoice", "Supplier", "GRN", "Due", "Status", "Balance", "Actions"]}>
            {i.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.invoiceNumber}</TableCell>
                <TableCell>{x.supplierName}</TableCell>
                <TableCell>{x.grnNumber}</TableCell>
                <TableCell>{x.dueDate ?? "—"}</TableCell>
                <TableCell>
                  <Status text={x.status} />
                </TableCell>
                <TableCell className="font-medium">{money.format(x.balanceAmount)}</TableCell>
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
        </Tab>

        <Tab value="suppliers" title="Suppliers" desc="Outstanding balances and supplier product history.">
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
                  <TableCell className="font-semibold">{money.format(x.outstandingBalance)}</TableCell>
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
        </Tab>

        <Tab
          value="returns"
          title="Purchase returns"
          desc="Posted returns reduce the original receipt batch and supplier balance."
          action={
            <Link href="/purchases">
              <Button variant="outline" onClick={() => setAction("return")}>
                New return
              </Button>
            </Link>
          }
        >
          <TableWrap heads={["Return", "Invoice", "Supplier", "Date", "Total", ""]}>
            {(returns.data ?? []).map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.returnNumber}</TableCell>
                <TableCell>{x.invoiceNumber}</TableCell>
                <TableCell>{x.supplierName}</TableCell>
                <TableCell>{x.returnDate}</TableCell>
                <TableCell>{money.format(x.totalAmount)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setDetail(x)}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableWrap>
        </Tab>

        <Tab value="payments" title="Supplier payments" desc="Posted payments are reflected in supplier ledger and Finance.">
          <TableWrap heads={["Date", "Invoice", "Supplier", "Method", "Reference", "Amount", "Status", "Actions"]}>
            {(payments.data ?? []).map((x) => (
              <TableRow key={x.id}>
                <TableCell>{x.paymentDate}</TableCell>
                <TableCell>{x.invoiceNumber ? x.invoiceNumber : `Invoice #${x.purchaseInvoiceId}`}</TableCell>
                <TableCell className="font-medium">{x.supplierName ?? "—"}</TableCell>
                <TableCell>{x.paymentMethodCode.replaceAll("_", " ")}</TableCell>
                <TableCell className="font-mono text-xs">{x.referenceNumber ?? "—"}</TableCell>
                <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">{money.format(x.amount)}</TableCell>
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
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={warn ? "text-2xl font-semibold text-amber-600" : "text-2xl font-semibold"}>{value}</p>
      </CardContent>
    </Card>
  );
}
function Status({ text }: { text: string }) {
  return <Badge variant={["PAID", "RECEIVED", "POSTED", "ACTIVE"].includes(text) ? "secondary" : "default"}>{text.replaceAll("_", " ")}</Badge>;
}
function Tab({ value, title, desc, action, children }: { value: string; title: string; desc: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <TabsContent value={value} className="mt-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between">
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
function TableWrap({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
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
  const [supplier, setSupplier] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [document, setDocument] = React.useState("");
  const [item, setItem] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [other, setOther] = React.useState("");
  const [tax, setTax] = React.useState("");
  const [method, setMethod] = React.useState("");
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (action) {
      setSupplier("");
      setLocation(activeLocation ? String(activeLocation.id) : "");
      setDocument("");
      setItem("");
      setQuantity("");
      setPrice("");
      setDate(today());
      setOther("");
      setTax("");
      setMethod("");
      setReason("");
    }
  }, [action, activeLocation]);

  const mutation = useMutation({
    mutationFn: async () => {
      const sku = sellables.find((x) => key(x.productId, x.variantId) === item);
      if (action === "supplier") return apiClient.post("suppliers", { code: other, name: reason, creditLimit: 0, paymentTermsDays: 30 });
      if (action === "order") {
        if (!sku) throw new Error("Select an item");
        return apiClient.post("purchases/orders", {
          supplierId: Number(supplier),
          locationId: Number(location),
          orderDate: date,
          expectedDate: other || null,
          lines: [{ productId: sku.productId, productVariantId: sku.variantId, orderedQuantity: Number(quantity), unitPrice: Number(price), discountAmount: 0, taxPercentage: 0 }],
        });
      }
      if (action === "receipt") {
        const po = orders.find((x) => x.id === Number(document))!;
        const line = po.lines[0];
        return apiClient.post("purchases/goods-receipts", {
          purchaseOrderId: po.id,
          locationId: po.locationId,
          receiptDate: date,
          lines: [{ productId: line.productId, productVariantId: line.productVariantId, receivedQuantity: Number(quantity), acceptedQuantity: Number(quantity), rejectedQuantity: 0, purchasePrice: Number(price), batchNumber: other || null }],
        });
      }
      if (action === "invoice") {
        const grn = receipts.find((x) => x.id === Number(document))!;
        const line = grn.lines[0];
        return apiClient.post("purchases/invoices", {
          supplierId: grn.supplierId,
          goodsReceiptId: grn.id,
          invoiceNumber: other,
          invoiceDate: date,
          dueDate: null,
          lines: [{ productId: line.productId, productVariantId: line.productVariantId, quantity: Number(quantity), purchasePrice: Number(price), taxId: Number(tax) }],
        });
      }
      if (action === "payment") return apiClient.post(`purchases/invoices/${document}/payments`, { paymentMethodCode: method, amount: Number(quantity), paymentDate: date, referenceNumber: other || null });
      const inv = invoices.find((x) => x.id === Number(document))!;
      const line = inv.lines[0];
      return apiClient.post("purchases/returns", { purchaseInvoiceId: inv.id, returnDate: date, reason, lines: [{ productId: line.productId, productVariantId: line.productVariantId, quantity: Number(quantity), reason }] });
    },
    onSuccess: async () => {
      toast.success("Purchase transaction posted");
      await saved();
    },
    onError: (e) => toast.error(err(e)),
  });

  const title = { supplier: "Add supplier", order: "Create purchase order", receipt: "Receive goods", invoice: "Post supplier invoice", payment: "Record supplier payment", return: "Return to supplier" }[action ?? "order"];

  return (
    <Dialog open={!!action} onOpenChange={(x) => { if (!x) close(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Posts directly to the connected Purchase, Inventory, supplier ledger, and Finance workflow.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {action === "supplier" ? (
            <>
              <Field label="Supplier code">
                <Input value={other} onChange={(e) => setOther(e.target.value)} />
              </Field>
              <Field label="Supplier name">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </>
          ) : (
            <>
              {action === "order" && (
                <>
                  <Field label="Supplier">
                    <Picker value={supplier} set={setSupplier} values={suppliers.map((x) => [String(x.id), x.name])} />
                  </Field>
                  <Field label="Location">
                    <Picker value={location} set={setLocation} values={locations.map((x) => [String(x.id), x.name])} />
                  </Field>
                  <Field label="Item / variant">
                    <Picker value={item} set={setItem} values={sellables.map((x) => [key(x.productId, x.variantId), x.label])} />
                  </Field>
                </>
              )}
              {["receipt", "invoice", "payment", "return"].includes(action ??"") && (
                <Field label={action === "receipt" ? "Open order" : action === "invoice" ? "Uninvoiced receipt" : "Invoice"}>
                  <Picker
                    value={document}
                    set={setDocument}
                    values={(action === "receipt" ? orders.filter((x) => x.status !== "RECEIVED") : action === "invoice" ? receipts.filter((x) => !invoices.some((i) => i.goodsReceiptId === x.id)) : invoices.filter((x) => x.balanceAmount > 0)).map((x) => [
                      String(x.id),
                      String((x as { poNumber?: string; invoiceNumber?: string; grnNumber?: string }).poNumber ?? (x as { invoiceNumber?: string }).invoiceNumber ?? (x as { grnNumber?: string }).grnNumber ?? x.id),
                    ])}
                  />
                </Field>
              )}
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label={action === "payment" ? "Amount" : "Quantity"}>
                <Input type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </Field>
              {["order", "receipt", "invoice"].includes(action ??"") && (
                <Field label="Unit price">
                  <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                </Field>
              )}
              {action === "invoice" && (
                <>
                  <Field label="Supplier invoice number">
                    <Input value={other} onChange={(e) => setOther(e.target.value)} />
                  </Field>
                  <Field label="Tax">
                    <Picker value={tax} set={setTax} values={taxes.map((x) => [String(x.id), `${x.name} (${x.taxPercentage}%)`])} />
                  </Field>
                </>
              )}
              {action === "payment" && (
                <>
                  <Field label="Payment method">
                    <Picker value={method} set={setMethod} values={methods.map((x) => [x.code, x.name])} />
                  </Field>
                  <Field label="Reference">
                    <Input value={other} onChange={(e) => setOther(e.target.value)} />
                  </Field>
                </>
              )}
              {action === "receipt" && (
                <Field label="Batch / lot">
                  <Input value={other} onChange={(e) => setOther(e.target.value)} />
                </Field>
              )}
              {action === "order" && (
                <Field label="Expected date">
                  <Input type="date" value={other} onChange={(e) => setDate(e.target.value)} />
                </Field>
              )}
              {action === "return" && (
                <Field label="Reason">
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
function Picker({ value, set, values }: { value: string; set: (x: string) => void; values: string[][] }) {
  return (
    <Select items={Object.fromEntries(values)} value={value} onValueChange={(x) => set(x ??"")}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent>
        {values.map((x) => (
          <SelectItem key={x[0]} value={x[0]}>
            {x[1]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

  const doc = value as Record<string, any>;
  const isPayment = "paymentMethodCode" in doc || ("amount" in doc && !("lines" in doc));
  const isInvoice = "invoiceNumber" in doc && "balanceAmount" in doc;
  const isGRN = "grnNumber" in doc && "lines" in doc;
  const isPO = "poNumber" in doc && "lines" in doc;
  const isReturn = "returnNumber" in doc && "lines" in doc;

  const lines = Array.isArray(doc.lines) ? doc.lines : [];
  const ref = isPayment
    ? `Payment #${doc.id}`
    : isInvoice
    ? String(doc.invoiceNumber)
    : isGRN
    ? String(doc.grnNumber)
    : isReturn
    ? String(doc.returnNumber)
    : isPO
    ? String(doc.poNumber)
    : `Doc #${doc.id}`;

  const supplierObj = suppliers.find((s) => s.id === doc.supplierId);
  const supplier = (value as { supplierName?: string }).supplierName ?? supplierObj?.name ?? "—";
  const location = (value as { locationName?: string }).locationName ?? "—";
  const date =
    (value as { orderDate?: string }).orderDate ??
    (value as { receiptDate?: string }).receiptDate ??
    (value as { invoiceDate?: string }).invoiceDate ??
    (value as { returnDate?: string }).returnDate ??
    (value as { paymentDate?: string }).paymentDate ??
    "—";

  const total = (value as { totalAmount?: number; amount?: number }).totalAmount ?? (value as { amount?: number }).amount;
  const balance = (value as { balanceAmount?: number }).balanceAmount;
  const paid = (value as { paidAmount?: number }).paidAmount;

  return (
    <Dialog open={!!value} onOpenChange={(x) => { if (!x) close(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">{ref}</DialogTitle>
            {value.status && <Status text={String(value.status)} />}
          </div>
          <DialogDescription>Full purchase details, supplier metadata, line items, and current warehouse stock.</DialogDescription>
        </DialogHeader>

        {isPayment ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-md text-xs border">
              <div>
                <span className="text-muted-foreground block">Supplier:</span>
                <strong className="text-sm">{supplier}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block">Invoice #:</span>
                <strong className="text-sm">{(value as { invoiceNumber?: string }).invoiceNumber ?? `Invoice #${(value as { purchaseInvoiceId?: number }).purchaseInvoiceId}`}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block">Payment Date:</span>
                <strong className="text-sm">{date}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block">Method:</span>
                <strong className="text-sm">{String((value as { paymentMethodCode?: string }).paymentMethodCode).replaceAll("_", " ")}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-md border bg-emerald-50/50 dark:bg-emerald-950/20">
              <div>
                <span className="text-xs text-muted-foreground block">Transaction Reference / UTR #</span>
                <strong className="text-sm font-mono">{(value as { referenceNumber?: string }).referenceNumber ?? "—"}</strong>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Amount Paid</span>
                <strong className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{money.format(total ?? 0)}</strong>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Section 1 & Section 2: Header Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 p-3.5 rounded-md text-xs border my-1">
              <div className="space-y-1">
                <div className="font-bold text-sm text-foreground mb-1">Section 1: Purchase Order Information</div>
                <div><span className="text-muted-foreground">PO / Doc Number: </span><strong className="font-mono">{ref}</strong></div>
                <div><span className="text-muted-foreground">Order / Document Date: </span><strong>{date}</strong></div>
                {(value as { expectedDate?: string }).expectedDate && <div><span className="text-muted-foreground">Expected Delivery: </span><strong>{(value as { expectedDate?: string }).expectedDate}</strong></div>}
                <div><span className="text-muted-foreground">Receiving Warehouse: </span><strong>{location}</strong></div>
                <div><span className="text-muted-foreground">Fulfillment Status: </span><Status text={String(value.status)} /></div>
              </div>

              <div className="space-y-1 sm:border-l sm:pl-3">
                <div className="font-bold text-sm text-foreground mb-1">Section 2: Supplier Details</div>
                <div><span className="text-muted-foreground">Supplier: </span><strong>{supplier}</strong> {supplierObj?.code && <Badge variant="outline" className="text-[10px] ml-1">{supplierObj.code}</Badge>}</div>
                {supplierObj?.contactPerson && <div><span className="text-muted-foreground">Contact Person: </span><strong>{supplierObj.contactPerson}</strong></div>}
                {supplierObj?.phone && <div><span className="text-muted-foreground">Phone: </span><strong>{supplierObj.phone}</strong></div>}
                {supplierObj?.email && <div><span className="text-muted-foreground">Email: </span><strong>{supplierObj.email}</strong></div>}
                {supplierObj?.gstin && <div><span className="text-muted-foreground">GSTIN / Tax ID: </span><strong className="font-mono">{supplierObj.gstin}</strong></div>}
              </div>
            </div>

            {/* Section 3: Detailed Purchase Product Items Table */}
            <div className="space-y-2 mt-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Section 3: Purchased Products ({lines.length})</div>
                <div className="text-[11px] text-muted-foreground">Current Stock is fetched from receiving warehouse <strong>{location}</strong></div>
              </div>

              <TableWrap heads={["Product & Variant", "SKU", "Ordered", "Received", "Pending", "Unit Price (₹)", "Discount", "Tax", "Line Total", "Current Warehouse Stock", "Status"]}>
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
                        {x.productName}
                        {x.variantName && <span className="block text-[10px] text-muted-foreground">{x.variantName}</span>}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{x.sku ?? "—"}</TableCell>
                      <TableCell className="font-semibold text-xs text-right">{ordered}</TableCell>
                      <TableCell className="text-xs text-right text-emerald-600 font-medium">{received}</TableCell>
                      <TableCell className="text-xs text-right font-bold text-amber-600">{pending}</TableCell>
                      <TableCell className="text-xs text-right">{money.format(price)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground text-right">{discount > 0 ? money.format(discount) : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground text-right">{taxPct > 0 ? `${taxPct}%` : "—"}</TableCell>
                      <TableCell className="font-semibold text-xs text-right">{money.format(lineTotal)}</TableCell>
                      <TableCell className="text-xs text-right font-bold tabular-nums text-primary">{currentStock} units</TableCell>
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

            {/* Section 4: Payment Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-md bg-muted/30 border text-xs text-right mt-3">
              <div>
                <span className="text-muted-foreground block">Order Total Amount:</span>
                <strong className="text-sm font-semibold">{money.format(total ?? 0)}</strong>
              </div>
              {paid != null && (
                <div>
                  <span className="text-muted-foreground block">Amount Paid:</span>
                  <strong className="text-sm font-semibold text-emerald-600">{money.format(paid)}</strong>
                </div>
              )}
              {balance != null && (
                <div>
                  <span className="text-muted-foreground block">Balance Due:</span>
                  <strong className="text-sm font-bold text-amber-600">{money.format(balance)}</strong>
                </div>
              )}
              <div>
                <span className="text-muted-foreground block">Receiving Location:</span>
                <strong className="text-xs font-medium">{location}</strong>
              </div>
            </div>
          </>
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{supplier?.name} Ledger</DialogTitle>
          <DialogDescription>Outstanding Balance: {money.format(q.data?.outstandingBalance ?? 0)}</DialogDescription>
        </DialogHeader>
        <TableWrap heads={["Date", "Type", "Reference", "Amount"]}>
          {(q.data?.transactions.content ?? []).map((x, n) => (
            <TableRow key={n}>
              <TableCell className="text-xs">{x.date}</TableCell>
              <TableCell className="text-xs">{x.type}</TableCell>
              <TableCell className="text-xs font-mono">{x.reference}</TableCell>
              <TableCell className="text-xs font-semibold">{money.format(x.amount)}</TableCell>
            </TableRow>
          ))}
        </TableWrap>
      </DialogContent>
    </Dialog>
  );
}

function SupplierProductsHistoryDialog({ supplier, close, orders }: { supplier: Supplier | null; close: () => void; orders: PurchaseOrder[] }) {
  if (!supplier) return null;

  const supplierOrders = orders.filter((po) => po.supplierId === supplier.id);

  // Group line items for this supplier
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> Products Purchased from {supplier.name}
          </DialogTitle>
          <DialogDescription>
            Supplier Code: <strong>{supplier.code}</strong> • Total Purchase Orders: <strong>{supplierOrders.length}</strong>
          </DialogDescription>
        </DialogHeader>

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
                  {p.productName}
                  {p.variantName && <span className="block text-[10px] text-muted-foreground">{p.variantName}</span>}
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{p.sku ?? "—"}</TableCell>
                <TableCell className="text-xs">{p.lastDate}</TableCell>
                <TableCell className="text-xs font-semibold">{money.format(p.lastPrice)}</TableCell>
                <TableCell className="text-xs text-right font-semibold">{p.totalPurchased}</TableCell>
                <TableCell className="text-xs text-right font-bold text-amber-600">{p.pendingQty}</TableCell>
                <TableCell>
                  <Status text={p.status} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableWrap>
      </DialogContent>
    </Dialog>
  );
}
