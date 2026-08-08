"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Barcode,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
  Minus,
  Package,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  Send,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient, PagedResult } from "@/lib/api-client";
import type { Location } from "@/lib/types/master";
import type { ProductSummary, Variant, Barcode as ProductBarcode } from "@/lib/types/product";

interface Customer {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin?: string | null;
  active: boolean;
}

interface PriceMap {
  [priceListId: number]: number;
}

interface SellableItem {
  productId: number;
  variantId: number | null;
  code: string;
  name: string;
  variantName?: string | null;
  sku: string;
  barcodes: string[];
  price: number;
  pricesByList?: PriceMap;
  imageUrl?: string | null;
  stockQty?: number;
  taxPercentage: number;
}

interface CartItem {
  sellable: SellableItem;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface SalesInvoiceResult {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerPhone?: string;
  customerGstin?: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  locationName: string;
  locationUpiId?: string;
  locationGstin?: string;
  lines: Array<{
    productName: string;
    variantName?: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

export function POSClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const barcodeInputRef = React.useRef<HTMLInputElement | null>(null);

  // Active Location & Context
  const contextQuery = useQuery({
    queryKey: ["users", "me", "context"],
    queryFn: () => apiClient.get<{ activeLocation: Location | null }>("users/me/context"),
  });
  const activeLocation = contextQuery.data?.activeLocation ?? null;

  // Current user's permissions (drives the discount override gate below)
  const permissionsQuery = useQuery({
    queryKey: ["users", "me", "permissions"],
    queryFn: () => apiClient.get<string[]>("users/me/permissions"),
  });
  const canOverrideDiscount = (permissionsQuery.data ?? []).includes("SALES_DISCOUNT_OVERRIDE");
  const DISCOUNT_SELF_SERVICE_LIMIT = 10;

  // State
  const [barcodeInput, setBarcodeInput] = React.useState("");
  const [productSearch, setProductSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("ALL");

  // Customer State
  const [customerPhoneQuery, setCustomerPhoneQuery] = React.useState("");
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = React.useState(false);

  // New Customer Form State
  const [newCustName, setNewCustName] = React.useState("");
  const [newCustPhone, setNewCustPhone] = React.useState("");
  const [newCustEmail, setNewCustEmail] = React.useState("");
  const [newCustGstin, setNewCustGstin] = React.useState("");

  // Cart & Payment
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "UPI" | "CARD" | "NETBANKING">("UPI");
  const [tenderedCash, setTenderedCash] = React.useState("");
  const [discountInput, setDiscountInput] = React.useState("");

  // Invoice Result Modal
  const [postedInvoice, setPostedInvoice] = React.useState<SalesInvoiceResult | null>(null);
  const [isSendingWa, setIsSendingWa] = React.useState(false);

  // 1. Fetch Customers — use isolated key so we don't collide with
  // sales-client.tsx which caches a PagedResult shape on ["sales","customers"]
  const customersQuery = useQuery({
    queryKey: ["pos", "customers"],
    queryFn: async () => {
      const res = await apiClient.get<PagedResult<Customer>>("sales/customers?page=0&size=100");
      // Guard: API may return PagedResult or raw array depending on cache shape
      const items = Array.isArray(res) ? res : res.content ?? [];
      return (items as Customer[]).filter((c) => c.active);
    },
  });

  // 1.5 Fetch Store Allotted Price Lists
  const storePriceListsQuery = useQuery({
    queryKey: ["master", "locations", activeLocation?.id, "price-lists"],
    enabled: !!activeLocation?.id,
    queryFn: async () => {
      const res = await apiClient.get<any>(`master/locations/${activeLocation!.id}/price-lists`);
      return Array.isArray(res) ? res : res.content ?? [];
    },
  });

  const storePriceLists: any[] = storePriceListsQuery.data ?? [];
  const [selectedPriceListId, setSelectedPriceListId] = React.useState<number | null>(null);

  // Set default price list when loaded
  React.useEffect(() => {
    if (storePriceLists.length > 0 && !selectedPriceListId) {
      const defaultPl = storePriceLists.find((pl) => pl.isDefault) || storePriceLists[0];
      setSelectedPriceListId(defaultPl.id);
    }
  }, [storePriceLists, selectedPriceListId]);

  // 2. Fetch Sellable Products with photos, barcodes, location stock and price list prices
  const sellablesQuery = useQuery({
    queryKey: ["sales", "pos-sellables", activeLocation?.id],
    queryFn: async () => {
      const p = await apiClient.get<PagedResult<ProductSummary>>("products?page=0&size=100");
      const activeProds = p.content.filter((x) => x.isActive);

      // Fetch stock for active store location if available
      let stockMap = new Map<string, number>();
      if (activeLocation?.id) {
        try {
          const stockRes = await apiClient.get<any[]>(`inventory?locationId=${activeLocation.id}`);
          if (Array.isArray(stockRes)) {
            for (const s of stockRes) {
              const key = `${s.productId}:${s.productVariantId ?? "base"}`;
              stockMap.set(key, s.availableQuantity ?? s.quantityOnHand ?? 0);
            }
          }
        } catch (e) {
          // ignore
        }
      }

      const items: SellableItem[] = [];

      for (const prod of activeProds) {
        let pricesByList: PriceMap = {};
        try {
          const pricesRes = await apiClient.get<any[]>(`products/prices/product/${prod.id}`);
          if (Array.isArray(pricesRes)) {
            for (const pr of pricesRes) {
              if (pr.sellingPrice != null && pr.isActive !== false) {
                pricesByList[pr.priceListId] = Number(pr.sellingPrice);
              }
            }
          }
        } catch (e) {
          // ignore
        }

        // Fetch barcodes for product
        let productBarcodes: ProductBarcode[] = [];
        try {
          const bRes = await apiClient.get<ProductBarcode[]>(`products/${prod.id}/barcodes`);
          if (Array.isArray(bRes)) {
            productBarcodes = bRes;
          }
        } catch (e) {
          // ignore
        }

        if (prod.hasVariants) {
          const variants = await apiClient.get<Variant[]>(`products/${prod.id}/variants`);
          for (const v of variants.filter((x) => x.isActive)) {
            const basePrice = (v as any).retailPrice || (prod as any).basePrice || 0;
            const variantBarcodes = productBarcodes.filter((b) => b.variantId === v.id).map((b) => b.barcode);
            const parentBarcodes = productBarcodes.filter((b) => b.variantId === null).map((b) => b.barcode);
            const allBarcodes = variantBarcodes.length > 0 ? variantBarcodes : parentBarcodes;

            const stockKey = `${prod.id}:${v.id}`;
            const availQty = stockMap.has(stockKey) ? stockMap.get(stockKey) : 50;

            items.push({
              productId: prod.id,
              variantId: v.id,
              code: prod.code,
              name: prod.name,
              variantName: v.variantName,
              sku: v.sku || prod.code,
              barcodes: allBarcodes,
              price: basePrice,
              pricesByList,
              imageUrl: prod.primaryImageUrl,
              stockQty: availQty,
              taxPercentage: 18,
            });
          }
        } else {
          const basePrice = (prod as any).basePrice || 0;
          const allBarcodes = productBarcodes.map((b) => b.barcode);
          const stockKey = `${prod.id}:base`;
          const availQty = stockMap.has(stockKey) ? stockMap.get(stockKey) : 50;

          items.push({
            productId: prod.id,
            variantId: null,
            code: prod.code,
            name: prod.name,
            sku: prod.code,
            barcodes: allBarcodes,
            price: basePrice,
            pricesByList,
            imageUrl: prod.primaryImageUrl,
            stockQty: availQty,
            taxPercentage: 18,
          });
        }
      }
      return items;
    },
  });

  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

  const getEffectivePrice = React.useCallback(
    (item: SellableItem, priceListId?: number | null) => {
      if (priceListId && item.pricesByList && item.pricesByList[priceListId] != null) {
        return item.pricesByList[priceListId];
      }
      return item.price || 0;
    },
    []
  );

  const handlePriceListChange = (newPlId: number) => {
    setSelectedPriceListId(newPlId);
    setCart((prev) =>
      prev.map((ci) => {
        const newPrice = getEffectivePrice(ci.sellable, newPlId);
        return {
          ...ci,
          unitPrice: newPrice,
          lineTotal: newPrice * ci.quantity,
        };
      })
    );
  };

  // Filtered Customer Search
  const matchingCustomers = React.useMemo(() => {
    if (!customersQuery.data || !customerPhoneQuery.trim()) return [];
    const q = customerPhoneQuery.trim().toLowerCase();
    return customersQuery.data.filter(
      (c) => (c.phone && c.phone.toLowerCase().includes(q)) || c.name.toLowerCase().includes(q)
    );
  }, [customersQuery.data, customerPhoneQuery]);

  // Filtered Products
  const filteredSellables = React.useMemo(() => {
    if (!sellablesQuery.data) return [];
    let items = sellablesQuery.data;
    if (productSearch.trim()) {
      const s = productSearch.trim().toLowerCase();
      items = items.filter(
        (x) =>
          x.name.toLowerCase().includes(s) ||
          x.sku.toLowerCase().includes(s) ||
          x.code.toLowerCase().includes(s) ||
          (x.variantName && x.variantName.toLowerCase().includes(s)) ||
          (x.barcodes && x.barcodes.some((b) => b.toLowerCase().includes(s)))
      );
    }
    return items;
  }, [sellablesQuery.data, productSearch]);

  // Add Item to Cart
  const addToCart = React.useCallback(
    (sellable: SellableItem) => {
      const itemUnitPrice = getEffectivePrice(sellable, selectedPriceListId);
      setCart((prev) => {
        if (!prev) return [{ sellable, quantity: 1, unitPrice: itemUnitPrice, lineTotal: itemUnitPrice }];
        const idx = prev.findIndex(
          (i) => i.sellable.productId === sellable.productId && i.sellable.variantId === sellable.variantId
        );
        if (idx >= 0) {
          const next = [...prev];
          const newQty = next[idx].quantity + 1;
          next[idx] = {
            ...next[idx],
            quantity: newQty,
            lineTotal: newQty * next[idx].unitPrice,
          };
          return next;
        }
        return [
          ...prev,
          {
            sellable,
            quantity: 1,
            unitPrice: itemUnitPrice,
            lineTotal: itemUnitPrice,
          },
        ];
      });
    },
    [getEffectivePrice, selectedPriceListId]
  );

  // Process Barcode Scan (Exact Barcode Matching)
  const processBarcodeScan = React.useCallback(
    (scannedString: string) => {
      const query = scannedString.trim();
      if (!query || !sellablesQuery.data) return false;

      // 1. Search exact barcode match first (preserving leading zeroes, string exact match)
      let match = sellablesQuery.data.find(
        (x) => x.barcodes && x.barcodes.some((b) => b === query)
      );

      // 2. Fallback to exact SKU or code match
      if (!match) {
        match = sellablesQuery.data.find(
          (x) =>
            x.sku === query ||
            x.code === query ||
            x.sku.toLowerCase() === query.toLowerCase() ||
            x.code.toLowerCase() === query.toLowerCase()
        );
      }

      if (match) {
        // Stock Validation at Active Store Location
        if (match.stockQty !== undefined && match.stockQty <= 0) {
          toast.error(`Product '${match.name}' is out of stock at this location.`);
          setBarcodeInput("");
          setTimeout(() => barcodeInputRef.current?.focus(), 10);
          return true;
        }

        addToCart(match);
        setBarcodeInput("");
        toast.success(`Scanned: ${match.name}${match.variantName ? ` (${match.variantName})` : ""}`);
        setTimeout(() => barcodeInputRef.current?.focus(), 10);
        return true;
      } else {
        toast.error(`No product found for barcode ${query}`);
        setBarcodeInput("");
        setTimeout(() => barcodeInputRef.current?.focus(), 10);
        return false;
      }
    },
    [sellablesQuery.data, addToCart]
  );

  // Handle Barcode / SKU Scan Form Submission
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    processBarcodeScan(barcodeInput);
  };

  // Cart Qty Operations
  const updateCartQty = (index: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const newQty = Math.max(0, parseFloat((next[index].quantity + delta).toFixed(3)));
      if (newQty <= 0) {
        return next.filter((_, i) => i !== index);
      }
      next[index] = {
        ...next[index],
        quantity: newQty,
        lineTotal: newQty * next[index].unitPrice,
      };
      return next;
    });
  };

  const updateCartQtyExact = (index: number, val: number) => {
    setCart((prev) => {
      const next = [...prev];
      if (isNaN(val)) return prev;
      if (val <= 0) {
        return next.filter((_, i) => i !== index);
      }
      next[index] = {
        ...next[index],
        quantity: val,
        lineTotal: val * next[index].unitPrice,
      };
      return next;
    });
  };

  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Cart Totals
  const cartSubtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const cartTax = cartSubtotal * 0.18; // 18% GST
  const discountAmount = Math.min(Math.max(Number(discountInput) || 0, 0), cartSubtotal);
  const cartGrandTotal = cartSubtotal - discountAmount; // Assuming tax inclusive retail price or compute base

  // Cashiers may round the total off by up to ₹10 unassisted; anything beyond that
  // needs the SALES_DISCOUNT_OVERRIDE permission (Admin/Owner/Manager).
  const handleDiscountChange = (raw: string) => {
    const num = Number(raw);
    if (raw !== "" && !Number.isNaN(num) && num > DISCOUNT_SELF_SERVICE_LIMIT && !canOverrideDiscount) {
      toast.error(`Discounts above ₹${DISCOUNT_SELF_SERVICE_LIMIT} require Admin, Owner, or Manager approval`);
      setDiscountInput(String(DISCOUNT_SELF_SERVICE_LIMIT));
      return;
    }
    setDiscountInput(raw);
  };

  // Create On-The-Go Customer Mutation
  const addCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!newCustName.trim()) throw new Error("Customer name is required");
      if (!newCustPhone.trim()) throw new Error("Phone number is required");

      const payload = {
        customerType: "INDIVIDUAL",
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        email: newCustEmail.trim() || null,
        gstNumber: newCustGstin.trim() || null,   // field is gstNumber, not gstin
        address: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
        customerGroupId: null,
        priceListId: null,
        preferredLocationId: null,
        creditLimit: 0,
        creditDays: 0,
        remarks: null,
        active: true,
      };

      return apiClient.post<Customer>("sales/customers", payload);
    },
    onSuccess: (newCust) => {
      toast.success("New customer registered successfully!");
      queryClient.invalidateQueries({ queryKey: ["sales", "customers"] });
      setSelectedCustomer(newCust);
      setIsAddCustomerOpen(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
      setNewCustGstin("");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to register customer"),
  });

  // Post Sales Invoice Mutation
  const postInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!activeLocation) throw new Error("No active store location selected");
      if (!selectedCustomer) throw new Error("Please select or add a customer before checkout");
      if (cart.length === 0) throw new Error("Cart is empty");
      if (discountAmount > DISCOUNT_SELF_SERVICE_LIMIT && !canOverrideDiscount) {
        throw new Error(`Discounts above ₹${DISCOUNT_SELF_SERVICE_LIMIT} require Admin, Owner, or Manager approval`);
      }

      const invoiceDate = new Date().toISOString().split("T")[0];
      // Spread the flat rupee discount across lines as an equal discount percentage
      // so the invoice total matches what's shown at the register.
      const linesDiscountPct = cartSubtotal > 0 ? (discountAmount / cartSubtotal) * 100 : 0;

      const payload = {
        customerId: selectedCustomer.id,
        locationId: activeLocation.id,
        invoiceDate,
        dueDate: invoiceDate,
        lines: cart.map((item) => ({
          productId: item.sellable.productId,
          productVariantId: item.sellable.variantId,
          quantity: item.quantity,
          sellingPrice: item.unitPrice,
          discountPercentage: Math.min(100, Math.max(0, Number(linesDiscountPct.toFixed(2)))),
        })),
        payments: [
          {
            paymentMethodCode: paymentMethod,
            amount: cartGrandTotal,
            paymentDate: invoiceDate,
            referenceNumber: null,
          },
        ],
      };

      const result = await apiClient.post<SalesInvoiceResult>("sales/invoices", payload);
      return result;
    },
    onSuccess: (data) => {
      toast.success("Sales Invoice & Payment posted successfully!");
      setPostedInvoice(data);
      setIsPaymentOpen(false);
      setCart([]);
      setDiscountInput("");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to post sale invoice"),
  });

  // Send WhatsApp Invoice
  const handleSendWhatsApp = async () => {
    if (!postedInvoice) return;
    setIsSendingWa(true);
    try {
      await apiClient.post(`sales/invoices/${postedInvoice.id}/send-whatsapp`, {});
      toast.success("Tax Invoice sent successfully to customer WhatsApp!");
    } catch (e: any) {
      toast.error(e.message || "Failed to send WhatsApp message. Verify Meta API config.");
    } finally {
      setIsSendingWa(false);
    }
  };

  const storeUpiId = activeLocation?.upiId || "fiyoraerp@upi";
  const storeName = activeLocation?.name || "Fiyora Store";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top POS Header Bar */}
      <header className="h-14 border-b bg-card px-4 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sales")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Sales
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm tracking-tight">{activeLocation?.name || "Main Store Terminal"}</span>
            {activeLocation?.code && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {activeLocation.code}
              </Badge>
            )}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          {storePriceLists.length > 0 && (
            <div className="flex items-center gap-1.5 bg-muted/60 border rounded-lg px-2.5 py-1 text-xs shadow-inner">
              <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-semibold text-muted-foreground hidden sm:inline">Price List:</span>
              <select
                className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer pr-1"
                value={selectedPriceListId || ""}
                onChange={(e) => handlePriceListChange(Number(e.target.value))}
              >
                {storePriceLists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} ({pl.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1">
            POS Ready
          </Badge>
        </div>
      </header>

      {/* Main POS 2-Column Split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Customer & Cart */}
        <div className="w-[420px] lg:w-[460px] border-r flex flex-col bg-card shrink-0">
          {/* Customer Selection & Auto-Suggest */}
          <div className="p-3 border-b space-y-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" /> Customer Info *
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddCustomerOpen(true)}
                className="h-7 text-xs text-primary hover:text-primary gap-1 px-2"
              >
                <UserPlus className="h-3.5 w-3.5" /> + On-The-Go
              </Button>
            </div>

            {selectedCustomer ? (
              <div className="p-2.5 rounded-lg border bg-background flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-foreground">{selectedCustomer.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {selectedCustomer.phone || "No phone"} • {selectedCustomer.code}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => setSelectedCustomer(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Enter phone number or customer name..."
                  value={customerPhoneQuery}
                  onChange={(e) => setCustomerPhoneQuery(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
                {/* Auto-suggest Dropdown */}
                {customerPhoneQuery.trim() !== "" && (
                  <div className="absolute left-0 right-0 top-10 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto z-50 divide-y">
                    {matchingCustomers.length === 0 ? (
                      <div className="p-3 text-center">
                        <p className="text-xs text-muted-foreground">No customer matching "{customerPhoneQuery}"</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNewCustPhone(customerPhoneQuery);
                            setIsAddCustomerOpen(true);
                          }}
                          className="mt-2 text-xs h-7 gap-1"
                        >
                          <UserPlus className="h-3 w-3" /> Add "{customerPhoneQuery}"
                        </Button>
                      </div>
                    ) : (
                      matchingCustomers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerPhoneQuery("");
                          }}
                          className="p-2 text-xs hover:bg-accent cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium text-foreground">{c.name}</div>
                            <div className="text-[10px] text-muted-foreground">{c.phone || "No phone"}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {c.code}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Barcode Scanner Input */}
          <div className="p-3 border-b bg-background">
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-primary" />
              <Input
                ref={barcodeInputRef}
                placeholder="Scan barcode or type SKU & press Enter..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="pl-9 pr-12 text-xs h-9 font-mono"
                autoFocus
              />
              <Button type="submit" size="sm" variant="ghost" className="absolute right-1 top-1 h-7 px-2 text-xs">
                Scan
              </Button>
            </form>
          </div>

          {/* Cart Table */}
          <div className="flex-1 overflow-auto p-0">
            {cart.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <ShoppingCart className="h-10 w-10 mx-auto opacity-30" />
                <p className="text-xs">Cart is empty. Scan barcode or click items to add.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[180px]">Item</TableHead>
                    <TableHead className="text-center w-[90px]">Qty</TableHead>
                    <TableHead className="text-right w-[90px]">Price</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs p-2.5">
                        <div className="line-clamp-1">{item.sellable.name}</div>
                        {item.sellable.variantName && (
                          <div className="text-[10px] text-muted-foreground">{item.sellable.variantName}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground font-mono">{item.sellable.sku}</div>
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => updateCartQty(idx, -1)}
                          >
                            <Minus className="h-2.5 w-2.5" />
                          </Button>
                          <Input
                            type="number"
                            step="any"
                            min="0.001"
                            value={item.quantity}
                            onChange={(e) => updateCartQtyExact(idx, Number(e.target.value))}
                            className="h-6 w-14 text-center text-xs font-bold px-1"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => updateCartQty(idx, 1)}
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="p-2.5 text-right text-xs font-semibold">
                        {money.format(item.lineTotal)}
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeCartItem(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Cart Footer Summary */}
          <div className="p-3 border-t bg-muted/20 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Items ({parseFloat(cart.reduce((a, c) => a + c.quantity, 0).toFixed(3))})</span>
              <span>{money.format(cartSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <Label htmlFor="posDiscount" className="text-muted-foreground shrink-0">
                Discount (₹){!canOverrideDiscount && ` — up to ₹${DISCOUNT_SELF_SERVICE_LIMIT}`}
              </Label>
              <Input
                id="posDiscount"
                type="number"
                min={0}
                max={canOverrideDiscount ? undefined : DISCOUNT_SELF_SERVICE_LIMIT}
                placeholder="0"
                value={discountInput}
                onChange={(e) => handleDiscountChange(e.target.value)}
                className="h-7 w-24 text-right text-xs"
              />
            </div>
            <div className="flex justify-between text-base font-bold pt-1 border-t">
              <span>Total Payable</span>
              <span className="text-primary">{money.format(cartGrandTotal)}</span>
            </div>

            <Button
              onClick={() => {
                if (!selectedCustomer) {
                  toast.error("Please select or add a customer first");
                  return;
                }
                if (cart.length === 0) {
                  toast.error("Cart is empty");
                  return;
                }
                if (discountAmount > DISCOUNT_SELF_SERVICE_LIMIT && !canOverrideDiscount) {
                  toast.error(`Discounts above ₹${DISCOUNT_SELF_SERVICE_LIMIT} require Admin, Owner, or Manager approval`);
                  return;
                }
                setIsPaymentOpen(true);
              }}
              disabled={cart.length === 0}
              className="w-full h-11 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg shadow-emerald-600/20"
            >
              <CreditCard className="h-4 w-4" /> Pay & Generate Invoice ({money.format(cartGrandTotal)})
            </Button>
          </div>
        </div>

        {/* Right Column: Visual Product Grid */}
        <div className="flex-1 flex flex-col bg-muted/10 overflow-hidden">
          {/* Gallery Header & Search */}
          <div className="p-3 border-b bg-card flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search catalog by name, code, SKU or scan barcode..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && productSearch.trim()) {
                    e.preventDefault();
                    const query = productSearch.trim();
                    const handled = processBarcodeScan(query);
                    if (handled) {
                      setProductSearch("");
                    }
                  }
                }}
                className="pl-8 text-xs h-9"
              />
            </div>
            <Badge variant="outline" className="text-xs">
              {filteredSellables.length} Products
            </Badge>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-auto p-4">
            {sellablesQuery.isLoading ? (
              <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog items...
              </div>
            ) : filteredSellables.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">No products match your search.</div>
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredSellables.map((prod, idx) => (
                  <Card
                    key={idx}
                    onClick={() => addToCart(prod)}
                    className="group cursor-pointer hover:shadow-md hover:border-primary transition-all duration-200 overflow-hidden flex flex-col justify-between"
                  >
                    <div className="h-28 bg-muted/40 relative flex items-center justify-center p-2">
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="h-full w-full object-contain group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Package className="h-10 w-10 text-muted-foreground/30" />
                      )}
                      <Badge variant="secondary" className="absolute top-1 right-1 text-[9px] font-mono opacity-80">
                        {prod.sku}
                      </Badge>
                    </div>
                    <CardContent className="p-2.5 space-y-1">
                      <div className="font-semibold text-xs line-clamp-1 group-hover:text-primary transition-colors">
                        {prod.name}
                      </div>
                      {prod.variantName && (
                        <div className="text-[10px] text-muted-foreground">{prod.variantName}</div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-xs font-bold text-foreground">
                          {money.format(getEffectivePrice(prod, selectedPriceListId))}
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full group-hover:bg-primary group-hover:text-primary-foreground">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* On-The-Go Add Customer Modal */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <UserPlus className="h-5 w-5" /> Quick Add Customer On-the-Go
            </DialogTitle>
            <DialogDescription className="text-xs">
              Register customer details instantly during checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="cname" className="text-xs">Customer Name *</Label>
              <Input
                id="cname"
                placeholder="e.g. Rahul Sharma"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cphone" className="text-xs">Phone Number *</Label>
              <Input
                id="cphone"
                placeholder="+91 98765 43210"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cemail" className="text-xs">Email Address (Optional)</Label>
              <Input
                id="cemail"
                type="email"
                placeholder="rahul@example.com"
                value={newCustEmail}
                onChange={(e) => setNewCustEmail(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cgstin" className="text-xs">GSTIN (Optional)</Label>
              <Input
                id="cgstin"
                placeholder="29AAAAA0000A1Z5"
                value={newCustGstin}
                onChange={(e) => setNewCustGstin(e.target.value)}
                className="text-xs font-mono uppercase"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddCustomerOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => addCustomerMutation.mutate()}
              disabled={addCustomerMutation.isPending}
              className="gap-1.5"
            >
              {addCustomerMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save & Select Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Payment Modal with Dynamic UPI Payment QR Code */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CreditCard className="h-5 w-5" /> Select Payment Method
            </DialogTitle>
            <DialogDescription className="text-xs">
              Total Invoice Amount: <strong className="text-foreground text-sm">{money.format(cartGrandTotal)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={paymentMethod === "UPI" ? "default" : "outline"}
                onClick={() => setPaymentMethod("UPI")}
                className="h-12 flex-col gap-1 text-xs"
              >
                <QrCode className="h-4 w-4" /> UPI / QR Scan
              </Button>
              <Button
                variant={paymentMethod === "CASH" ? "default" : "outline"}
                onClick={() => setPaymentMethod("CASH")}
                className="h-12 flex-col gap-1 text-xs"
              >
                <Wallet className="h-4 w-4" /> Cash Payment
              </Button>
              <Button
                variant={paymentMethod === "CARD" ? "default" : "outline"}
                onClick={() => setPaymentMethod("CARD")}
                className="h-12 flex-col gap-1 text-xs"
              >
                <CreditCard className="h-4 w-4" /> Credit / Debit Card
              </Button>
              <Button
                variant={paymentMethod === "NETBANKING" ? "default" : "outline"}
                onClick={() => setPaymentMethod("NETBANKING")}
                className="h-12 flex-col gap-1 text-xs"
              >
                <Building2 className="h-4 w-4" /> NetBanking
              </Button>
            </div>

            {/* Dynamic UPI Payment QR Code Display */}
            {paymentMethod === "UPI" && (
              <div className="p-4 rounded-xl border bg-muted/30 flex flex-col items-center justify-center space-y-2">
                <div className="p-2 bg-white rounded-lg border shadow-sm">
                  <QRCodeSVG
                    value={`upi://pay?pa=${storeUpiId}&pn=${encodeURIComponent(storeName)}&am=${cartGrandTotal}&cu=INR`}
                    size={150}
                    level="M"
                  />
                </div>
                <div className="text-center space-y-0.5">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    UPI ID: {storeUpiId}
                  </Badge>
                  <p className="text-[11px] text-muted-foreground">
                    Scan with PhonePe, Google Pay, or Paytm to transfer {money.format(cartGrandTotal)}
                  </p>
                </div>
              </div>
            )}

            {/* Cash Tendered Input */}
            {paymentMethod === "CASH" && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
                <Label htmlFor="cashAmt" className="text-xs">Tendered Cash Amount (₹)</Label>
                <Input
                  id="cashAmt"
                  type="number"
                  placeholder={String(cartGrandTotal)}
                  value={tenderedCash}
                  onChange={(e) => setTenderedCash(e.target.value)}
                  className="text-sm font-bold"
                />
                {Number(tenderedCash) > cartGrandTotal && (
                  <div className="text-xs text-emerald-600 font-semibold">
                    Change to return: {money.format(Number(tenderedCash) - cartGrandTotal)}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => postInvoiceMutation.mutate()}
              disabled={postInvoiceMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {postInvoiceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Payment & Print Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reference Invoice View & Print / WhatsApp Dialog */}
      {postedInvoice && (
        <Dialog open={!!postedInvoice} onOpenChange={() => setPostedInvoice(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent shadow-2xl">
            <div className="bg-card border rounded-xl overflow-hidden shadow-2xl">
              {/* Top Invoice Actions Bar */}
              <div className="p-4 border-b bg-muted/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  <h2 className="font-bold text-base">Invoice #{postedInvoice.invoiceNumber}</h2>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    {postedInvoice.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSendWhatsApp}
                    disabled={isSendingWa}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold"
                  >
                    {isSendingWa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Send via WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 text-xs">
                    <Printer className="h-3.5 w-3.5" /> Print
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPostedInvoice(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Classic Ads / Reference Invoice Layout */}
              <div className="p-8 space-y-6 bg-white dark:bg-card text-foreground">
                {/* Header Section */}
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight">{postedInvoice.locationName}</h1>
                    <p className="text-xs text-muted-foreground mt-1">123 Retail Avenue, Main Store</p>
                    {activeLocation?.gstin && (
                      <Badge variant="outline" className="mt-1 text-[10px] font-mono">
                        GSTIN: {activeLocation.gstin}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <QRCodeSVG value={`https://fiyoraerp.com/verify/sales-invoice-${postedInvoice.id}`} size={64} level="M" />
                      <span className="text-[9px] text-muted-foreground mt-1 font-bold uppercase tracking-widest">
                        Scan to Verify
                      </span>
                    </div>
                    <div className="text-right">
                      <h2 className="text-xl font-black text-primary tracking-tight">INVOICE</h2>
                      <Badge className="bg-emerald-500 text-white text-[10px] uppercase font-bold">PAID</Badge>
                    </div>
                  </div>
                </div>

                {/* Edge-to-Edge Meta Strip */}
                <div className="px-4 py-3 bg-muted/30 rounded-lg border grid grid-cols-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Invoice No</span>
                    <span className="font-semibold">{postedInvoice.invoiceNumber}</span>
                  </div>
                  <div className="border-l pl-3">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Date</span>
                    <span className="font-semibold">{postedInvoice.invoiceDate}</span>
                  </div>
                  <div className="border-l pl-3">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Payment Method</span>
                    <span className="font-semibold text-emerald-600">{paymentMethod}</span>
                  </div>
                  <div className="border-l pl-3">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Status</span>
                    <span className="font-semibold text-emerald-600">{postedInvoice.status}</span>
                  </div>
                </div>

                {/* Billed To */}
                <div className="grid grid-cols-2 gap-4 border-b pb-4 text-xs">
                  <div>
                    <span className="text-muted-foreground uppercase font-bold text-[10px] block mb-1">Billed To</span>
                    <div className="font-bold text-sm">{postedInvoice.customerName}</div>
                    {postedInvoice.customerPhone && (
                      <div className="text-muted-foreground">Phone: {postedInvoice.customerPhone}</div>
                    )}
                    {postedInvoice.customerGstin && (
                      <div className="text-muted-foreground font-mono">GSTIN: {postedInvoice.customerGstin}</div>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground uppercase font-bold text-[10px] block mb-1">Store Details</span>
                    <div className="font-semibold">{postedInvoice.locationName}</div>
                    <div className="text-muted-foreground">Thank you for your business!</div>
                  </div>
                </div>

                {/* Line Items Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[240px]">Description</TableHead>
                      <TableHead className="text-center w-[80px]">Qty</TableHead>
                      <TableHead className="text-right w-[120px]">Rate (₹)</TableHead>
                      <TableHead className="text-right w-[130px]">Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postedInvoice.lines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-xs">
                          <div>{line.productName}</div>
                          {line.variantName && <div className="text-[11px] text-muted-foreground">{line.variantName}</div>}
                        </TableCell>
                        <TableCell className="text-center text-xs">{line.quantity}</TableCell>
                        <TableCell className="text-right text-xs">{money.format(line.unitPrice)}</TableCell>
                        <TableCell className="text-right font-semibold text-xs">{money.format(line.lineTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Footer Split: Dynamic UPI Payment QR Code & Totals */}
                <div className="flex justify-between items-end pt-4 border-t">
                  <div className="flex flex-col items-center justify-center p-3 border rounded-lg bg-muted/20 w-fit">
                    <QRCodeSVG
                      value={`upi://pay?pa=${storeUpiId}&pn=${encodeURIComponent(storeName)}&am=${postedInvoice.totalAmount}&cu=INR`}
                      size={80}
                      level="L"
                    />
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      Dynamic UPI Payment QR
                    </span>
                  </div>

                  <div className="min-w-[240px] space-y-1.5 text-xs text-right">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{money.format(postedInvoice.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-1">
                      <span className="font-bold text-sm">Total Paid</span>
                      <span className="text-lg font-bold text-primary">{money.format(postedInvoice.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Bar: Signatory Block */}
                <div className="flex justify-between items-end pt-6 border-t text-[11px] text-muted-foreground">
                  <div>This is a electronically verified tax invoice receipt.</div>
                  <div className="text-right space-y-1">
                    <div className="font-bold text-foreground">{postedInvoice.locationName}</div>
                    <div className="text-[10px]">Authorised Signatory</div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
