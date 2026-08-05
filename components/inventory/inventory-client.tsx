"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Check, ChevronsUpDown, ClipboardCheck, History, Loader2, PackagePlus, Plus, Search, Trash2, Truck, Warehouse } from "lucide-react";
import { toast } from "sonner";

import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import { localDateInputValue } from "@/lib/date";
import type { Location } from "@/lib/types/master";
import type { ProductSummary, Variant } from "@/lib/types/product";
import type { AdjustmentResult, InventoryBatch, InventoryMovement, InventoryStock, OpeningStockResult, StockAdjustment, StockTransfer, TransferResult } from "@/lib/types/inventory";
import type { ExpenseCategory } from "@/lib/types/expense";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Sellable = { productId: number; variantId: number | null; label: string; codeOrSku: string };
type WorkingLocationContext = { activeLocation: Location | null; allowedLocations: Location[]; locationRequired: boolean };
type EntryLine = { key: string; itemKey: string; quantity: string; unitCost: string; batchNumber: string; expiryDate: string; batchId: number | null };
const today = localDateInputValue;
const newLine = (presetKey?: string): EntryLine => ({ key: crypto.randomUUID(), itemKey: presetKey ?? "", quantity: "", unitCost: "", batchNumber: "", expiryDate: "", batchId: null });
const itemKey = (p: number, v: number | null) => `${p}:${v ?? "base"}`;
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const qty = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(value);
const message = (e: unknown) => e instanceof ApiRequestError || e instanceof Error ? e.message : "Something went wrong";

export function InventoryClient() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [dialogState, setDialogState] = React.useState<{ kind: "opening" | "adjustment" | "transfer" | null; presetItemKey?: string }>({ kind: null });
  const [stockDetail, setStockDetail] = React.useState<InventoryStock | null>(null);
  const [transferDetail, setTransferDetail] = React.useState<StockTransfer | null>(null);
  const [adjustmentDetail, setAdjustmentDetail] = React.useState<StockAdjustment | null>(null);

  const locationsQuery = useQuery({ queryKey: ["users", "me", "allowed-locations", "inventory"], queryFn: async () => ({ content: await apiClient.get<Location[]>("users/me/locations") }) });
  const locationContextQuery = useQuery({ queryKey: ["users", "me", "context"], queryFn: () => apiClient.get<WorkingLocationContext>("users/me/context") });
  const productsQuery = useQuery({
    queryKey: ["inventory", "sellables"],
    queryFn: async () => {
      const page = await apiClient.get<PagedResult<ProductSummary>>("products?page=0&size=100");
      const active = page.content.filter((p) => p.isActive);
      const variants = await Promise.all(active.filter((p) => p.hasVariants).map(async (p) => ({ product: p, variants: (await apiClient.get<Variant[]>(`products/${p.id}/variants`)).filter((v) => v.isActive) })));
      const byProduct = new Map(variants.map((x) => [x.product.id, x.variants]));
      return active.flatMap<Sellable>((p) => p.hasVariants ? (byProduct.get(p.id) ?? []).map((v) => ({ productId: p.id, variantId: v.id, label: `${p.name} — ${v.variantName}`, codeOrSku: v.sku })) : [{ productId: p.id, variantId: null, label: p.name, codeOrSku: p.code }]);
    },
  });
  const activeLocation = locationContextQuery.data?.activeLocation ?? null;
  const stockQuery = useQuery({ queryKey: ["inventory", "stock", activeLocation?.id, search], enabled: !!activeLocation, queryFn: () => apiClient.get<InventoryStock[]>(`inventory?${new URLSearchParams({ locationId: String(activeLocation!.id), ...(search.trim() ? { search: search.trim() } : {}) })}`) });
  const transfersQuery = useQuery({ queryKey: ["inventory", "transfers", activeLocation?.id], enabled: !!activeLocation, queryFn: () => apiClient.get<StockTransfer[]>(`inventory/transfers?locationId=${activeLocation!.id}`) });
  const adjustmentsQuery = useQuery({ queryKey: ["inventory", "adjustments", activeLocation?.id], enabled: !!activeLocation, queryFn: () => apiClient.get<StockAdjustment[]>(`inventory/adjustments?locationId=${activeLocation!.id}`) });
  const expenseCategoriesQuery = useQuery({ queryKey: ["expense", "categories", "inventory"], queryFn: () => apiClient.get<PagedResult<ExpenseCategory>>("expense-categories?page=0&size=100") });

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["inventory", "stock"] }), qc.invalidateQueries({ queryKey: ["inventory", "transfers"] }), qc.invalidateQueries({ queryKey: ["inventory", "adjustments"] })]);
  const activeLocations = (locationsQuery.data?.content ?? []).filter((l) => l.isActive);
  const stock = stockQuery.data ?? [];
  const stockMap = React.useMemo(() => new Map(stock.map((s) => [itemKey(s.productId, s.productVariantId), s.availableQuantity])), [stock]);
  const pending = (transfersQuery.data ?? []).filter((t) => t.status === "PENDING");
  const lowStock = stock.filter((s) => s.reorderLevel != null && s.availableQuantity <= s.reorderLevel).length;
  const totalOnHand = stock.reduce((sum, item) => sum + item.quantityOnHand, 0);
  const totalAvailable = stock.reduce((sum, item) => sum + item.availableQuantity, 0);
  const productCount = new Set(stock.map((item) => item.productId)).size;

  return <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div><h1 className="text-2xl font-semibold">Inventory</h1><p className="text-sm text-muted-foreground">Know what is available, receive stock, reconcile counts, and move goods between locations.</p></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button disabled={!activeLocation} variant="outline" className="h-10" onClick={() => setDialogState({ kind: "opening" })}><PackagePlus /> Opening stock</Button>
        <Button disabled={!activeLocation} variant="outline" className="h-10" onClick={() => setDialogState({ kind: "adjustment" })}><ClipboardCheck /> Adjust stock</Button>
        <Button disabled={!activeLocation} className="h-10" onClick={() => setDialogState({ kind: "transfer" })}><Truck /> New transfer</Button>
      </div>
    </div>

    {!activeLocation && <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="mt-0.5 size-5 shrink-0"/><div><p className="font-semibold">No working store selected</p><p>Ask an administrator to assign store access, or select an authorized store from the top bar.</p></div></div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Products in this store" value={productCount} note={activeLocation?.name ?? "No store selected"} />
      <Metric label="Physical on hand" value={totalOnHand} note="All units currently recorded" />
      <Metric label="Available to sell" value={totalAvailable} note="On hand less reserved" />
      <Metric label="Pending receipts" value={pending.length} note={pending.length ? "Needs warehouse action" : "Nothing waiting"} warning={pending.length > 0} />
    </div>

    <Tabs defaultValue="stock">
      <TabsList><TabsTrigger value="stock">Stock</TabsTrigger><TabsTrigger value="transfers">Transfers {pending.length > 0 && <Badge className="ml-1">{pending.length}</Badge>}</TabsTrigger><TabsTrigger value="adjustments">Adjustments</TabsTrigger></TabsList>
      <TabsContent value="stock" className="mt-4">
        <Card><CardHeader><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{activeLocation ? `Stock at ${activeLocation.name}` : "Store inventory"}</CardTitle><CardDescription>Search a product or SKU to see exact on-hand, reserved and sellable quantities.</CardDescription></div>{lowStock>0&&<Badge variant="outline" className="w-fit border-amber-300 text-amber-700">{lowStock} at reorder level</Badge>}</div></CardHeader><CardContent>
          <div className="mb-4">
            <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search product or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Item & Variant</TableHead><TableHead>Status</TableHead><TableHead className="text-right">On hand</TableHead><TableHead className="text-right">Reserved</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="text-right">Quick Actions</TableHead></TableRow></TableHeader><TableBody>
            {stockQuery.isLoading ? <LoadingRow cols={6} /> : stock.length === 0 ? <EmptyRow cols={6} text="No stock recorded. Use Opening stock to begin." /> : stock.map((s) => {
              const key = itemKey(s.productId, s.productVariantId);
              const isOut = s.availableQuantity <= 0;
              const isLow = s.reorderLevel != null && s.availableQuantity <= s.reorderLevel;
              return (
                <TableRow key={`${s.locationId}-${key}`}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span>{s.productName}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {s.variantName ? <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{s.variantName}</Badge> : null}
                        <span>SKU: {s.sku ?? s.productCode}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isOut ? (
                      <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>
                    ) : isLow ? (
                      <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px]">Low Stock</Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500 text-emerald-700 text-[10px]">In Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{qty(s.quantityOnHand)}</TableCell>
                  <TableCell className="text-right tabular-nums">{qty(s.reservedQuantity)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    <span className={isOut ? "text-red-600" : isLow ? "text-amber-600" : ""}>{qty(s.availableQuantity)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1" disabled={isOut} onClick={() => setDialogState({ kind: "transfer", presetItemKey: key })} title="Transfer this item to another store">
                        <Truck className="size-3.5" /> Transfer
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setDialogState({ kind: "adjustment", presetItemKey: key })} title="Adjust count or record loss for this item">
                        <ClipboardCheck className="size-3.5" /> Adjust
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setStockDetail(s)} title="View batch list and movement ledger">
                        <History className="size-3.5" /> History
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody></Table></div>
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="transfers" className="mt-4"><Card><CardHeader><CardTitle>Stock transfers</CardTitle><CardDescription>Pending transfers have left the source location and must be confirmed at the destination.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Route</TableHead><TableHead>Date</TableHead><TableHead>Lines</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>
        {transfersQuery.isLoading ? <LoadingRow cols={6} /> : (transfersQuery.data ?? []).length === 0 ? <EmptyRow cols={6} text="No transfers yet." /> : (transfersQuery.data ?? []).map((t) => <TableRow key={t.id}><TableCell className="font-medium">{t.transferNumber}</TableCell><TableCell><span className="inline-flex items-center gap-1">{t.sourceLocationName}<ArrowRight className="size-3" />{t.destinationLocationName}</span></TableCell><TableCell>{new Date(t.transferDate).toLocaleDateString("en-IN")}</TableCell><TableCell>{t.lines.length}</TableCell><TableCell><Status value={t.status} /></TableCell><TableCell className="text-right"><Button size="sm" variant={t.status === "PENDING" ? "default" : "outline"} onClick={() => setTransferDetail(t)}>{t.status === "PENDING" ? "Receive" : "View"}</Button></TableCell></TableRow>)}
      </TableBody></Table></div></CardContent></Card></TabsContent>
      <TabsContent value="adjustments" className="mt-4"><Card><CardHeader><CardTitle>Stock adjustments</CardTitle><CardDescription>Every count correction is recorded with a reason. Losses remain available for controlled write-off.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Location</TableHead><TableHead>Type</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>
        {adjustmentsQuery.isLoading ? <LoadingRow cols={6} /> : (adjustmentsQuery.data ?? []).length === 0 ? <EmptyRow cols={6} text="No adjustments yet." /> : (adjustmentsQuery.data ?? []).map((a) => <TableRow key={a.id}><TableCell className="font-medium">{a.adjustmentNumber}</TableCell><TableCell>{a.locationName}</TableCell><TableCell><Badge variant="outline">{a.adjustmentType}</Badge></TableCell><TableCell className="max-w-72 truncate">{a.reason}</TableCell><TableCell><Status value={a.status} /></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setAdjustmentDetail(a)}>View</Button></TableCell></TableRow>)}
      </TableBody></Table></div></CardContent></Card></TabsContent>
    </Tabs>

    <OperationDialog
      kind={dialogState.kind}
      presetItemKey={dialogState.presetItemKey}
      onClose={() => setDialogState({ kind: null })}
      activeLocation={activeLocation}
      locations={activeLocations}
      sellables={productsQuery.data ?? []}
      stockMap={stockMap}
      onSaved={async () => { await refresh(); setDialogState({ kind: null }); }}
    />
    <StockDetailDialog stock={stockDetail} onClose={() => setStockDetail(null)} />
    <TransferDialog transfer={transferDetail} onClose={() => setTransferDetail(null)} onSaved={async () => { await refresh(); setTransferDetail(null); }} />
    <AdjustmentDialog adjustment={adjustmentDetail} categories={(expenseCategoriesQuery.data?.content ?? []).filter((x) => x.active)} onClose={() => setAdjustmentDetail(null)} onSaved={async () => { await refresh(); await qc.invalidateQueries({ queryKey: ["expense"] }); setAdjustmentDetail(null); }} />
  </div>;
}

function Metric({ label, value, note, warning }: { label: string; value: number; note: string; warning?: boolean }) { return <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className={warning ? "text-3xl font-semibold text-amber-600" : "text-3xl font-semibold"}>{qty(value)}</p><p className="text-xs text-muted-foreground">{note}</p></CardContent></Card>; }
function Status({ value }: { value: string }) { return <Badge variant={value === "PENDING" || value === "POSTED" ? "default" : "secondary"}>{value}</Badge>; }
function LoadingRow({ cols }: { cols: number }) { return <TableRow><TableCell colSpan={cols} className="h-24 text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>; }
function EmptyRow({ cols, text }: { cols: number; text: string }) { return <TableRow><TableCell colSpan={cols} className="h-24 text-center text-muted-foreground">{text}</TableCell></TableRow>; }

function ItemSearchSelect({
  value,
  onChange,
  sellables,
  stockMap,
}: {
  value: string;
  onChange: (val: string) => void;
  sellables: Sellable[];
  stockMap: Map<string, number>;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedSellable = React.useMemo(
    () => sellables.find((s) => itemKey(s.productId, s.variantId) === value),
    [sellables, value]
  );

  const selectedAvail = selectedSellable
    ? stockMap.get(itemKey(selectedSellable.productId, selectedSellable.variantId)) ?? 0
    : 0;

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sellables;
    return sellables.filter((s) => {
      return (
        s.label.toLowerCase().includes(term) ||
        s.codeOrSku.toLowerCase().includes(term)
      );
    });
  }, [sellables, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="w-full justify-between h-auto py-2 px-3 text-left font-normal border border-input rounded-md bg-background hover:bg-accent/50 flex items-center text-sm cursor-pointer"
      >
        {selectedSellable ? (
          <div className="flex flex-col gap-0.5 text-left min-w-0 pr-2">
            <span className="truncate text-sm font-medium text-foreground">
              {selectedSellable.label}
            </span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>SKU: {selectedSellable.codeOrSku}</span>
              <Badge
                variant={selectedAvail > 0 ? "secondary" : "outline"}
                className="px-1.5 py-0 text-[10px]"
              >
                {selectedAvail > 0
                  ? `${qty(selectedAvail)} in store`
                  : "0 available"}
              </Badge>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm flex items-center gap-2">
            <Search className="size-4 shrink-0 opacity-50" /> Search product name, variant or SKU...
          </span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 opacity-50 ml-2" />
      </PopoverTrigger>
      <PopoverContent className="w-[340px] sm:w-[480px] p-0 shadow-lg border" align="start">
        <div className="p-2 border-b bg-muted/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Type product name, variant or SKU code to filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm h-9"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/20">
          {filtered.length === 0 ? (
            <p className="p-4 text-xs text-center text-muted-foreground">
              No matching products or SKUs found.
            </p>
          ) : (
            filtered.map((s) => {
              const key = itemKey(s.productId, s.variantId);
              const avail = stockMap.get(key) ?? 0;
              const isSelected = key === value;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-md text-sm transition-colors flex items-center justify-between gap-2 hover:bg-accent/80 ${
                    isSelected ? "bg-accent font-medium" : ""
                  }`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                    <span className="font-medium text-foreground truncate">
                      {s.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      SKU / Code: {s.codeOrSku}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={avail > 0 ? "secondary" : "outline"}
                      className={
                        avail > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                          : "text-muted-foreground text-[10px]"
                      }
                    >
                      {avail > 0 ? `${qty(avail)} in store` : "0 available"}
                    </Badge>
                    {isSelected && <Check className="size-4 text-primary shrink-0" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OperationDialog({
  kind,
  presetItemKey,
  onClose,
  activeLocation,
  locations,
  sellables,
  stockMap,
  onSaved,
}: {
  kind: "opening" | "adjustment" | "transfer" | null;
  presetItemKey?: string;
  onClose: () => void;
  activeLocation: Location | null;
  locations: Location[];
  sellables: Sellable[];
  stockMap: Map<string, number>;
  onSaved: () => Promise<void>;
}) {
  const [source, setSource] = React.useState(""); const [destination, setDestination] = React.useState(""); const [type, setType] = React.useState("FOUND"); const [reason, setReason] = React.useState(""); const [remarks, setRemarks] = React.useState(""); const [date, setDate] = React.useState(today()); const [lines, setLines] = React.useState<EntryLine[]>([newLine(presetItemKey)]);
  React.useEffect(() => { if (kind) { setSource(activeLocation ? String(activeLocation.id) : ""); setDestination(""); setType("FOUND"); setReason(""); setRemarks(""); setDate(today()); setLines([newLine(presetItemKey)]); } }, [kind, activeLocation, presetItemKey]);
  const mutation = useMutation({ mutationFn: async () => {
    if (!source) throw new Error("Select a location"); if (lines.some((l) => !l.itemKey || Number(l.quantity) <= 0)) throw new Error("Select an item and enter a positive quantity on every line");
    const mapped = lines.map((l) => { const item = sellables.find((s) => itemKey(s.productId, s.variantId) === l.itemKey)!; return { productId: item.productId, productVariantId: item.variantId, quantity: Number(l.quantity), ...(l.batchId ? { batchId: l.batchId } : {}) }; });
    if (kind === "opening") return apiClient.post<OpeningStockResult>("inventory/opening-stock", { locationId: Number(source), remarks: remarks || null, lines: mapped.map((l, i) => ({ ...l, unitCost: Number(lines[i].unitCost), batchNumber: lines[i].batchNumber || null, expiryDate: lines[i].expiryDate || null })) });
    if (kind === "adjustment") { if (!reason.trim()) throw new Error("Enter the reason for this adjustment"); return apiClient.post<AdjustmentResult>("inventory/adjustments", { locationId: Number(source), adjustmentType: type, reason: reason.trim(), lines: mapped }); }
    if (!destination || source === destination) throw new Error("Choose different source and destination locations"); return apiClient.post<TransferResult>("inventory/transfers", { sourceLocationId: Number(source), destinationLocationId: Number(destination), transferDate: date, remarks: remarks || null, lines: mapped });
  }, onSuccess: async (result) => { toast.success(kind === "opening" ? "Opening stock recorded" : kind === "adjustment" ? `Adjustment ${(result as AdjustmentResult).adjustmentNumber} posted` : `Transfer ${(result as TransferResult).transferNumber} dispatched`); await onSaved(); }, onError: (e) => toast.error(message(e)) });
  const title = kind === "opening" ? "Record opening stock" : kind === "adjustment" ? "Adjust physical stock" : "Create stock transfer";

  return <Dialog open={kind != null} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{kind === "opening" ? "Use once when bringing existing quantities into Fiyora. Cost creates the batch valuation." : kind === "adjustment" ? "Record the difference found during a physical count. Loss types reduce stock; Found increases it." : "Dispatch now from the source. The destination confirms receipt from the pending queue."}</DialogDescription></DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg border bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{kind === "transfer" ? "Dispatching from" : "Posting stock at"}</p><p className="font-medium">{activeLocation?.name ?? "No working store"}</p><p className="text-xs text-muted-foreground">Change the working store from the top bar before starting this operation.</p></div>{kind === "transfer" && <Field label="Destination location"><LocationSelect value={destination} onChange={setDestination} locations={locations.filter((l) => String(l.id) !== source)} /></Field>}{kind === "transfer" && <Field label="Transfer date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>}{kind === "adjustment" && <Field label="Adjustment type"><Select items={{ FOUND: "Found / surplus", DAMAGED: "Damaged", EXPIRED: "Expired", LOST: "Lost / shrinkage" }} value={type} onValueChange={(v) => setType(v ?? "FOUND")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FOUND">Found / surplus (+ Add to stock)</SelectItem><SelectItem value="DAMAGED">Damaged (- Deduct from stock)</SelectItem><SelectItem value="EXPIRED">Expired (- Deduct from stock)</SelectItem><SelectItem value="LOST">Lost / shrinkage (- Deduct from stock)</SelectItem></SelectContent></Select></Field>}{kind === "adjustment" && <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Physical count variance, damaged in handling…" /></Field>}</div>
    <div className="space-y-3">
      <div className="flex items-center justify-between"><Label>Items & Quantities</Label><Button type="button" size="sm" variant="outline" onClick={() => setLines((x) => [...x, newLine()])}><Plus /> Add line</Button></div>
      {lines.map((line) => {
        const avail = stockMap.get(line.itemKey) ?? 0;
        const requestedQty = Number(line.quantity) || 0;
        const isTransferOrLoss = kind === "transfer" || (kind === "adjustment" && type !== "FOUND");
        const exceedsStock = isTransferOrLoss && line.itemKey !== "" && requestedQty > avail;

        return (
          <div key={line.key} className={`flex flex-col gap-3 rounded-lg border p-3 ${exceedsStock ? "border-red-300 bg-red-50/50" : "bg-card"}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 min-w-0">
                <ItemSearchSelect
                  value={line.itemKey}
                  onChange={(v) => setLines((x) => x.map((a) => a.key === line.key ? { ...a, itemKey: v, batchId: null } : a))}
                  sellables={sellables}
                  stockMap={stockMap}
                />
              </div>
              <div className="flex items-center gap-2 sm:w-48">
                <Input
                  className="w-full"
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Quantity"
                  value={line.quantity}
                  onChange={(e) => setLines((x) => x.map((a) => a.key === line.key ? { ...a, quantity: e.target.value } : a))}
                />
                {kind === "opening" && (
                  <Input
                    className="w-full"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit cost"
                    value={line.unitCost}
                    onChange={(e) => setLines((x) => x.map((a) => a.key === line.key ? { ...a, unitCost: e.target.value } : a))}
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  disabled={lines.length === 1}
                  onClick={() => setLines((x) => x.filter((a) => a.key !== line.key))}
                  title="Remove line"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            {exceedsStock && (
              <p className="text-xs font-medium text-red-600 flex items-center gap-1">
                <AlertTriangle className="size-3.5 shrink-0" /> Exceeds available stock ({qty(avail)} units in store)
              </p>
            )}
            {kind === "opening" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Batch / lot number (optional)" value={line.batchNumber} onChange={(e) => setLines((x) => x.map((a) => a.key === line.key ? { ...a, batchNumber: e.target.value } : a))} />
                <Input type="date" value={line.expiryDate} onChange={(e) => setLines((x) => x.map((a) => a.key === line.key ? { ...a, expiryDate: e.target.value } : a))} />
              </div>
            ) : (kind === "transfer" || type !== "FOUND") && (
              <div>
                <BatchPicker locationId={source} item={sellables.find((s) => itemKey(s.productId, s.variantId) === line.itemKey)} value={line.batchId} onChange={(batchId) => setLines((x) => x.map((a) => a.key === line.key ? { ...a, batchId } : a))} />
              </div>
            )}
          </div>
        );
      })}
    </div>
    {kind !== "adjustment" && <Field label="Remarks"><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional reference or handling note" /></Field>}
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="animate-spin" />}{kind === "transfer" ? "Dispatch transfer" : "Post stock entry"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function LocationSelect({ value, onChange, locations }: { value: string; onChange: (v: string) => void; locations: Location[] }) { return <Select items={Object.fromEntries(locations.map((l) => [String(l.id), `${l.name} (${l.type})`]))} value={value} onValueChange={(v) => onChange(v ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Select location" /></SelectTrigger><SelectContent>{locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name} ({l.type})</SelectItem>)}</SelectContent></Select>; }
function BatchPicker({ locationId, item, value, onChange }: { locationId: string; item?: Sellable; value: number | null; onChange: (id: number | null) => void }) { const query = useQuery({ queryKey: ["inventory", "entry-batches", locationId, item?.productId, item?.variantId], enabled: !!locationId && !!item, queryFn: () => apiClient.get<InventoryBatch[]>(`inventory/batches?${new URLSearchParams({ productId: String(item!.productId), locationId, ...(item!.variantId ? { productVariantId: String(item!.variantId) } : {}) })}`) }); const batches = query.data ?? []; if (!locationId || !item) return <p className="text-xs text-muted-foreground">Select the location and SKU to load available batches.</p>; if (query.isLoading) return <p className="text-xs text-muted-foreground">Loading batches…</p>; if (batches.length === 0) return <p className="text-xs text-muted-foreground">No batch balance found; this line will use unbatched stock.</p>; return <Select items={Object.fromEntries(batches.map((b) => [String(b.batchId), `${b.batchNumber || `Batch #${b.batchId}`} · ${qty(b.remainingQuantity)} available${b.expiryDate ? ` · expires ${b.expiryDate}` : ""}`]))} value={value ? String(value) : ""} onValueChange={(v) => onChange(v ? Number(v) : null)}><SelectTrigger className="w-full"><SelectValue placeholder="Select batch / lot" /></SelectTrigger><SelectContent>{batches.map((b) => <SelectItem key={b.batchId} value={String(b.batchId)}>{b.batchNumber || `Batch #${b.batchId}`} · {qty(b.remainingQuantity)} available{b.expiryDate ? ` · expires ${b.expiryDate}` : ""}</SelectItem>)}</SelectContent></Select>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }

function StockDetailDialog({ stock, onClose }: { stock: InventoryStock | null; onClose: () => void }) {
  const from = localDateInputValue(new Date(Date.now() - 90 * 86400000)); const to = today();
  const batches = useQuery({ queryKey: ["inventory", "batches", stock?.locationId, stock?.productId, stock?.productVariantId], enabled: !!stock, queryFn: () => apiClient.get<InventoryBatch[]>(`inventory/batches?${new URLSearchParams({ productId: String(stock!.productId), locationId: String(stock!.locationId), ...(stock!.productVariantId ? { productVariantId: String(stock!.productVariantId) } : {}) })}`) });
  const movements = useQuery({ queryKey: ["inventory", "movements", stock?.locationId, stock?.productId], enabled: !!stock, queryFn: () => apiClient.get<PagedResult<InventoryMovement>>(`inventory/movements?productId=${stock!.productId}&locationId=${stock!.locationId}&from=${from}&to=${to}&page=0&size=100`) });
  return <Dialog open={!!stock} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{stock?.productName}</DialogTitle><DialogDescription>{stock?.locationName} · {stock && qty(stock.availableQuantity)} available</DialogDescription></DialogHeader><Tabs defaultValue="batches"><TabsList><TabsTrigger value="batches">Batches</TabsTrigger><TabsTrigger value="movements">Movement ledger</TabsTrigger></TabsList><TabsContent value="batches"><Table><TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="text-right">Unit cost</TableHead></TableRow></TableHeader><TableBody>{(batches.data ?? []).length === 0 ? <EmptyRow cols={4} text="No available batches." /> : (batches.data ?? []).map((b) => <TableRow key={b.batchId}><TableCell>{b.batchNumber || `Batch #${b.batchId}`}</TableCell><TableCell>{b.expiryDate || "—"}</TableCell><TableCell className="text-right">{qty(b.remainingQuantity)}</TableCell><TableCell className="text-right">{money.format(b.purchasePrice)}</TableCell></TableRow>)}</TableBody></Table></TabsContent><TabsContent value="movements"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Movement</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Quantity</TableHead></TableRow></TableHeader><TableBody>{(movements.data?.content ?? []).length === 0 ? <EmptyRow cols={4} text="No movements in the last 90 days." /> : (movements.data?.content ?? []).map((m, i) => <TableRow key={`${m.date}-${i}`}><TableCell>{new Date(m.date).toLocaleString("en-IN")}</TableCell><TableCell>{m.type.replaceAll("_", " ")}</TableCell><TableCell>{m.reference}</TableCell><TableCell className={`text-right font-medium ${m.quantity < 0 ? "text-red-600" : "text-emerald-600"}`}>{m.quantity > 0 ? "+" : ""}{qty(m.quantity)}</TableCell></TableRow>)}</TableBody></Table></TabsContent></Tabs></DialogContent></Dialog>;
}

function TransferDialog({ transfer, onClose, onSaved }: { transfer: StockTransfer | null; onClose: () => void; onSaved: () => Promise<void> }) { const mutation = useMutation({ mutationFn: () => apiClient.post<TransferResult>(`inventory/transfers/${transfer!.id}/receive`, { lines: transfer!.lines.map((l) => ({ productId: l.productId, productVariantId: l.productVariantId, receivedQuantity: l.quantity })) }), onSuccess: async () => { toast.success(`${transfer!.transferNumber} received into ${transfer!.destinationLocationName}`); await onSaved(); }, onError: (e) => toast.error(message(e)) }); return <Dialog open={!!transfer} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{transfer?.transferNumber}</DialogTitle><DialogDescription>{transfer?.sourceLocationName} → {transfer?.destinationLocationName}</DialogDescription></DialogHeader><LineTable lines={transfer?.lines ?? []} />{transfer?.remarks && <p className="rounded-md bg-muted p-3 text-sm">{transfer.remarks}</p>}<DialogFooter><Button variant="outline" onClick={onClose}>Close</Button>{transfer?.status === "PENDING" && <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="animate-spin" /> : <Warehouse />} Confirm full receipt</Button>}</DialogFooter></DialogContent></Dialog>; }

function AdjustmentDialog({ adjustment, categories, onClose, onSaved }: { adjustment: StockAdjustment | null; categories: ExpenseCategory[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const isLoss = adjustment && ["DAMAGED", "EXPIRED", "LOST"].includes(adjustment.adjustmentType);
  const [createExpense, setCreateExpense] = React.useState(true);
  const [categoryCode, setCategoryCode] = React.useState("");
  React.useEffect(() => {
    if (adjustment) {
      setCreateExpense(true);
      setCategoryCode(categories.find((x) => x.code === "INVENTORY_LOSS")?.code ?? categories[0]?.code ?? "");
    }
  }, [adjustment, categories]);
  const mutation = useMutation({
    mutationFn: () => {
      if (createExpense && !categoryCode) throw new Error("Create an active Expense category before posting the write-off");
      return apiClient.post<AdjustmentResult>(`inventory/adjustments/${adjustment!.id}/write-off`, {
        createExpense,
        expenseCategoryCode: createExpense ? categoryCode : null,
        valuationBasis: "COST_PRICE",
      });
    },
    onSuccess: async (result) => {
      toast.success(result.expense ? `${adjustment!.adjustmentNumber} disposed and ${result.expense.expenseNumber} posted` : `${adjustment!.adjustmentNumber} marked disposed`);
      await onSaved();
    },
    onError: (e) => toast.error(message(e)),
  });
  return <Dialog open={!!adjustment} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="sm:max-w-2xl">
    <DialogHeader><DialogTitle>{adjustment?.adjustmentNumber}</DialogTitle><DialogDescription>{adjustment?.adjustmentType} at {adjustment?.locationName} · {adjustment?.reason}</DialogDescription></DialogHeader>
    <LineTable lines={adjustment?.lines ?? []} adjustment />
    {isLoss && adjustment?.status === "POSTED" && <div className="space-y-3 rounded-lg border p-4">
      <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={createExpense} onChange={(e) => setCreateExpense(e.target.checked)} />Post the inventory loss to Expenses and Finance</label>
      {createExpense && <Field label="Expense category"><Select items={Object.fromEntries(categories.map((x) => [x.code, x.name]))} value={categoryCode} onValueChange={(v) => setCategoryCode(v ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{categories.map((x) => <SelectItem key={x.id} value={x.code}>{x.name} ({x.code})</SelectItem>)}</SelectContent></Select></Field>}
      <p className="text-xs text-muted-foreground">The loss is valued at batch cost, debited to Expense, and credited to Inventory Asset.</p>
    </div>}
    <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button>{isLoss && adjustment?.status === "POSTED" && <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="animate-spin" /> : <ClipboardCheck />} Dispose stock</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}

function LineTable({ lines, adjustment }: { lines: StockTransfer["lines"]; adjustment?: boolean }) { return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Batch</TableHead>{adjustment && <TableHead>Before → After</TableHead>}<TableHead className="text-right">Quantity</TableHead></TableRow></TableHeader><TableBody>{lines.map((l, i) => <TableRow key={`${l.productId}-${l.productVariantId}-${i}`}><TableCell className="font-medium">{l.productName}{l.variantName && <span className="block text-xs font-normal text-muted-foreground">{l.variantName}</span>}</TableCell><TableCell>{l.batchNumber || "—"}</TableCell>{adjustment && <TableCell>{qty(l.quantityBefore ?? 0)} → {qty(l.quantityAfter ?? 0)}</TableCell>}<TableCell className="text-right">{qty(l.quantity)}</TableCell></TableRow>)}</TableBody></Table></div>; }
