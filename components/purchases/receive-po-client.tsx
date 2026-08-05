"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, PackageCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import { localDateInputValue } from "@/lib/date";
import type { PurchaseOrder } from "@/lib/types/purchase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ReceiveLineState = {
  productId: number;
  productVariantId: number | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  purchasePrice: number;
  batchNumber: string;
  rejectionReason: string;
};

const today = localDateInputValue;
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const err = (e: unknown) => (e instanceof ApiRequestError || e instanceof Error ? e.message : "Something went wrong");

export function ReceivePOClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poIdStr = searchParams.get("poId");
  const poId = poIdStr ? Number(poIdStr) : null;

  const qc = useQueryClient();

  const [receiptDate, setReceiptDate] = React.useState<string>(today());
  const [remarks, setRemarks] = React.useState<string>("");
  const [lines, setLines] = React.useState<ReceiveLineState[]>([]);
  const [confirmModalOpen, setConfirmModalOpen] = React.useState<boolean>(false);

  // Fetch PO detail
  const poQuery = useQuery({
    queryKey: ["purchase", "orders", poId, "detail"],
    enabled: !!poId,
    queryFn: () => apiClient.get<PurchaseOrder>(`purchases/orders/${poId}/detail`),
  });

  const po = poQuery.data;

  // Pre-fill receiving lines when PO is loaded
  React.useEffect(() => {
    if (po && po.lines) {
      const initialLines: ReceiveLineState[] = po.lines.map((line) => {
        const prevReceived = line.receivedQuantity || 0;
        const ordered = line.orderedQuantity || 0;
        const remaining = Math.max(0, ordered - prevReceived);
        return {
          productId: line.productId,
          productVariantId: line.productVariantId,
          productName: line.productName,
          variantName: line.variantName,
          sku: line.sku,
          orderedQuantity: ordered,
          previouslyReceivedQuantity: prevReceived,
          acceptedQuantity: remaining > 0 ? remaining : 0,
          rejectedQuantity: 0,
          purchasePrice: line.unitPrice || 0,
          batchNumber: "",
          rejectionReason: "",
        };
      });
      setLines(initialLines);
    }
  }, [po]);

  // Submit Mutation
  const createReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!po) throw new Error("Purchase order not loaded");
      const payloadLines = lines
        .filter((l) => (l.acceptedQuantity + l.rejectedQuantity) > 0)
        .map((l) => ({
          productId: l.productId,
          productVariantId: l.productVariantId,
          receivedQuantity: l.acceptedQuantity + l.rejectedQuantity,
          acceptedQuantity: l.acceptedQuantity,
          rejectedQuantity: l.rejectedQuantity,
          purchasePrice: l.purchasePrice,
          batchNumber: l.batchNumber || null,
          rejectionReason: l.rejectionReason || null,
        }));

      if (payloadLines.length === 0) {
        throw new Error("Please enter a received or accepted quantity greater than zero for at least one item");
      }

      return apiClient.post("purchases/goods-receipts", {
        purchaseOrderId: po.id,
        locationId: po.locationId,
        receiptDate,
        remarks: remarks || null,
        lines: payloadLines,
      });
    },
    onSuccess: async () => {
      toast.success(`Goods received successfully for ${po?.poNumber}! Inventory updated.`);
      await qc.invalidateQueries({ queryKey: ["purchase"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      router.push("/purchases");
    },
    onError: (e) => toast.error(err(e)),
  });

  // Calculate under / over receiving warnings
  const receivingVariances = React.useMemo(() => {
    const under: { name: string; accepted: number; remaining: number }[] = [];
    const over: { name: string; accepted: number; remaining: number }[] = [];

    for (const l of lines) {
      if (l.acceptedQuantity + l.rejectedQuantity > 0) {
        const remaining = Math.max(0, l.orderedQuantity - l.previouslyReceivedQuantity);
        const displayName = l.variantName ? `${l.productName} (${l.variantName})` : l.productName;
        if (l.acceptedQuantity < remaining) {
          under.push({ name: displayName, accepted: l.acceptedQuantity, remaining });
        } else if (l.acceptedQuantity > remaining) {
          over.push({ name: displayName, accepted: l.acceptedQuantity, remaining });
        }
      }
    }
    return { under, over, hasVariance: under.length > 0 || over.length > 0 };
  }, [lines]);

  const handleFormSubmit = () => {
    if (lines.every((l) => l.acceptedQuantity <= 0 && l.rejectedQuantity <= 0)) {
      toast.error("Please enter a valid accepted or rejected quantity for at least one item");
      return;
    }

    if (receivingVariances.hasVariance) {
      setConfirmModalOpen(true);
    } else {
      createReceiptMutation.mutate();
    }
  };

  const handleLineChange = (index: number, field: keyof ReceiveLineState, value: string | number) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const totalAcceptedValue = lines.reduce((acc, l) => acc + l.acceptedQuantity * l.purchasePrice, 0);
  const totalRejectedQty = lines.reduce((acc, l) => acc + l.rejectedQuantity, 0);
  const totalAcceptedQty = lines.reduce((acc, l) => acc + l.acceptedQuantity, 0);

  if (poQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading Purchase Order details...</span>
      </div>
    );
  }

  if (poQuery.isError || !po) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <div>
          <h2 className="text-lg font-semibold">Purchase Order Not Found</h2>
          <p className="text-sm text-muted-foreground">The requested purchase order could not be loaded.</p>
        </div>
        <Link href="/purchases">
          <Button variant="outline">Back to Purchases</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Back & Header */}
      <div className="flex flex-col gap-2">
        <Link href="/purchases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Purchases
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Receive Goods — {po.poNumber}</h1>
              <Badge variant="outline">{po.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Inspect shipment, verify accepted vs rejected quantities, update purchase prices, and post directly to inventory.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/purchases")}>
              Cancel
            </Button>
            <Button onClick={handleFormSubmit} disabled={createReceiptMutation.isPending} className="gap-2">
              {createReceiptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Confirm & Post Stock Receipt
            </Button>
          </div>
        </div>
      </div>

      {/* Pre-filled Order Info Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" /> Purchase Order & Vendor Details
          </CardTitle>
          <CardDescription>Pre-filled parameters from Purchase Order #{po.poNumber}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs text-muted-foreground">Supplier / Vendor</Label>
              <div className="font-semibold text-sm mt-1">{po.supplierName}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Receiving Store Location</Label>
              <div className="font-semibold text-sm mt-1">{po.locationName}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Order Date & Expected Date</Label>
              <div className="font-medium text-sm mt-1">
                {po.orderDate} {po.expectedDate ? `(Expected: ${po.expectedDate})` : ""}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receiptDate">Receiving / Dock Date *</Label>
              <Input id="receiptDate" type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
          </div>
          {po.remarks && (
            <div className="mt-3 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md border">
              <span className="font-semibold">PO Remarks:</span> {po.remarks}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receiving Items Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Inspect Line Items & Set Quantities</CardTitle>
          <CardDescription>Enter physical accepted and rejected quantities. Modify Unit Purchase Price if bought at a discounted or updated rate.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[260px]">Item & Variant</TableHead>
                  <TableHead className="w-[90px]">Ordered</TableHead>
                  <TableHead className="w-[90px]">Prev. Recd</TableHead>
                  <TableHead className="w-[120px]">Remaining</TableHead>
                  <TableHead className="w-[120px] text-right">Accepted Qty *</TableHead>
                  <TableHead className="w-[110px] text-right">Rejected Qty</TableHead>
                  <TableHead className="w-[150px] text-right">Unit Price (₹)</TableHead>
                  <TableHead className="w-[130px]">Batch / Lot #</TableHead>
                  <TableHead className="w-[140px] text-right">Received Total (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => {
                  const lineTotal = line.acceptedQuantity * line.purchasePrice;
                  const remaining = Math.max(0, line.orderedQuantity - line.previouslyReceivedQuantity);

                  return (
                    <React.Fragment key={idx}>
                      <TableRow>
                        <TableCell className="font-medium">
                          <div>{line.productName}</div>
                          {line.variantName && <div className="text-xs text-muted-foreground">{line.variantName}</div>}
                          {line.sku && <div className="text-[11px] text-muted-foreground font-mono">{line.sku}</div>}
                        </TableCell>
                        <TableCell className="font-semibold">{line.orderedQuantity}</TableCell>
                        <TableCell className="text-muted-foreground font-medium">{line.previouslyReceivedQuantity}</TableCell>
                        <TableCell>
                          {line.acceptedQuantity > remaining ? (
                            <Badge variant="outline" className="font-semibold text-xs text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 whitespace-nowrap">
                              +{line.acceptedQuantity - remaining} Extra Overage
                            </Badge>
                          ) : remaining <= 0 ? (
                            <Badge variant="secondary" className="text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 text-[11px] whitespace-nowrap">
                              ✓ Fully Received
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-semibold text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 whitespace-nowrap">
                              {remaining} Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={line.acceptedQuantity}
                            onChange={(e) => handleLineChange(idx, "acceptedQuantity", Math.max(0, Number(e.target.value)))}
                            className="w-24 text-right ml-auto font-medium"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={line.rejectedQuantity}
                            onChange={(e) => handleLineChange(idx, "rejectedQuantity", Math.max(0, Number(e.target.value)))}
                            className="w-20 text-right ml-auto text-destructive"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.purchasePrice}
                            onChange={(e) => handleLineChange(idx, "purchasePrice", Math.max(0, Number(e.target.value)))}
                            className="w-28 text-right ml-auto font-medium"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Optional Batch"
                            value={line.batchNumber}
                            onChange={(e) => handleLineChange(idx, "batchNumber", e.target.value)}
                            className="w-32 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold">{money.format(lineTotal)}</TableCell>
                      </TableRow>
                      {/* Optional Rejection Reason input row if rejected > 0 */}
                      {line.rejectedQuantity > 0 && (
                        <TableRow className="bg-destructive/5 border-b">
                          <TableCell colSpan={2} className="text-xs text-destructive font-medium pl-6">
                            Rejection Reason for {line.rejectedQuantity} item(s):
                          </TableCell>
                          <TableCell colSpan={7}>
                            <Input
                              placeholder="e.g. Damaged packaging, torn fabric, expired lot..."
                              value={line.rejectionReason}
                              onChange={(e) => handleLineChange(idx, "rejectionReason", e.target.value)}
                              className="text-xs h-8"
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Footer Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Confirming this receipt will add <strong className="text-foreground">{totalAcceptedQty} accepted units</strong> to <strong className="text-foreground">{po.locationName}</strong> inventory.
        </div>

        <Card className="w-full sm:w-80">
          <CardContent className="pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Total Accepted Items:</span>
              <span className="font-semibold text-foreground">{totalAcceptedQty} units</span>
            </div>
            {totalRejectedQty > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Total Rejected Items:</span>
                <span className="font-semibold">{totalRejectedQty} units</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-semibold text-base">
              <span>Total Receipt Value:</span>
              <span className="text-primary">{money.format(totalAcceptedValue)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Under / Over Receiving Smart Confirmation Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" /> Confirm Receipt Quantity Differences
            </DialogTitle>
            <DialogDescription>
              The quantities you are receiving differ from the original Purchase Order. Please review before updating inventory:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            {receivingVariances.under.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-md border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                <div className="font-semibold text-xs uppercase tracking-wider mb-1">Partial / Under-Receiving:</div>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  {receivingVariances.under.map((u, i) => (
                    <li key={i}>
                      <strong>{u.name}</strong>: Receiving <strong>{u.accepted}</strong> out of <strong>{u.remaining}</strong> remaining units. The remaining <strong>{u.remaining - u.accepted}</strong> units will stay open for future delivery.
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {receivingVariances.over.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-md border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200">
                <div className="font-semibold text-xs uppercase tracking-wider mb-1">Excess / Over-Receiving:</div>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  {receivingVariances.over.map((o, i) => (
                    <li key={i}>
                      <strong>{o.name}</strong>: Receiving <strong>{o.accepted}</strong> units, which exceeds the <strong>{o.remaining}</strong> expected units (+{o.accepted - o.remaining} extra into inventory).
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              Go Back & Fix Quantities
            </Button>
            <Button
              onClick={() => {
                setConfirmModalOpen(false);
                createReceiptMutation.mutate();
              }}
              disabled={createReceiptMutation.isPending}
            >
              {createReceiptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm & Post Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
