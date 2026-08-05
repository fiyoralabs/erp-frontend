"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Undo2,
  Package,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiClient, PagedResult } from "@/lib/api-client";
import type { PurchaseInvoice, PurchaseReturn } from "@/lib/types/purchase";

interface ReturnLineState {
  productId: number;
  productVariantId: number | null;
  productName: string;
  variantName?: string | null;
  sku?: string | null;
  invoicedQty: number;
  previouslyReturnedQty: number;
  maxReturnableQty: number;
  returnQty: number;
  returnPrice: number;
  taxPercentage: number;
}

export function CreateReturnClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");
  const queryClient = useQueryClient();

  const [returnDate, setReturnDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = React.useState("");
  const [lines, setLines] = React.useState<ReturnLineState[]>([]);

  // 1. Fetch Invoices
  const invoicesQuery = useQuery({
    queryKey: ["purchases", "invoices"],
    queryFn: async () => {
      const res = await apiClient.get<PurchaseInvoice[]>("purchases/invoices");
      return res || [];
    },
  });

  // 2. Fetch Returns to compute previously returned quantities
  const returnsQuery = useQuery({
    queryKey: ["purchases", "returns"],
    queryFn: async () => {
      const res = await apiClient.get<PurchaseReturn[]>("purchases/returns");
      return res || [];
    },
  });

  const invoice = React.useMemo(() => {
    if (!invoicesQuery.data || !invoiceId) return null;
    return invoicesQuery.data.find((i) => String(i.id) === String(invoiceId)) || null;
  }, [invoicesQuery.data, invoiceId]);

  // Compute previously returned quantity per product key (productId:variantId)
  const previousReturnedMap = React.useMemo(() => {
    const map = new Map<string, number>();
    if (!returnsQuery.data || !invoice) return map;

    const relatedReturns = returnsQuery.data.filter((r) => String(r.purchaseInvoiceId) === String(invoice.id));
    for (const ret of relatedReturns) {
      if (!ret.lines) continue;
      for (const line of ret.lines) {
        const key = `${line.productId}:${line.productVariantId ?? "base"}`;
        const current = map.get(key) || 0;
        map.set(key, current + (line.quantity || 0));
      }
    }
    return map;
  }, [returnsQuery.data, invoice]);

  // Initialize return line states when invoice and returns are loaded
  React.useEffect(() => {
    if (invoice && invoice.lines) {
      const initialLines: ReturnLineState[] = invoice.lines.map((item) => {
        const key = `${item.productId}:${item.productVariantId ?? "base"}`;
        const prevReturned = previousReturnedMap.get(key) || 0;
        const invoicedQty = item.quantity || 0;
        const maxReturnableQty = Math.max(0, invoicedQty - prevReturned);

        return {
          productId: item.productId,
          productVariantId: item.productVariantId,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          invoicedQty,
          previouslyReturnedQty: prevReturned,
          maxReturnableQty,
          returnQty: 0,
          returnPrice: item.purchasePrice || 0,
          taxPercentage: item.taxPercentage || 0,
        };
      });
      setLines(initialLines);
    }
  }, [invoice, previousReturnedMap]);

  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

  const handleReturnQtyChange = (index: number, val: number) => {
    setLines((prev) => {
      const next = [...prev];
      const max = next[index].maxReturnableQty;
      const validQty = Math.max(0, Math.min(val, max));
      if (val > max) {
        toast.warning(`Cannot return more than remaining returnable quantity (${max})`);
      }
      next[index] = { ...next[index], returnQty: validQty };
      return next;
    });
  };

  const handleReturnPriceExclTaxChange = (index: number, priceExclTax: number) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], returnPrice: Math.max(0, priceExclTax) };
      return next;
    });
  };

  const handleReturnPriceIncTaxChange = (index: number, priceIncTax: number) => {
    setLines((prev) => {
      const next = [...prev];
      const taxPct = next[index].taxPercentage || 0;
      const priceExclTax = taxPct > 0 ? priceIncTax / (1 + taxPct / 100) : priceIncTax;
      next[index] = { ...next[index], returnPrice: Math.max(0, Number(priceExclTax.toFixed(4))) };
      return next;
    });
  };

  const handleTaxPercentageChange = (index: number, taxPct: number) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], taxPercentage: Math.max(0, taxPct) };
      return next;
    });
  };

  // Compute Total Credit Amount & Tax Breakdown
  const totals = React.useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    for (const line of lines) {
      const base = line.returnQty * line.returnPrice;
      const tax = (base * line.taxPercentage) / 100;
      subtotal += base;
      taxTotal += tax;
    }
    return { subtotal, taxTotal, totalCredit: subtotal + taxTotal };
  }, [lines]);

  const activeReturnLinesCount = lines.filter((l) => l.returnQty > 0).length;

  // Submit Mutation
  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error("Purchase invoice not found");
      const activeLines = lines.filter((l) => l.returnQty > 0);
      if (activeLines.length === 0) {
        throw new Error("Please specify return quantity for at least one item");
      }

      const payload = {
        purchaseInvoiceId: invoice.id,
        returnDate,
        reason: reason.trim() || undefined,
        lines: activeLines.map((l) => ({
          productId: l.productId,
          productVariantId: l.productVariantId,
          quantity: l.returnQty,
          returnPrice: l.returnPrice,
          reason: reason.trim() || undefined,
        })),
      };

      return apiClient.post("purchases/returns", payload);
    },
    onSuccess: () => {
      toast.success("Purchase return posted successfully!");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchases", "returns"] });
      router.push("/purchases?tab=returns");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to post purchase return");
    },
  });

  if (invoicesQuery.isLoading || returnsQuery.isLoading) {
    return <div className="p-8 text-center text-sm font-medium">Loading invoice return details...</div>;
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-semibold">Purchase Invoice Not Found</h2>
        <p className="text-sm text-muted-foreground">Select a valid invoice from the Purchases workspace to initiate a return.</p>
        <Button variant="outline" onClick={() => router.push("/purchases?tab=invoices")}>
          Back to Purchases
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-amber-600" /> Return Stock to Supplier
            </h1>
            <p className="text-xs text-muted-foreground">
              Return stock items against Supplier Invoice <span className="font-semibold text-foreground">{invoice.invoiceNumber}</span>
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-semibold px-3 py-1">
          {invoice.supplierName}
        </Badge>
      </div>

      {/* Invoice Reference Info */}
      <Card className="bg-muted/20">
        <CardContent className="p-4 grid gap-4 sm:grid-cols-3 text-xs">
          <div>
            <span className="text-muted-foreground block">Supplier:</span>
            <strong className="text-sm text-foreground">{invoice.supplierName}</strong>
          </div>
          <div>
            <span className="text-muted-foreground block">GRN Reference:</span>
            <strong className="text-sm text-foreground">{invoice.grnNumber || `Invoice #${invoice.id}`}</strong>
          </div>
          <div>
            <span className="text-muted-foreground block">Store Location:</span>
            <strong className="text-sm text-foreground">{invoice.locationName || "Main Store"}</strong>
          </div>
        </CardContent>
      </Card>

      {/* Return Execution Form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Select Items & Quantities to Return</span>
            <Badge variant="secondary" className="text-xs font-normal">
              Bi-Directional Tax & Price Calculator
            </Badge>
          </CardTitle>
          <CardDescription>
            You can edit either <strong>Base Price (Excl. Tax)</strong> or <strong>Unit Credit (Inc. Tax)</strong>. Changing one automatically calculates the other!
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Item & Variant</TableHead>
                  <TableHead className="text-center w-[75px]">Invoiced</TableHead>
                  <TableHead className="text-center w-[85px]">Prev. Ret.</TableHead>
                  <TableHead className="text-center w-[85px]">Remaining</TableHead>
                  <TableHead className="w-[90px] text-right">Return Qty *</TableHead>
                  <TableHead className="w-[125px] text-right">Base Price (Excl. Tax ₹)</TableHead>
                  <TableHead className="w-[85px] text-right">Tax (%)</TableHead>
                  <TableHead className="w-[135px] text-right">Unit Credit (Inc. Tax ₹)</TableHead>
                  <TableHead className="w-[140px] text-right">Line Credit Total (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => {
                  const base = line.returnQty * line.returnPrice;
                  const taxAmt = (base * line.taxPercentage) / 100;
                  const lineCredit = base + taxAmt;
                  const unitCreditIncTax = line.returnPrice * (1 + line.taxPercentage / 100);
                  const isFullyReturned = line.maxReturnableQty === 0;

                  return (
                    <TableRow key={idx} className={isFullyReturned ? "bg-muted/30 opacity-70" : undefined}>
                      <TableCell className="font-medium text-xs">
                        <div>{line.productName}</div>
                        {line.variantName && <div className="text-[11px] text-muted-foreground">{line.variantName}</div>}
                        {line.sku && <div className="text-[11px] text-muted-foreground font-mono">{line.sku}</div>}
                      </TableCell>
                      <TableCell className="text-center font-medium text-xs">{line.invoicedQty}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">{line.previouslyReturnedQty}</TableCell>
                      <TableCell className="text-center font-bold text-xs">
                        {isFullyReturned ? (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            Fully Returned
                          </Badge>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400">{line.maxReturnableQty}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          max={line.maxReturnableQty}
                          step="1"
                          disabled={isFullyReturned}
                          value={line.returnQty || ""}
                          onChange={(e) => handleReturnQtyChange(idx, Number(e.target.value))}
                          className="w-16 text-right ml-auto font-semibold"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={isFullyReturned}
                          value={line.returnPrice}
                          onChange={(e) => handleReturnPriceExclTaxChange(idx, Number(e.target.value))}
                          className="w-24 text-right ml-auto text-xs"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          disabled={isFullyReturned}
                          value={line.taxPercentage}
                          onChange={(e) => handleTaxPercentageChange(idx, Number(e.target.value))}
                          className="w-16 text-right ml-auto text-xs"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={isFullyReturned}
                          value={Number(unitCreditIncTax.toFixed(2))}
                          onChange={(e) => handleReturnPriceIncTaxChange(idx, Number(e.target.value))}
                          className="w-24 text-right ml-auto text-xs font-medium text-emerald-700 dark:text-emerald-300"
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                        <div>{money.format(lineCredit)}</div>
                        {line.returnQty > 0 && line.taxPercentage > 0 && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            (Base {money.format(base)} + Tax {money.format(taxAmt)})
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Return Date & Reason */}
          <div className="p-4 border-t grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="retDate">Return Posting Date *</Label>
              <Input id="retDate" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retReason">Reason for Return (Defect / Wrong Spec / Supplier Damage)</Label>
              <Textarea
                id="retReason"
                placeholder="Specify defect or reason for returning stock..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Return Summary Footer */}
          <div className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row items-end justify-between gap-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Selected Items to Return: <span className="font-semibold text-foreground">{activeReturnLinesCount} item(s)</span></div>
              <div>Supplier Account Balance: <span className="font-semibold text-foreground">{money.format(invoice.balanceAmount)}</span></div>
              <div className="text-[11px] text-amber-700 dark:text-amber-400">
                Note: Posting this return will deduct returned stock from warehouse inventory and credit your supplier ledger.
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs text-muted-foreground">
                Base Return Value: <span className="font-semibold text-foreground">{money.format(totals.subtotal)}</span>
              </div>
              {totals.taxTotal > 0 && (
                <div className="text-xs text-muted-foreground">
                  Refunded Tax (GST): <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{money.format(totals.taxTotal)}</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-1">Total Return Credit Value</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{money.format(totals.totalCredit)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => router.push("/purchases?tab=invoices")}>
          Cancel
        </Button>
        <Button
          onClick={() => createReturnMutation.mutate()}
          disabled={createReturnMutation.isPending || activeReturnLinesCount === 0}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
        >
          {createReturnMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Confirm & Post Return
        </Button>
      </div>
    </div>
  );
}
