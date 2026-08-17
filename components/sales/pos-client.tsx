"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Barcode,
  Building2,
  Camera,
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
  Minus,
  MoreVertical,
  Layers,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CameraScannerDialog, isMobileDevice } from "@/components/shared/camera-scanner-dialog";
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

interface ProductGroup {
  productId: number;
  code: string;
  name: string;
  imageUrl?: string | null;
  variants: SellableItem[];
}

interface SalesInvoiceResult {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerPhone?: string;
  customerGstin?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  creditAppliedAmount: number;
  previousBalance?: number;
  tenderedCash?: number;
  changeDue?: number;
  paymentMethod: string;
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
  // Whether to redeem the selected customer's store credit against this
  // bill. Defaults on whenever a customer with available credit is picked.
  const [applyStoreCredit, setApplyStoreCredit] = React.useState(true);

  // New Customer Form State
  const [newCustName, setNewCustName] = React.useState("");
  const [newCustPhone, setNewCustPhone] = React.useState("");
  const [newCustEmail, setNewCustEmail] = React.useState("");
  const [newCustGstin, setNewCustGstin] = React.useState("");

  // Cart & Payment
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [mobileCartOpen, setMobileCartOpen] = React.useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = React.useState(false);
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

  // 1.2 Selected customer's redeemable store credit (from overpayments /
  // return excesses) and any balance still owed from earlier invoices.
  const customerCreditQuery = useQuery({
    queryKey: ["pos", "customers", selectedCustomer?.id, "credits"],
    enabled: !!selectedCustomer?.id,
    queryFn: async () => {
      try {
        return await apiClient.get<{ customerId: number; availableAmount: number }>(
          `sales/customers/${selectedCustomer!.id}/credits`
        );
      } catch {
        return { customerId: selectedCustomer!.id, availableAmount: 0 };
      }
    },
  });
  const availableCredit = customerCreditQuery.data?.availableAmount ?? 0;

  const customerLedgerSummaryQuery = useQuery({
    queryKey: ["pos", "customers", selectedCustomer?.id, "ledger-summary"],
    enabled: !!selectedCustomer?.id,
    queryFn: async () => {
      try {
        return await apiClient.get<{ summary: { outstandingBalance: number } }>(
          `sales/customers/${selectedCustomer!.id}/ledger?page=0&size=1`
        );
      } catch {
        return { summary: { customerId: selectedCustomer!.id, customerCode: "", customerName: "", outstandingBalance: 0 } };
      }
    },
  });
  // outstandingBalance already nets out open credit, so what's still owed
  // from PRIOR invoices is outstanding + this customer's available credit.
  const priorBalanceDue = Math.max(
    0,
    Number(customerLedgerSummaryQuery.data?.summary?.outstandingBalance ?? 0)
  );

  // Reset the "apply credit" toggle to on whenever a different customer
  // (or one with no credit) is selected, so a stale unchecked state from a
  // previous customer never silently carries over.
  React.useEffect(() => {
    setApplyStoreCredit(true);
  }, [selectedCustomer?.id]);

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
          const stockRes = await apiClient.get<any>(`inventory?locationId=${activeLocation.id}&size=500`);
          const stockList = Array.isArray(stockRes) ? stockRes : stockRes?.content ?? [];
          for (const s of stockList) {
            const key = `${s.productId}:${s.productVariantId ?? "base"}`;
            stockMap.set(key, Number(s.availableQuantity ?? s.quantityOnHand ?? 0));
          }
        } catch (e) {
          // ignore
        }
      }

      // Fetch master taxes to resolve product-associated tax rates
      let taxMap = new Map<number, number>();
      try {
        const taxesRes = await apiClient.get<any>("master/taxes?page=0&size=100");
        const list = Array.isArray(taxesRes) ? taxesRes : taxesRes?.content ?? [];
        for (const t of list) {
          if (t.id != null && t.taxPercentage != null) {
            taxMap.set(t.id, Number(t.taxPercentage));
          }
        }
      } catch (e) {
        // ignore
      }

      const items: SellableItem[] = [];

      for (const prod of activeProds) {
        let resolvedTaxId = (prod as any).taxId;
        if (!resolvedTaxId) {
          try {
            const detail = await apiClient.get<any>(`products/${prod.id}`);
            if (detail?.taxId) resolvedTaxId = detail.taxId;
          } catch (e) {
            // ignore
          }
        }
        const prodTaxPercentage = resolvedTaxId && taxMap.has(resolvedTaxId) ? taxMap.get(resolvedTaxId)! : 18;

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
            const availQty = stockMap.has(stockKey) ? stockMap.get(stockKey)! : 0;

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
              taxPercentage: prodTaxPercentage,
            });
          }
        } else {
          const basePrice = (prod as any).basePrice || 0;
          const allBarcodes = productBarcodes.map((b) => b.barcode);
          const stockKey = `${prod.id}:base`;
          const availQty = stockMap.has(stockKey) ? stockMap.get(stockKey)! : 0;

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
            taxPercentage: prodTaxPercentage,
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

  // Group Sellables by Parent Product (Flipkart-style: one card per product,
  // variants picked via chips on the card instead of one card per SKU).
  const productGroups = React.useMemo(() => {
    if (!sellablesQuery.data) return [];
    const map = new Map<number, ProductGroup>();
    for (const item of sellablesQuery.data) {
      const existing = map.get(item.productId);
      if (existing) {
        existing.variants.push(item);
      } else {
        map.set(item.productId, {
          productId: item.productId,
          code: item.code,
          name: item.name,
          imageUrl: item.imageUrl,
          variants: [item],
        });
      }
    }
    return Array.from(map.values());
  }, [sellablesQuery.data]);

  // Filtered Products — a product matches if its name/code match, or ANY of
  // its variants match; once a group matches, all of its variants stay
  // selectable on the card (not just the one that matched the search).
  const filteredProductGroups = React.useMemo(() => {
    if (!productSearch.trim()) return productGroups;
    const s = productSearch.trim().toLowerCase();
    return productGroups.filter(
      (group) =>
        group.name.toLowerCase().includes(s) ||
        group.code.toLowerCase().includes(s) ||
        group.variants.some(
          (v) =>
            v.sku.toLowerCase().includes(s) ||
            (v.variantName && v.variantName.toLowerCase().includes(s)) ||
            (v.barcodes && v.barcodes.some((b) => b.toLowerCase().includes(s)))
        )
    );
  }, [productGroups, productSearch]);

  // Add Item to Cart (with strict Inventory Stock Validation)
  const addToCart = React.useCallback(
    (sellable: SellableItem, quantityToAdd: number = 1): boolean => {
      // Stock Validation: Check available inventory at active location
      const existingInCart = cart?.find(
        (i) => i.sellable.productId === sellable.productId && i.sellable.variantId === sellable.variantId
      )?.quantity ?? 0;

      const totalRequested = existingInCart + quantityToAdd;
      if (sellable.stockQty !== undefined) {
        if (sellable.stockQty <= 0) {
          toast.error(`'${sellable.name}' (${sellable.variantName || sellable.sku}) is Out of Stock in inventory.`);
          return false;
        }
        if (totalRequested > sellable.stockQty) {
          toast.error(
            `Insufficient available stock for '${sellable.name}' (${sellable.variantName || sellable.sku}). Inventory stock: ${sellable.stockQty}, already in cart: ${existingInCart}.`
          );
          return false;
        }
      }

      const itemUnitPrice = getEffectivePrice(sellable, selectedPriceListId);
      setCart((prev) => {
        if (!prev) return [{ sellable, quantity: quantityToAdd, unitPrice: itemUnitPrice, lineTotal: itemUnitPrice * quantityToAdd }];
        const idx = prev.findIndex(
          (i) => i.sellable.productId === sellable.productId && i.sellable.variantId === sellable.variantId
        );
        if (idx >= 0) {
          const next = [...prev];
          const newQty = next[idx].quantity + quantityToAdd;
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
            quantity: quantityToAdd,
            unitPrice: itemUnitPrice,
            lineTotal: itemUnitPrice * quantityToAdd,
          },
        ];
      });
      return true;
    },
    [cart, getEffectivePrice, selectedPriceListId]
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

  // Cart Qty Operations (with Inventory Stock Validation)
  const updateCartQty = (index: number, delta: number) => {
    const item = cart[index];
    if (!item) return;
    const newQty = Math.max(0, parseFloat((item.quantity + delta).toFixed(3)));

    if (delta > 0 && item.sellable.stockQty !== undefined && newQty > item.sellable.stockQty) {
      toast.error(
        `Insufficient available stock for '${item.sellable.name}' (${item.sellable.variantName || item.sellable.sku}). Inventory stock: ${item.sellable.stockQty}`
      );
      return;
    }

    setCart((prev) => {
      const next = [...prev];
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
    const item = cart[index];
    if (!item || isNaN(val)) return;

    if (val > item.quantity && item.sellable.stockQty !== undefined && val > item.sellable.stockQty) {
      toast.error(
        `Insufficient available stock for '${item.sellable.name}' (${item.sellable.variantName || item.sellable.sku}). Inventory stock: ${item.sellable.stockQty}`
      );
      return;
    }

    setCart((prev) => {
      const next = [...prev];
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
  // Mirrors the backend's per-line calc (lineBase -> discount -> tax on the
  // discounted base) so the amount shown/charged here matches what the
  // server computes when the invoice is created. The server's own totals
  // (fetched after invoice creation) remain the source of truth for the
  // actual payment amount -- this is only a checkout-time preview.
  const cartSubtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const discountAmount = Math.min(Math.max(Number(discountInput) || 0, 0), cartSubtotal);
  const cartTaxableBase = cartSubtotal - discountAmount;
  const cartTax = cart.reduce((sum, item) => {
    const itemDiscountShare = cartSubtotal > 0 ? (item.lineTotal / cartSubtotal) * discountAmount : 0;
    const itemTaxable = Math.max(0, item.lineTotal - itemDiscountShare);
    const rate = item.sellable.taxPercentage ?? 18;
    return sum + (itemTaxable * (rate / 100));
  }, 0);
  const cartGrandTotal = cartTaxableBase + cartTax;

  // Store credit redeemed against this bill (capped at what's actually
  // owed) -- only the remainder needs an actual payment method.
  const creditToApply = applyStoreCredit ? Math.min(availableCredit, cartGrandTotal) : 0;
  const amountDueAfterCredit = cartGrandTotal - creditToApply;

  // What the cashier actually typed into "Tendered Cash Amount" is only
  // meaningful when it's a genuine partial tender (less than what's due
  // after credit) -- anything blank/invalid/>=due means "paid in full" (a
  // >= due tender just returns change, it isn't a lesser payment). Returns
  // null for "pay in full", otherwise the rupee amount to actually record.
  const partialCashAmount = React.useMemo(() => {
    if (paymentMethod !== "CASH") return null;
    const tendered = Number(tenderedCash);
    if (!tenderedCash.trim() || Number.isNaN(tendered) || tendered <= 0 || tendered >= amountDueAfterCredit) {
      return null;
    }
    return tendered;
  }, [paymentMethod, tenderedCash, amountDueAfterCredit]);

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

  // Post Sales Invoice + Auto-Record Payment Mutation
  //
  // Two-step flow against the backend:
  //   1. Create the invoice with an EMPTY payments list. The server computes
  //      the authoritative totalAmount (tax added on top of sellingPrice,
  //      HALF_UP rounding per line) and returns it in `balanceAmount`.
  //   2. Immediately record a payment for exactly that `balanceAmount`.
  // This guarantees the payment always matches the server's own total to
  // the cent, so the invoice reliably lands on PAID instead of drifting
  // into PARTIALLY_PAID (which happened before because the client sent a
  // pre-computed amount that didn't include tax the same way the server
  // does). Both calls happen automatically as part of one checkout click.
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
        payments: [],
        applyCreditAmount: creditToApply > 0 ? Number(creditToApply.toFixed(2)) : undefined,
      };

      const invoice = await apiClient.post<{
        id: number;
        invoiceNumber: string;
        invoiceDate: string;
        totalAmount: number;
        paidAmount: number;
        creditAppliedAmount: number;
        balanceAmount: number;
        status: string;
        lines: Array<{
          productName: string;
          variantName?: string | null;
          variantSku?: string | null;
          quantity: number;
          sellingPrice: number;
          lineTotal: number;
        }>;
      }>("sales/invoices", payload);

      let paidAmount = invoice.paidAmount;
      let status = invoice.status;

      // Only Cash has a "tendered amount" the cashier can under-fill on
      // purpose (a genuine partial payment). UPI/Card/NetBanking are
      // treated as exact, so they always settle the full server-computed
      // balance. Cap the cash amount at the server's balance so a stale
      // client-side preview never causes an "amount exceeds total" reject.
      const paymentAmount =
        partialCashAmount != null
          ? Math.min(Number(partialCashAmount.toFixed(2)), invoice.balanceAmount)
          : invoice.balanceAmount;

      if (invoice.balanceAmount > 0) {
        try {
          const paymentResult = await apiClient.post<{
            paidAmount: number;
            balanceAmount: number;
            status: string;
          }>(`sales/invoices/${invoice.id}/payments`, {
            paymentMethodCode: paymentMethod,
            amount: paymentAmount,
            paymentDate: invoiceDate,
            referenceNumber: null,
          });
          paidAmount = paymentResult.paidAmount;
          status = paymentResult.status;
        } catch (payErr) {
          const reason = payErr instanceof Error ? payErr.message : "Unknown error";
          throw new Error(
            `Invoice ${invoice.invoiceNumber} was created but payment could not be recorded automatically (${reason}). Record it from the Sales screen.`
          );
        }
      }

      // Auto-settle previous unpaid invoices for this customer when previous dues are collected
      if (priorBalanceDue > 0 && selectedCustomer?.id) {
        try {
          const openRes = await apiClient.get<PagedResult<any>>(
            `sales/invoices?customerId=${selectedCustomer.id}&size=50`
          );
          const openList = (openRes?.content ?? [])
            .filter((inv: any) => inv.id !== invoice.id && inv.balanceAmount > 0 && inv.status !== "CANCELLED");

          let remDues = priorBalanceDue;
          for (const openInv of openList) {
            if (remDues <= 0) break;
            const payForOld = Math.min(remDues, openInv.balanceAmount);
            try {
              await apiClient.post(`sales/invoices/${openInv.id}/payments`, {
                paymentMethodCode: paymentMethod,
                amount: payForOld,
                paymentDate: invoiceDate,
                referenceNumber: null,
              });
              remDues -= payForOld;
            } catch {
              // continue settling next open invoice
            }
          }
        } catch {
          // ignore
        }
      }

      const linesSubtotal = invoice.lines.reduce((sum, line) => sum + (line.lineTotal || 0), 0);
      const taxAmt = Math.max(0, invoice.totalAmount - linesSubtotal);
      const cashTenderedVal = paymentMethod === "CASH" && tenderedCash ? Number(tenderedCash) : 0;
      const changeVal = cashTenderedVal > paymentAmount ? cashTenderedVal - paymentAmount : 0;

      const result: SalesInvoiceResult = {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone ?? undefined,
        customerGstin: selectedCustomer.gstin ?? undefined,
        subtotal: linesSubtotal,
        taxAmount: taxAmt,
        totalAmount: invoice.totalAmount,
        paidAmount: paidAmount ?? 0,
        creditAppliedAmount: invoice.creditAppliedAmount ?? 0,
        previousBalance: priorBalanceDue > 0 ? priorBalanceDue : undefined,
        tenderedCash: cashTenderedVal > 0 ? cashTenderedVal : undefined,
        changeDue: changeVal > 0 ? changeVal : undefined,
        paymentMethod,
        status: status ?? invoice.status,
        locationName: activeLocation.name,
        locationUpiId: activeLocation.upiId ?? undefined,
        locationGstin: activeLocation.gstin ?? undefined,
        lines: invoice.lines.map((line) => ({
          productName: line.productName,
          variantName: line.variantName ?? undefined,
          sku: line.variantSku ?? undefined,
          quantity: line.quantity,
          unitPrice: line.sellingPrice,
          lineTotal: line.lineTotal,
        })),
      };
      return result;
    },
    onSuccess: (data) => {
      toast.success("Sales Invoice & Payment posted successfully!");
      setPostedInvoice(data);
      setIsPaymentOpen(false);
      setCart([]);
      setDiscountInput("");
      setTenderedCash("");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      if (selectedCustomer) {
        queryClient.invalidateQueries({ queryKey: ["pos", "customers", selectedCustomer.id, "credits"] });
        queryClient.invalidateQueries({ queryKey: ["pos", "customers", selectedCustomer.id, "ledger-summary"] });
      }
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

  const cartItemCount = parseFloat(cart.reduce((a, c) => a + c.quantity, 0).toFixed(3));

  const customerAndCartContent = (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden bg-card">
      {/* Customer Selection & Auto-Suggest */}
      <div className="p-3 border-b space-y-2 bg-muted/20 shrink-0">
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
            <div className="min-w-0 pr-2">
              <div className="font-semibold text-xs text-foreground truncate">{selectedCustomer.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {selectedCustomer.phone || "No phone"} • {selectedCustomer.code}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => setSelectedCustomer(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}

        {selectedCustomer && priorBalanceDue > 0 && (
          <div className="px-2.5 py-1.5 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            Owes {money.format(priorBalanceDue)} from previous purchases
          </div>
        )}

        {selectedCustomer && availableCredit > 0 && (
          <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium cursor-pointer">
            <span className="flex items-center gap-1.5 min-w-0">
              <input
                type="checkbox"
                checked={applyStoreCredit}
                onChange={(e) => setApplyStoreCredit(e.target.checked)}
                className="h-3.5 w-3.5 shrink-0"
              />
              <span className="truncate">Store credit: {money.format(availableCredit)}</span>
            </span>
            {applyStoreCredit && <span className="shrink-0">Applying {money.format(creditToApply)}</span>}
          </label>
        )}

        {!selectedCustomer && (
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
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-foreground truncate">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">{c.phone || "No phone"}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
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
      <div className="p-3 border-b bg-background shrink-0">
        <form onSubmit={handleBarcodeSubmit} className="relative">
          <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-primary" />
          <Input
            ref={barcodeInputRef}
            placeholder="Scan barcode or type SKU & press Enter..."
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            className="pl-9 pr-12 text-xs h-9 font-mono"
          />
          <Button type="submit" size="sm" variant="ghost" className="absolute right-1 top-1 h-7 px-2 text-xs">
            Scan
          </Button>
        </form>
      </div>

      {/* Cart Table Area */}
      <div className="flex-1 overflow-y-auto p-0 min-h-0">
        {cart.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground space-y-2">
            <ShoppingCart className="h-10 w-10 mx-auto opacity-30" />
            <p className="text-xs">Cart is empty. Scan barcode or click items to add.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30 sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[120px]">Item</TableHead>
                <TableHead className="text-center w-[90px]">Qty</TableHead>
                <TableHead className="text-right w-[80px]">Price</TableHead>
                <TableHead className="w-[36px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cart.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium text-xs p-2.5">
                    <div className="line-clamp-2 leading-snug">{item.sellable.name}</div>
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
                        className="h-6 w-12 text-center text-xs font-bold px-1"
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
                  <TableCell className="p-2.5 text-right text-xs font-semibold whitespace-nowrap">
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
      <div className="p-3 border-t bg-muted/20 space-y-2 shrink-0">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Items ({cartItemCount})</span>
          <span>{money.format(cartSubtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <Label htmlFor="posDiscount" className="text-muted-foreground shrink-0 text-xs">
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
            className="h-7 w-20 text-right text-xs"
          />
        </div>
        {(() => {
          const cartTaxRates = Array.from(new Set(cart.map((item) => item.sellable.taxPercentage ?? 18)));
          const cartTaxLabel = cartTaxRates.length === 1 ? `GST / Tax (${cartTaxRates[0]}%)` : "GST / Tax";
          return (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{cartTaxLabel}</span>
              <span className="font-medium">+{money.format(cartTax)}</span>
            </div>
          );
        })()}
        <div className="flex justify-between text-xs font-medium text-foreground pt-1 border-t">
          <span>Bill Subtotal</span>
          <span>{money.format(cartGrandTotal)}</span>
        </div>

        {priorBalanceDue > 0 && (
          <div className="flex justify-between text-xs text-amber-600 font-semibold">
            <span>Previous Customer Balance</span>
            <span>+{money.format(priorBalanceDue)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm sm:text-base font-bold pt-1 border-t">
          <span>Total Payable</span>
          <span className="text-primary">{money.format(cartGrandTotal + priorBalanceDue)}</span>
        </div>
        {creditToApply > 0 && (
          <>
            <div className="flex justify-between text-xs text-emerald-600 font-semibold">
              <span>Store Credit Applied</span>
              <span>-{money.format(creditToApply)}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm font-bold">
              <span>Amount Due</span>
              <span>{money.format(amountDueAfterCredit + priorBalanceDue)}</span>
            </div>
          </>
        )}

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
            setTenderedCash("");
            setMobileCartOpen(false);
            setIsPaymentOpen(true);
          }}
          disabled={cart.length === 0}
          className="w-full h-11 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg shadow-emerald-600/20"
        >
          <CreditCard className="h-4 w-4" /> Pay & Generate Invoice ({money.format(amountDueAfterCredit + priorBalanceDue)})
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background w-full max-w-full">
      {/* Top POS Header Bar */}
      <header className="h-14 border-b bg-card px-3 sm:px-4 flex items-center justify-between shrink-0 shadow-xs z-10 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sales")} className="h-8 px-2 text-xs">
            <ArrowLeft className="h-4 w-4 mr-1 shrink-0" /> <span className="hidden sm:inline">Sales</span>
          </Button>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0">
            <Store className="h-4 w-4 text-primary shrink-0" />
            <span className="font-bold text-xs sm:text-sm tracking-tight truncate max-w-[130px] sm:max-w-[200px]">
              {activeLocation?.name || "Main Store Terminal"}
            </span>
            {activeLocation?.code && (
              <Badge variant="outline" className="text-[10px] font-mono shrink-0 hidden sm:inline-flex">
                {activeLocation.code}
              </Badge>
            )}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {storePriceLists.length > 0 && (
            <div className="flex items-center gap-1 bg-muted/60 border rounded-lg px-2 py-1 text-xs">
              <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-semibold text-muted-foreground hidden md:inline">Price List:</span>
              <select
                className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer pr-1 text-xs max-w-[110px] sm:max-w-none"
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

          {/* Mobile Cart Toggle Button (<lg) */}
          <Button
            variant="default"
            size="sm"
            className="lg:hidden h-8 px-2.5 text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
            onClick={() => setMobileCartOpen(true)}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Cart</span>
            {cart.length > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-background text-foreground font-bold">
                {cartItemCount}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      {/* Main POS Container: Responsive Grid / Flex */}
      <div className="flex flex-1 overflow-hidden relative w-full max-w-full">
        {/* Left Column: Customer & Cart (Desktop: lg:w-[420px] xl:w-[460px], Mobile: hidden lg:flex) */}
        <div className="hidden lg:flex lg:w-[420px] xl:w-[460px] border-r flex-col bg-card shrink-0 h-full overflow-hidden">
          {customerAndCartContent}
        </div>

        {/* Right Column: Visual Product Grid & Search */}
        <div className="flex-1 flex flex-col bg-muted/10 overflow-hidden w-full min-w-0">
          {/* Mobile Customer & Scanner Strip (<lg) */}
          <div className="p-2.5 border-b bg-card space-y-2 lg:hidden shrink-0">
            {/* Customer Section on Mobile */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold flex items-center gap-1">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" /> Customer:
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddCustomerOpen(true)}
                className="h-6 text-[11px] text-primary hover:text-primary gap-1 px-1.5"
              >
                <UserPlus className="h-3 w-3" /> + Quick Add
              </Button>
            </div>

            {selectedCustomer ? (
              <div className="p-2 rounded-lg border bg-background flex items-center justify-between text-xs">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="font-semibold truncate text-foreground">{selectedCustomer.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {selectedCustomer.phone || "No phone"} • {selectedCustomer.code}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setSelectedCustomer(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Customer phone or name..."
                  value={customerPhoneQuery}
                  onChange={(e) => setCustomerPhoneQuery(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
                {customerPhoneQuery.trim() !== "" && (
                  <div className="absolute left-0 right-0 top-9 bg-popover border rounded-md shadow-lg max-h-44 overflow-auto z-50 divide-y">
                    {matchingCustomers.length === 0 ? (
                      <div className="p-2.5 text-center">
                        <p className="text-xs text-muted-foreground">No match for "{customerPhoneQuery}"</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNewCustPhone(customerPhoneQuery);
                            setIsAddCustomerOpen(true);
                          }}
                          className="mt-1.5 text-xs h-7 gap-1"
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
                          <div className="min-w-0 pr-2">
                            <div className="font-medium text-foreground truncate">{c.name}</div>
                            <div className="text-[10px] text-muted-foreground">{c.phone || "No phone"}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {c.code}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mobile Barcode Input & Camera Scan Button */}
            <form onSubmit={handleBarcodeSubmit} className="relative flex items-center gap-1.5">
              <div className="relative flex-1">
                <Barcode className="absolute left-2.5 top-2 h-4 w-4 text-primary" />
                <Input
                  placeholder="Scan barcode or type SKU..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="pl-9 pr-12 text-xs h-8 font-mono"
                />
                <Button type="submit" size="sm" variant="ghost" className="absolute right-0.5 top-0.5 h-7 px-2 text-xs">
                  Go
                </Button>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  if (isMobileDevice()) {
                    setIsCameraScannerOpen(true);
                  } else {
                    toast.info("Camera barcode scanning is available on mobile devices only.");
                  }
                }}
                className="h-8 px-2.5 text-xs font-bold gap-1 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Scan</span>
              </Button>
            </form>
          </div>

          {/* Product Search & Filter Bar */}
          <div className="p-2.5 sm:p-3 border-b bg-card flex items-center justify-between gap-2 shrink-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search catalog by name, code, SKU or barcode..."
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
                className="pl-8 text-xs h-8 sm:h-9"
              />
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              {filteredProductGroups.length} Products
            </Badge>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 pb-20 lg:pb-4">
            {sellablesQuery.isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog items...
              </div>
            ) : filteredProductGroups.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No products match your search.</div>
            ) : (
              <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredProductGroups.map((group) => (
                  <ProductGroupCard
                    key={group.productId}
                    group={group}
                    money={money}
                    getEffectivePrice={getEffectivePrice}
                    selectedPriceListId={selectedPriceListId}
                    onAdd={addToCart}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Mobile Bottom Cart Action Bar (<lg) */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-card border-t p-2.5 shadow-2xl z-30 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setMobileCartOpen(true)}>
            <div className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <ShoppingCart className="h-3.5 w-3.5 text-primary" />
              <span>{cartItemCount} item{cartItemCount === 1 ? "" : "s"}</span>
            </div>
            <div className="text-sm font-bold text-foreground truncate">
              {money.format(amountDueAfterCredit + priorBalanceDue)}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-semibold"
              onClick={() => setMobileCartOpen(true)}
            >
              View Cart
            </Button>
            <Button
              size="sm"
              className="h-9 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-md"
              onClick={() => {
                if (!selectedCustomer) {
                  toast.error("Please select or add a customer first");
                  return;
                }
                setTenderedCash("");
                setIsPaymentOpen(true);
              }}
            >
              <CreditCard className="h-3.5 w-3.5" /> Pay
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Cart Sheet / Drawer (<lg) */}
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="right" className="w-[90vw] max-w-md p-0 flex flex-col h-full bg-card">
          <SheetHeader className="p-3 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4 text-primary" /> Shopping Cart ({cartItemCount} items)
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {customerAndCartContent}
          </div>
        </SheetContent>
      </Sheet>

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
          {(() => {
            const totalCollectionAmount = amountDueAfterCredit + priorBalanceDue;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-emerald-600">
                    <CreditCard className="h-5 w-5" /> Select Payment Method
                  </DialogTitle>
                  <DialogDescription className="text-xs space-y-0.5">
                    {creditToApply > 0 && (
                      <span className="block text-emerald-600 font-medium">
                        {money.format(creditToApply)} covered by store credit
                      </span>
                    )}
                    {priorBalanceDue > 0 && (
                      <span className="block text-amber-600 font-medium">
                        Includes {money.format(priorBalanceDue)} previous customer balance
                      </span>
                    )}
                    <div>
                      Amount Due: <strong className="text-foreground text-sm">{money.format(totalCollectionAmount)}</strong>
                    </div>
                  </DialogDescription>
                </DialogHeader>

                {totalCollectionAmount <= 0 ? (
                  <div className="py-4 text-center space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                    <p className="text-sm font-semibold">Fully covered by store credit</p>
                    <p className="text-xs text-muted-foreground">No additional payment is needed for this sale.</p>
                  </div>
                ) : (
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
                            value={`upi://pay?pa=${storeUpiId}&pn=${encodeURIComponent(storeName)}&am=${totalCollectionAmount}&cu=INR`}
                            size={150}
                            level="M"
                          />
                        </div>
                        <div className="text-center space-y-0.5">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            UPI ID: {storeUpiId}
                          </Badge>
                          <p className="text-[11px] text-muted-foreground">
                            Scan with PhonePe, Google Pay, or Paytm to transfer {money.format(totalCollectionAmount)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Cash Tendered Input */}
                    {paymentMethod === "CASH" && (
                      <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
                        <Label htmlFor="cashAmt" className="text-xs">Cash Received (₹) — leave blank if paid in full</Label>
                        <Input
                          id="cashAmt"
                          type="number"
                          placeholder={String(totalCollectionAmount)}
                          value={tenderedCash}
                          onChange={(e) => setTenderedCash(e.target.value)}
                          className="text-sm font-bold"
                        />
                        {Number(tenderedCash) > totalCollectionAmount && (
                          <div className="text-xs text-emerald-600 font-semibold">
                            Change to return: {money.format(Number(tenderedCash) - totalCollectionAmount)}
                          </div>
                        )}
                        {partialCashAmount != null && (
                          <div className="text-xs text-amber-600 font-semibold">
                            Only {money.format(partialCashAmount)} will be recorded as paid — invoice will be marked
                            Partially Paid with a balance of {money.format(totalCollectionAmount - partialCashAmount)}.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                    {totalCollectionAmount <= 0
                      ? "Confirm & Print Invoice"
                      : `Confirm ${money.format(partialCashAmount ?? totalCollectionAmount)} & Print Invoice`}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Reference Invoice View & Print / WhatsApp Dialog */}
      {postedInvoice && (
        <Dialog open={!!postedInvoice} onOpenChange={() => setPostedInvoice(null)}>
          <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 border-none bg-transparent shadow-2xl">
            <div className="bg-card border rounded-xl overflow-hidden shadow-2xl text-foreground">
              {/* Top Invoice Actions Bar */}
              <div className="p-3 sm:p-4 border-b bg-muted/40 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Receipt className="h-5 w-5 text-primary shrink-0" />
                  <h2 className="font-bold text-sm sm:text-base truncate">Invoice #{postedInvoice.invoiceNumber}</h2>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0 text-[10px] sm:text-xs">
                    {postedInvoice.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 shrink-0 justify-end">
                  <Button
                    size="sm"
                    onClick={handleSendWhatsApp}
                    disabled={isSendingWa}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold h-8 px-2.5"
                  >
                    {isSendingWa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span className="hidden xs:inline">Send via</span> WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 text-xs h-8 px-2.5">
                    <Printer className="h-3.5 w-3.5" /> Print
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPostedInvoice(null)} className="h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Invoice Layout */}
              <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 bg-white dark:bg-card text-foreground">
                {/* Header Section */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight break-words">{postedInvoice.locationName}</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">123 Retail Avenue, Main Store</p>
                    {activeLocation?.gstin && (
                      <Badge variant="outline" className="mt-1 text-[10px] font-mono">
                        GSTIN: {activeLocation.gstin}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 border-t pt-3 sm:border-t-0 sm:pt-0">
                    <div className="flex flex-col items-center">
                      <QRCodeSVG value={`https://fiyoraerp.com/verify/sales-invoice-${postedInvoice.id}`} size={56} level="M" />
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5 font-bold uppercase tracking-widest">
                        Scan to Verify
                      </span>
                    </div>
                    <div className="text-right">
                      <h2 className="text-lg sm:text-xl font-black text-primary tracking-tight">INVOICE</h2>
                      <Badge
                        className={
                          postedInvoice.status === "PAID"
                            ? "bg-emerald-500 text-white text-[10px] uppercase font-bold"
                            : "bg-amber-500 text-white text-[10px] uppercase font-bold"
                        }
                      >
                        {postedInvoice.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Edge-to-Edge Meta Strip */}
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-muted/30 rounded-lg border grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Invoice No</span>
                    <span className="font-semibold break-all text-[11px] sm:text-xs">{postedInvoice.invoiceNumber}</span>
                  </div>
                  <div className="sm:border-l sm:pl-3 min-w-0">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Date</span>
                    <span className="font-semibold text-[11px] sm:text-xs">{postedInvoice.invoiceDate}</span>
                  </div>
                  <div className="sm:border-l sm:pl-3 min-w-0">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Payment Method</span>
                    <span className="font-semibold text-emerald-600 text-[11px] sm:text-xs">{paymentMethod}</span>
                  </div>
                  <div className="sm:border-l sm:pl-3 min-w-0">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Status</span>
                    <span className="font-semibold text-emerald-600 text-[11px] sm:text-xs">{postedInvoice.status}</span>
                  </div>
                </div>

                {/* Billed To */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-b pb-4 text-xs">
                  <div className="min-w-0 space-y-0.5">
                    <span className="text-muted-foreground uppercase font-bold text-[10px] block mb-1">Billed To</span>
                    <div className="font-bold text-sm break-words">{postedInvoice.customerName}</div>
                    {postedInvoice.customerPhone && (
                      <div className="text-muted-foreground">Phone: {postedInvoice.customerPhone}</div>
                    )}
                    {postedInvoice.customerGstin && (
                      <div className="text-muted-foreground font-mono break-all text-[11px]">GSTIN: {postedInvoice.customerGstin}</div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <span className="text-muted-foreground uppercase font-bold text-[10px] block mb-1">Store Details</span>
                    <div className="font-semibold break-words">{postedInvoice.locationName}</div>
                    <div className="text-muted-foreground">Thank you for your business!</div>
                  </div>
                </div>

                {/* Mobile Item List (<sm) */}
                <div className="sm:hidden space-y-2 border rounded-lg p-2.5 bg-muted/10 divide-y">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider pb-1">Purchased Items ({postedInvoice.lines.length})</div>
                  {postedInvoice.lines.map((line, idx) => (
                    <div key={idx} className="pt-2 pb-1 space-y-1 text-xs">
                      <div className="font-medium text-foreground break-words">{line.productName}</div>
                      {line.variantName && (
                        <div className="text-[11px] text-muted-foreground">{line.variantName}</div>
                      )}
                      {line.sku && (
                        <div className="text-[10px] font-mono text-muted-foreground">{line.sku}</div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                        <span>Qty: <strong className="text-foreground">{line.quantity}</strong> × {money.format(line.unitPrice)}</span>
                        <span className="font-bold text-foreground text-xs">{money.format(line.lineTotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Line Items Table (≥sm) */}
                <div className="hidden sm:block">
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
                            <div className="break-words">{line.productName}</div>
                            {line.variantName && <div className="text-[11px] text-muted-foreground">{line.variantName}</div>}
                          </TableCell>
                          <TableCell className="text-center text-xs">{line.quantity}</TableCell>
                          <TableCell className="text-right text-xs">{money.format(line.unitPrice)}</TableCell>
                          <TableCell className="text-right font-semibold text-xs">{money.format(line.lineTotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Footer Split: Dynamic UPI Payment QR Code & Totals */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-4 border-t">
                  <div className="flex flex-col items-center justify-center p-3 border rounded-lg bg-muted/20 w-fit self-center sm:self-auto">
                    <QRCodeSVG
                      value={`upi://pay?pa=${storeUpiId}&pn=${encodeURIComponent(storeName)}&am=${postedInvoice.totalAmount}&cu=INR`}
                      size={72}
                      level="L"
                    />
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      Dynamic UPI Payment QR
                    </span>
                  </div>

                  <div className="w-full sm:w-auto sm:min-w-[280px] space-y-1.5 text-xs text-right">
                    {postedInvoice.subtotal > 0 && (
                      <div className="flex justify-between gap-2 text-muted-foreground">
                        <span>Subtotal (Excl. Tax)</span>
                        <span className="font-mono">{money.format(postedInvoice.subtotal)}</span>
                      </div>
                    )}
                    {postedInvoice.taxAmount > 0 && (
                      <div className="flex justify-between gap-2 text-muted-foreground">
                        <span>GST / Tax Amount</span>
                        <span className="font-mono">+{money.format(postedInvoice.taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 font-semibold border-t pt-1">
                      <span>Invoice Total</span>
                      <span className="font-mono">{money.format(postedInvoice.totalAmount)}</span>
                    </div>

                    {postedInvoice.previousBalance && postedInvoice.previousBalance > 0 ? (
                      <div className="flex justify-between gap-2 text-amber-600 font-medium">
                        <span>Previous Customer Dues</span>
                        <span className="font-mono">+{money.format(postedInvoice.previousBalance)}</span>
                      </div>
                    ) : null}

                    {postedInvoice.creditAppliedAmount > 0 && (
                      <div className="flex justify-between gap-2 text-emerald-600">
                        <span>Store Credit Applied</span>
                        <span className="font-mono">-{money.format(postedInvoice.creditAppliedAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between gap-2 border-t pt-2 mt-1">
                      <span className="font-bold text-sm">
                        Total Paid {postedInvoice.paymentMethod ? `(${postedInvoice.paymentMethod})` : ""}
                      </span>
                      <span className="text-base sm:text-lg font-bold text-primary font-mono">
                        {money.format((postedInvoice.paidAmount || 0) + (postedInvoice.creditAppliedAmount || 0))}
                      </span>
                    </div>

                    {postedInvoice.tenderedCash && postedInvoice.tenderedCash > 0 ? (
                      <div className="flex justify-between gap-2 text-muted-foreground text-[11px]">
                        <span>Tendered Cash</span>
                        <span className="font-mono">{money.format(postedInvoice.tenderedCash)}</span>
                      </div>
                    ) : null}

                    {postedInvoice.changeDue && postedInvoice.changeDue > 0 ? (
                      <div className="flex justify-between gap-2 text-emerald-600 text-[11px] font-semibold">
                        <span>Change Returned</span>
                        <span className="font-mono">{money.format(postedInvoice.changeDue)}</span>
                      </div>
                    ) : null}

                    {((postedInvoice.paidAmount || 0) + (postedInvoice.creditAppliedAmount || 0)) < postedInvoice.totalAmount && (
                      <div className="flex justify-between gap-2 text-amber-600 font-semibold border-t pt-1 mt-1">
                        <span>Balance Due</span>
                        <span className="font-mono">
                          {money.format(
                            Math.max(0, postedInvoice.totalAmount - (postedInvoice.paidAmount || 0) - (postedInvoice.creditAppliedAmount || 0))
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Bar: Signatory Block */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 pt-4 border-t text-[11px] text-muted-foreground">
                  <div>This is an electronically verified tax invoice receipt.</div>
                  <div className="text-left sm:text-right space-y-0.5">
                    <div className="font-bold text-foreground">{postedInvoice.locationName}</div>
                    <div className="text-[10px]">Authorised Signatory</div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Mobile & Desktop Camera Barcode Scanner Modal */}
      <CameraScannerDialog
        open={isCameraScannerOpen}
        onOpenChange={setIsCameraScannerOpen}
        onScan={(scannedCode) => {
          processBarcodeScan(scannedCode);
        }}
      />
    </div>
  );
}

// One card per PRODUCT (not per SKU) — variants are picked via chips at the
// bottom of the card, Flipkart-style, instead of the catalog showing a
// separate near-identical card for every size/color combination.
function ProductGroupCard({
  group,
  money,
  getEffectivePrice,
  selectedPriceListId,
  onAdd,
}: {
  group: ProductGroup;
  money: Intl.NumberFormat;
  getEffectivePrice: (item: SellableItem, priceListId?: number | null) => number;
  selectedPriceListId: number | null;
  onAdd: (item: SellableItem, quantityToAdd?: number) => boolean | void;
}) {
  const variantKey = (v: SellableItem) => `${v.productId}:${v.variantId ?? "base"}`;
  const hasVariants = group.variants.length > 1;

  // Default to the first in-stock variant so the card doesn't lead with an
  // out-of-stock option; fall back to the first variant if all are out.
  const defaultVariant =
    group.variants.find((v) => v.stockQty === undefined || v.stockQty > 0) ?? group.variants[0];
  const [selectedKey, setSelectedKey] = React.useState(variantKey(defaultVariant));
  const selected = group.variants.find((v) => variantKey(v) === selectedKey) ?? defaultVariant;
  const outOfStock = selected.stockQty !== undefined && selected.stockQty <= 0;

  const productSetsQuery = useQuery({
    queryKey: ["product-sets", "product", group.productId],
    queryFn: () => apiClient.get<any[]>(`product-sets?productId=${group.productId}`),
  });
  const customSets = productSetsQuery.data ?? [];

  const [activeSetModal, setActiveSetModal] = React.useState<{ setObj?: any; isBulk?: boolean } | null>(null);
  const [modalQty, setModalQty] = React.useState("1");

  const confirmSetOrBulkAdd = () => {
    const count = Number(modalQty);
    if (isNaN(count) || count <= 0) return;

    if (activeSetModal?.isBulk) {
      const success = onAdd(selected, count);
      if (success !== false) {
        toast.success(`Added ${count} units of '${selected.variantName || selected.sku}' to cart`);
      }
    } else if (activeSetModal?.setObj) {
      // Validate inventory stock for all items in the set prior to adding
      for (const item of activeSetModal.setObj.items ?? []) {
        const match = group.variants.find((v) => v.variantId === item.productVariantId) ?? selected;
        if (match && match.stockQty !== undefined) {
          const reqQty = item.quantity * count;
          if (reqQty > match.stockQty) {
            toast.error(
              `Cannot add Set '${activeSetModal.setObj.name}': Insufficient inventory stock for '${match.variantName || match.sku}'. Required: ${reqQty}, Available: ${match.stockQty}.`
            );
            return;
          }
        }
      }

      let addedCount = 0;
      for (const item of activeSetModal.setObj.items ?? []) {
        const match = group.variants.find((v) => v.variantId === item.productVariantId) ?? selected;
        if (match) {
          onAdd(match, item.quantity * count);
          addedCount++;
        }
      }
      if (addedCount > 0) {
        toast.success(`Added ${count} Set(s) of '${activeSetModal.setObj.name}' to cart`);
      }
    }
    setActiveSetModal(null);
  };

  return (
    <Card
      className={`group overflow-hidden flex flex-col justify-between transition-all duration-200 ${
        outOfStock ? "opacity-60" : "hover:shadow-md hover:border-primary"
      }`}
    >
      <div className="h-24 sm:h-28 bg-muted/40 relative flex items-center justify-center p-2">
        {group.imageUrl ? (
          <img
            src={group.imageUrl}
            alt={group.name}
            className="h-full w-full object-contain group-hover:scale-105 transition-transform"
          />
        ) : (
          <Package className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/30" />
        )}
        <Badge variant="secondary" className="absolute top-1 right-1 text-[9px] font-mono opacity-80 max-w-[70px] sm:max-w-[100px] truncate">
          {selected.sku}
        </Badge>
        {outOfStock && (
          <Badge variant="destructive" className="absolute top-1 left-1 text-[9px]">
            Out of stock
          </Badge>
        )}
      </div>
      <CardContent className="p-2 sm:p-2.5 space-y-1 sm:space-y-1.5 flex-1 flex flex-col justify-between">
        <div className="font-semibold text-xs line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {group.name}
        </div>

        {hasVariants && (
          <div
            className="flex flex-wrap gap-1 pt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {group.variants.map((v) => {
              const key = variantKey(v);
              const isSelected = key === selectedKey;
              const variantOut = v.stockQty !== undefined && v.stockQty <= 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary"
                  } ${variantOut ? "line-through opacity-50" : ""}`}
                >
                  {v.variantName || v.sku}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs font-bold text-foreground">
            {money.format(getEffectivePrice(selected, selectedPriceListId))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={outOfStock}
                  className="h-7 w-7 rounded-full border hover:bg-primary hover:text-primary-foreground"
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => !outOfStock && onAdd(selected, 1)}>
                <Plus className="mr-2 h-3.5 w-3.5" /> Add 1 Unit ({selected.variantName || selected.sku})
              </DropdownMenuItem>

              {customSets.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1">
                    Configured Custom Sets
                  </div>
                  {customSets.map((sObj: any) => {
                    const totalPcs = (sObj.items ?? []).reduce((sum: number, i: any) => sum + i.quantity, 0);
                    return (
                      <DropdownMenuItem
                        key={sObj.id}
                        onClick={() => {
                          setModalQty("1");
                          setActiveSetModal({ setObj: sObj });
                        }}
                      >
                        <Layers className="mr-2 h-3.5 w-3.5 text-primary" />
                        Add Set: {sObj.name} ({totalPcs} pcs)
                      </DropdownMenuItem>
                    );
                  })}
                </>
              )}

              <DropdownMenuItem
                className="border-t mt-1"
                onClick={() => {
                  if (outOfStock) return;
                  setModalQty("10");
                  setActiveSetModal({ isBulk: true });
                }}
              >
                Custom Bulk Qty...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Dialog open={!!activeSetModal} onOpenChange={(open) => !open && setActiveSetModal(null)}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {activeSetModal?.isBulk
                  ? `Add Bulk Qty (${selected.variantName || selected.sku})`
                  : `Add Custom Set (${activeSetModal?.setObj?.name})`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {activeSetModal?.isBulk
                  ? `Enter how many units to add to cart:`
                  : `Enter how many Sets of '${activeSetModal?.setObj?.name}' to add to cart:`}
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => setModalQty(String(Math.max(1, (Number(modalQty) || 1) - 1)))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min="1"
                value={modalQty}
                onChange={(e) => setModalQty(e.target.value)}
                className="w-24 text-center font-bold text-base h-10"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => setModalQty(String((Number(modalQty) || 0) + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setActiveSetModal(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmSetOrBulkAdd}>
                Add to Cart
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div
          className={`text-[10px] font-medium ${
            outOfStock ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {outOfStock
            ? "Out of stock"
            : selected.stockQty !== undefined
            ? `${selected.stockQty} in stock`
            : "In stock"}
        </div>
      </CardContent>
    </Card>
  );
}
