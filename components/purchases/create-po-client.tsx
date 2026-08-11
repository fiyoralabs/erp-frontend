"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Grid, Loader2, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import { localDateInputValue } from "@/lib/date";
import type { Category, Location } from "@/lib/types/master";
import type { ProductSummary, Variant } from "@/lib/types/product";
import type { Supplier } from "@/lib/types/purchase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCategoriesLookup } from "@/lib/hooks/use-master-data";

type WorkingLocationContext = { activeLocation: Location | null; allowedLocations: Location[]; locationRequired: boolean };

export type POLineItem = {
  id: string; // internal unique key
  productId: number;
  productVariantId: number | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  primaryImageUrl: string | null;
  orderedQuantity: number;
  unitPrice: number;
  discountAmount: number;
  taxPercentage: number;
};

const today = localDateInputValue;
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const err = (e: unknown) => (e instanceof ApiRequestError || e instanceof Error ? e.message : "Something went wrong");

export function CreatePOClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const paramSupplierId = searchParams.get("supplierId");
  const paramProductId = searchParams.get("productId");

  const [supplierId, setSupplierId] = React.useState<string>("");
  const [locationId, setLocationId] = React.useState<string>("");
  const [orderDate, setOrderDate] = React.useState<string>(today());
  const [expectedDate, setExpectedDate] = React.useState<string>("");
  const [remarks, setRemarks] = React.useState<string>("");

  const [lineItems, setLineItems] = React.useState<POLineItem[]>([]);
  const [catalogOpen, setCatalogOpen] = React.useState<boolean>(false);

  // Queries
  const locationContextQuery = useQuery({ queryKey: ["users", "me", "context"], queryFn: () => apiClient.get<WorkingLocationContext>("users/me/context") });
  const activeLocation = locationContextQuery.data?.activeLocation ?? null;

  const suppliersQuery = useQuery({ queryKey: ["purchase", "suppliers"], queryFn: () => apiClient.get<Supplier[]>("purchases/suppliers") });
  const locationsQuery = useQuery({ queryKey: ["master", "locations", "purchase"], queryFn: () => apiClient.get<PagedResult<Location>>("master/locations?page=0&size=100") });
  const categoriesQuery = useCategoriesLookup();
  const productsQuery = useQuery({ queryKey: ["products", "purchase", "catalog"], queryFn: () => apiClient.get<PagedResult<ProductSummary>>("products?page=0&size=200") });

  // Auto-set location when activeLocation is available
  React.useEffect(() => {
    if (activeLocation && !locationId) {
      setLocationId(String(activeLocation.id));
    }
  }, [activeLocation, locationId]);

  // Pre-select supplier and product from URL search params
  React.useEffect(() => {
    if (paramSupplierId && !supplierId) {
      setSupplierId(paramSupplierId);
    }
  }, [paramSupplierId, supplierId]);

  React.useEffect(() => {
    if (paramProductId && productsQuery.data?.content && lineItems.length === 0) {
      const targetProd = productsQuery.data.content.find((p) => String(p.id) === paramProductId);
      if (targetProd) {
        setLineItems([
          {
            id: crypto.randomUUID(),
            productId: targetProd.id,
            productVariantId: null,
            productName: targetProd.name,
            variantName: null,
            sku: targetProd.code,
            primaryImageUrl: targetProd.primaryImageUrl,
            orderedQuantity: 10,
            unitPrice: 0,
            discountAmount: 0,
            taxPercentage: 0,
          },
        ]);
      }
    }
  }, [paramProductId, productsQuery.data, lineItems.length]);

  // Submit Mutation
  const createPOMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Please select a Supplier");
      if (!locationId) throw new Error("Please select a Store Location");
      if (lineItems.length === 0) throw new Error("Please add at least one line item to the order");

      for (const line of lineItems) {
        if (!line.orderedQuantity || line.orderedQuantity <= 0) {
          throw new Error(`Quantity for ${line.productName} must be greater than zero`);
        }
      }

      return apiClient.post("purchases/orders", {
        supplierId: Number(supplierId),
        locationId: Number(locationId),
        orderDate,
        expectedDate: expectedDate || null,
        remarks: remarks || null,
        lines: lineItems.map((line) => ({
          productId: line.productId,
          productVariantId: line.productVariantId,
          orderedQuantity: line.orderedQuantity,
          unitPrice: line.unitPrice,
          discountAmount: line.discountAmount || 0,
          taxPercentage: line.taxPercentage || 0,
        })),
      });
    },
    onSuccess: async () => {
      toast.success("Purchase order created successfully");
      await qc.invalidateQueries({ queryKey: ["purchase"] });
      router.push("/purchases");
    },
    onError: (e) => toast.error(err(e)),
  });

  // Calculate totals
  const subtotal = lineItems.reduce((acc, item) => acc + item.orderedQuantity * item.unitPrice, 0);
  const totalDiscount = lineItems.reduce((acc, item) => acc + (item.discountAmount || 0), 0);
  const totalTax = lineItems.reduce((acc, item) => {
    const net = item.orderedQuantity * item.unitPrice - (item.discountAmount || 0);
    return acc + (net * (item.taxPercentage || 0)) / 100;
  }, 0);
  const grandTotal = subtotal - totalDiscount + totalTax;

  // Add or update items from catalog
  const handleAddItems = (newItems: POLineItem[]) => {
    setLineItems((prev) => {
      const copy = [...prev];
      for (const newItem of newItems) {
        const idx = copy.findIndex((x) => x.productId === newItem.productId && x.productVariantId === newItem.productVariantId);
        if (idx >= 0) {
          copy[idx] = { ...copy[idx], orderedQuantity: copy[idx].orderedQuantity + newItem.orderedQuantity };
        } else {
          copy.push(newItem);
        }
      }
      return copy;
    });
    toast.success(`Added ${newItems.length} item(s) to order`);
  };

  const handleUpdateLine = (id: string, field: keyof POLineItem, value: number) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleRemoveLine = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const suppliers = suppliersQuery.data ?? [];
  const locations = (locationsQuery.data?.content ?? []).filter((l) => l.isActive);
  const categories = (categoriesQuery.data?.content ?? []).filter((c) => c.isActive);
  const products = (productsQuery.data?.content ?? []).filter((p) => p.isActive);

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Back & Header */}
      <div className="flex flex-col gap-2">
        <Link href="/purchases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Purchases
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Create Purchase Order</h1>
            <p className="text-sm text-muted-foreground">Issue multi-item purchase orders to suppliers with visual product catalog selection.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/purchases")}>
              Cancel
            </Button>
            <Button onClick={() => createPOMutation.mutate()} disabled={createPOMutation.isPending}>
              {createPOMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save & Submit Order
            </Button>
          </div>
        </div>
      </div>

      {/* Header Fields Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Order Information</CardTitle>
          <CardDescription>Select vendor and delivery location for this commitment.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Supplier */}
            <div className="space-y-1.5">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select items={Object.fromEntries(suppliers.map((s) => [String(s.id), `${s.name} (${s.code})`]))} value={supplierId} onValueChange={(val) => setSupplierId(val || "")}>
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Store Location */}
            <div className="space-y-1.5">
              <Label htmlFor="location">Store Location *</Label>
              <Select items={Object.fromEntries(locations.map((loc) => [String(loc.id), `${loc.name}${loc.id === activeLocation?.id ? " (Current Active Store)" : ""}`]))} value={locationId} onValueChange={(val) => setLocationId(val || "")}>
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select store location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.name} {loc.id === activeLocation?.id ? " (Current Active Store)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Order Date */}
            <div className="space-y-1.5">
              <Label htmlFor="orderDate">Order Date *</Label>
              <Input id="orderDate" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>

            {/* Expected Date */}
            <div className="space-y-1.5">
              <Label htmlFor="expectedDate">Expected Delivery Date</Label>
              <Input id="expectedDate" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="remarks">Remarks / Internal Notes</Label>
            <Textarea id="remarks" placeholder="Optional notes for vendor or receiving dock..." value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Items Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base font-semibold">Order Line Items ({lineItems.length})</CardTitle>
            <CardDescription>Add multiple items and variants to order from the catalog.</CardDescription>
          </div>
          <Button onClick={() => setCatalogOpen(true)} className="gap-2">
            <ShoppingBag className="h-4 w-4" /> Browse Product Catalog
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Item & Variant</TableHead>
                  <TableHead className="w-[120px]">SKU / Code</TableHead>
                  <TableHead className="w-[130px] text-right">Quantity</TableHead>
                  <TableHead className="w-[140px] text-right">Unit Cost (₹)</TableHead>
                  <TableHead className="w-[120px] text-right">Discount (₹)</TableHead>
                  <TableHead className="w-[110px] text-right">Tax %</TableHead>
                  <TableHead className="w-[140px] text-right">Line Total (₹)</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
                        <p>No items added yet. Click &quot;Browse Product Catalog&quot; to pick products by category.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  lineItems.map((item) => {
                    const lineSubtotal = item.orderedQuantity * item.unitPrice - (item.discountAmount || 0);
                    const lineTax = (lineSubtotal * (item.taxPercentage || 0)) / 100;
                    const lineTotal = lineSubtotal + lineTax;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                              {item.primaryImageUrl ? (
                                // eslint-disable-next-next/no-img-element
                                <img src={item.primaryImageUrl} alt={item.productName} className="h-full w-full object-cover" />
                              ) : (
                                <Grid className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div>{item.productName}</div>
                              {item.variantName && <div className="text-xs text-muted-foreground">{item.variantName}</div>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.sku ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.orderedQuantity}
                            onChange={(e) => handleUpdateLine(item.id, "orderedQuantity", Math.max(0.001, Number(e.target.value)))}
                            className="w-24 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateLine(item.id, "unitPrice", Math.max(0, Number(e.target.value)))}
                            className="w-28 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discountAmount}
                            onChange={(e) => handleUpdateLine(item.id, "discountAmount", Math.max(0, Number(e.target.value)))}
                            className="w-24 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={item.taxPercentage}
                            onChange={(e) => handleUpdateLine(item.id, "taxPercentage", Math.max(0, Number(e.target.value)))}
                            className="w-20 text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">{money.format(lineTotal)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveLine(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Button variant="outline" onClick={() => setCatalogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add More Items
        </Button>

        <Card className="w-full sm:w-80">
          <CardContent className="pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span>{money.format(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount:</span>
                <span>-{money.format(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Estimated Tax:</span>
              <span>{money.format(totalTax)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold text-base">
              <span>Grand Total:</span>
              <span className="text-primary">{money.format(grandTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Product Catalog Dialog */}
      <ProductCatalogModal
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        categories={categories}
        products={products}
        onAddItems={handleAddItems}
      />
    </div>
  );
}

// Visual Category & Product Catalog Component
function ProductCatalogModal({
  open,
  onClose,
  categories,
  products,
  onAddItems,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  products: ProductSummary[];
  onAddItems: (items: POLineItem[]) => void;
}) {
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState<string>("");
  const [activeProduct, setActiveProduct] = React.useState<ProductSummary | null>(null);

  // Filtered Products
  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      const matchCategory = selectedCategory === "ALL" || String(p.categoryId) === selectedCategory;
      const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, search]);

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> Visual Product Catalog
          </DialogTitle>
          <DialogDescription>Filter products by Category, browse photos, and select items/variants for your purchase order.</DialogDescription>
        </DialogHeader>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-b pb-4">
          {/* Category Filter Pills / Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Label className="text-xs shrink-0 font-medium">Category:</Label>
            <Select items={Object.fromEntries([["ALL", "All Categories"], ...categories.map((c) => [String(c.id), c.name])])} value={selectedCategory} onValueChange={(val) => setSelectedCategory(val || "ALL")}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {/* Catalog Body */}
        <div className="flex-1 overflow-y-auto py-2">
          {activeProduct ? (
            <ProductVariantPicker product={activeProduct} onBack={() => setActiveProduct(null)} onAddItems={(items) => { onAddItems(items); setActiveProduct(null); }} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  <Grid className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No products found for the selected category or search filter.</p>
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:border-primary transition-all duration-150 overflow-hidden flex flex-col group"
                    onClick={() => setActiveProduct(product)}
                  >
                    <div className="h-32 bg-muted/30 border-b flex items-center justify-center overflow-hidden relative">
                      {product.primaryImageUrl ? (
                        // eslint-disable-next-next/no-img-element
                        <img src={product.primaryImageUrl} alt={product.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Grid className="h-8 w-8 text-muted-foreground/40" />
                      )}
                      {product.hasVariants && <Badge className="absolute top-2 right-2 text-[10px]">Has Variants</Badge>}
                    </div>
                    <CardContent className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <Badge variant="outline" className="text-[10px] mb-1 font-normal">
                          {product.categoryName ?? "General"}
                        </Badge>
                        <h4 className="font-medium text-sm line-clamp-1 group-hover:text-primary">{product.name}</h4>
                        <p className="text-xs text-muted-foreground font-mono">{product.code}</p>
                      </div>
                      <Button size="sm" variant="secondary" className="w-full mt-3 text-xs gap-1">
                        Select Item
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Done / Close Catalog
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Component to pick variant or simple product quantity
function ProductVariantPicker({
  product,
  onBack,
  onAddItems,
}: {
  product: ProductSummary;
  onBack: () => void;
  onAddItems: (items: POLineItem[]) => void;
}) {
  const [simpleQty, setSimpleQty] = React.useState<number>(1);
  const [simplePrice, setSimplePrice] = React.useState<number>(0);

  const [variantQtyMap, setVariantQtyMap] = React.useState<Record<number, number>>({});
  const [variantPriceMap, setVariantPriceMap] = React.useState<Record<number, number>>({});

  const variantsQuery = useQuery({
    queryKey: ["products", product.id, "variants"],
    enabled: product.hasVariants,
    queryFn: () => apiClient.get<Variant[]>(`products/${product.id}/variants`),
  });

  const variants = (variantsQuery.data ?? []).filter((v) => v.isActive);

  const handleAddSimple = () => {
    const item: POLineItem = {
      id: `${product.id}-base-${Date.now()}`,
      productId: product.id,
      productVariantId: null,
      productName: product.name,
      variantName: null,
      sku: product.code,
      primaryImageUrl: product.primaryImageUrl,
      orderedQuantity: simpleQty,
      unitPrice: simplePrice,
      discountAmount: 0,
      taxPercentage: 0,
    };
    onAddItems([item]);
  };

  const handleAddVariants = () => {
    const items: POLineItem[] = [];
    for (const v of variants) {
      const qty = variantQtyMap[v.id] || 0;
      if (qty > 0) {
        items.push({
          id: `${product.id}-${v.id}-${Date.now()}`,
          productId: product.id,
          productVariantId: v.id,
          productName: product.name,
          variantName: v.variantName,
          sku: v.sku,
          primaryImageUrl: product.primaryImageUrl,
          orderedQuantity: qty,
          unitPrice: variantPriceMap[v.id] || 0,
          discountAmount: 0,
          taxPercentage: 0,
        });
      }
    }
    if (items.length === 0) {
      toast.error("Please enter a quantity for at least one variant");
      return;
    }
    onAddItems(items);
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs mb-2">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Catalog
      </Button>

      <div className="flex items-center gap-4 border-b pb-4">
        <div className="h-16 w-16 rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
          {product.primaryImageUrl ? (
            // eslint-disable-next-next/no-img-element
            <img src={product.primaryImageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <Grid className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold">{product.name}</h3>
          <p className="text-xs text-muted-foreground font-mono">Code: {product.code} · Category: {product.categoryName ?? "General"}</p>
        </div>
      </div>

      {!product.hasVariants ? (
        <div className="grid gap-4 sm:grid-cols-3 items-end max-w-lg pt-2">
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input type="number" min="1" step="1" value={simpleQty} onChange={(e) => setSimpleQty(Math.max(1, Number(e.target.value)))} />
          </div>
          <div className="space-y-1.5">
            <Label>Unit Purchase Price (₹)</Label>
            <Input type="number" min="0" step="0.01" value={simplePrice} onChange={(e) => setSimplePrice(Math.max(0, Number(e.target.value)))} />
          </div>
          <Button onClick={handleAddSimple} className="gap-1">
            <Check className="h-4 w-4" /> Add to Order
          </Button>
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Select Variant Quantities & Purchase Prices:</h4>
          </div>

          {variantsQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading variants...
            </div>
          ) : variants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No active variants found for this product.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="w-[140px]">Quantity</TableHead>
                    <TableHead className="w-[160px]">Unit Price (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.variantName}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{v.sku}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={variantQtyMap[v.id] ?? ""}
                          onChange={(e) => setVariantQtyMap((prev) => ({ ...prev, [v.id]: Math.max(0, Number(e.target.value)) }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={variantPriceMap[v.id] ?? ""}
                          onChange={(e) => setVariantPriceMap((prev) => ({ ...prev, [v.id]: Math.max(0, Number(e.target.value)) }))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleAddVariants} className="gap-1">
              <Check className="h-4 w-4" /> Add Selected Variants
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
