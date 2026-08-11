"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  Building2,
  Calendar,
  AlertTriangle,
  Upload,
  CheckCircle2,
  HelpCircle,
  Receipt,
  FileUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { useTaxesLookup } from "@/lib/hooks/use-master-data";

interface InvoiceLineState {
  productId: number;
  productVariantId: number | null;
  productName: string;
  variantName?: string | null;
  sku?: string | null;
  quantity: number;
  purchasePrice: number;
  taxId: number;
  taxPercentage: number;
}

export function CreateInvoiceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const grnId = searchParams.get("grnId");
  const queryClient = useQueryClient();

  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [invoiceDate, setInvoiceDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = React.useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [attachmentUrl, setAttachmentUrl] = React.useState("");
  const [paymentProofUrl, setPaymentProofUrl] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [isUploadingProof, setIsUploadingProof] = React.useState(false);
  const [freightAmount, setFreightAmount] = React.useState(0);
  const [laborCost, setLaborCost] = React.useState(0);
  const [discountAmount, setDiscountAmount] = React.useState(0);
  const [lines, setLines] = React.useState<InvoiceLineState[]>([]);

  // Upload Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("folder", "invoices");
      const res = await apiClient.post<{ url: string }>("attachments/upload", data);
      setAttachmentUrl(res.url);
      toast.success(`Tax Invoice document attached: ${file.name}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to upload invoice attachment");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProof(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("folder", "payments");
      const res = await apiClient.post<{ url: string }>("attachments/upload", data);
      setPaymentProofUrl(res.url);
      toast.success(`Payment proof document attached: ${file.name}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to upload payment proof attachment");
    } finally {
      setIsUploadingProof(false);
    }
  };

  // Fetch Master Data (taxes)
  const taxesLookup = useTaxesLookup();
  const taxesQuery = { data: taxesLookup.data?.content };

  // Fetch Receipts for GRN details
  const workspaceQuery = useQuery({
    queryKey: ["purchases", "receipts"],
    queryFn: async () => {
      const res = await apiClient.get<Array<{
        id: number;
        grnNumber: string;
        purchaseOrderId: number;
        poNumber: string;
        supplierId: number;
        supplierName: string;
        locationId: number;
        locationName: string;
        receiptDate: string;
        lines: Array<{
          productId: number;
          productVariantId: number | null;
          productName: string;
          variantName?: string | null;
          sku?: string | null;
          acceptedQuantity: number;
          purchasePrice: number;
        }>;
      }>>("purchases/goods-receipts");
      return { receipts: res || [] };
    },
  });

  const grn = React.useMemo(() => {
    if (!workspaceQuery.data || !grnId) return null;
    return workspaceQuery.data.receipts.find((r) => String(r.id) === String(grnId)) || null;
  }, [workspaceQuery.data, grnId]);

  // Pre-fill lines when GRN is loaded
  React.useEffect(() => {
    if (grn && grn.lines && taxesQuery.data) {
      const defaultTax = taxesQuery.data[0] || { id: 1, taxPercentage: 0 };
      const initialLines: InvoiceLineState[] = grn.lines
        .filter((l) => l.acceptedQuantity > 0)
        .map((line) => ({
          productId: line.productId,
          productVariantId: line.productVariantId,
          productName: line.productName,
          variantName: line.variantName,
          sku: line.sku,
          quantity: line.acceptedQuantity,
          purchasePrice: line.purchasePrice || 0,
          taxId: defaultTax.id,
          taxPercentage: defaultTax.taxPercentage || 0,
        }));
      setLines(initialLines);
      if (!invoiceNumber) {
        setInvoiceNumber(`INV-${grn.grnNumber.replace("GOO-", "")}`);
      }
    }
  }, [grn, taxesQuery.data]);

  // Calculate totals
  const grnSubtotal = React.useMemo(() => {
    if (!grn) return 0;
    return grn.lines.reduce((sum, l) => sum + l.acceptedQuantity * l.purchasePrice, 0);
  }, [grn]);

  const invoiceSubtotal = React.useMemo(() => {
    return lines.reduce((sum, l) => sum + l.quantity * l.purchasePrice, 0);
  }, [lines]);

  const invoiceTaxTotal = React.useMemo(() => {
    return lines.reduce((sum, l) => {
      const base = l.quantity * l.purchasePrice;
      return sum + (base * l.taxPercentage) / 100;
    }, 0);
  }, [lines]);

  const invoiceGrandTotal = Math.max(0, invoiceSubtotal - discountAmount) + invoiceTaxTotal + freightAmount;
  const totalLandedCost = invoiceSubtotal - discountAmount + invoiceTaxTotal + freightAmount + laborCost;
  const priceVariance = invoiceSubtotal - grnSubtotal;
  const hasVariance = Math.abs(priceVariance) > 0.01;

  const handleLineChange = (index: number, field: keyof InvoiceLineState, value: number) => {
    setLines((prev) => {
      const next = [...prev];
      if (field === "taxId" && taxesQuery.data) {
        const selectedTax = taxesQuery.data.find((t) => t.id === value);
        next[index] = {
          ...next[index],
          taxId: value,
          taxPercentage: selectedTax ? selectedTax.taxPercentage : 0,
        };
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };



  // Submit Mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!grn) throw new Error("Goods receipt not found");
      if (!invoiceNumber.trim()) throw new Error("Supplier Tax Invoice Number is required");
      if (lines.length === 0) throw new Error("Invoice requires at least one accepted item line");

      const payload = {
        supplierId: grn.supplierId,
        goodsReceiptId: grn.id,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        dueDate,
        attachmentUrl: attachmentUrl || undefined,
        paymentProofUrl: paymentProofUrl || undefined,
        lines: lines.map((l) => ({
          productId: l.productId,
          productVariantId: l.productVariantId,
          quantity: l.quantity,
          purchasePrice: l.purchasePrice,
          taxId: l.taxId,
          taxPercentage: l.taxPercentage,
        })),
      };

      return apiClient.post("purchases/invoices", payload);
    },
    onSuccess: () => {
      toast.success("Purchase Tax Invoice posted successfully!");
      queryClient.invalidateQueries({ queryKey: ["purchases-workspace"] });
      router.push("/purchases?tab=invoices");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to post purchase invoice");
    },
  });

  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

  if (workspaceQuery.isLoading) {
    return <div className="p-8 text-center text-sm font-medium">Loading Goods Receipt details...</div>;
  }

  if (!grn) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-semibold">Goods Receipt Not Found</h2>
        <p className="text-sm text-muted-foreground">Select a valid Goods Receipt from the list to post an invoice.</p>
        <Button onClick={() => router.push("/purchases?tab=receipts")}>Return to Goods Receipts</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push("/purchases?tab=receipts")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Post Supplier Tax Invoice
            </h1>
            <p className="text-xs text-muted-foreground">
              Record supplier bill for Goods Receipt <span className="font-semibold text-foreground">{grn.grnNumber}</span> (PO #{grn.poNumber})
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-semibold px-3 py-1">
          {grn.supplierName}
        </Badge>
      </div>

      {/* Variance Alert Banner if Invoice differs from GRN */}
      {hasVariance && (
        <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <div className="font-semibold">GRN vs Invoice Value Variance Detected</div>
            <div>
              The entered invoice subtotal ({money.format(invoiceSubtotal)}) differs from the physical GRN value ({money.format(grnSubtotal)}) by{" "}
              <span className="font-bold">{priceVariance > 0 ? `+${money.format(priceVariance)}` : money.format(priceVariance)}</span>.
            </div>
          </div>
        </div>
      )}

      {/* Invoice Header Details Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Supplier & Invoice Metadata
          </CardTitle>
          <CardDescription>Enter the official Tax Invoice details provided on the vendor&apos;s bill.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs text-muted-foreground">Supplier / Vendor</Label>
              <div className="font-semibold text-sm mt-1">{grn.supplierName}</div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Store Location</Label>
              <div className="font-semibold text-sm mt-1">{grn.locationName}</div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invNum">Supplier Tax Invoice Number *</Label>
              <Input
                id="invNum"
                placeholder="e.g. INV-2026-889"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invDate">Invoice Date *</Label>
              <Input id="invDate" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4 pt-4 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Payment Due Date *</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            {/* S3 Invoice Attachment Dropzone */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <FileUp className="h-3.5 w-3.5 text-muted-foreground" /> Scanned Tax Invoice (PDF / Photo)
              </Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={isUploading} className="text-xs" />
                {attachmentUrl && (
                  <Badge variant="secondary" className="text-[11px] text-emerald-700 bg-emerald-50 border-emerald-200 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Invoice Attached
                  </Badge>
                )}
              </div>
            </div>

            {/* Payment Proof Attachment Dropzone */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <FileUp className="h-3.5 w-3.5 text-muted-foreground" /> Proof of Payment (UTR Receipt / Bank Advice)
              </Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*,application/pdf" onChange={handlePaymentProofUpload} disabled={isUploadingProof} className="text-xs" />
                {paymentProofUrl && (
                  <Badge variant="secondary" className="text-[11px] text-blue-700 bg-blue-50 border-blue-200 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-blue-600" /> Proof Attached
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Miscellaneous Costs & Landed Cost Adjustments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Additional Costs & Landed Charges</span>
            <Badge variant="secondary" className="text-[11px] font-normal">
              Professional ERP Accounting Rules
            </Badge>
          </CardTitle>
          <CardDescription>
            Specify supplier discounts, supplier-billed freight, and third-party internal landed costs (e.g. unloading labor).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="discAmt">Supplier Special Discount (₹)</Label>
              <Input
                id="discAmt"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discountAmount || ""}
                onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
              />
              <p className="text-[11px] text-muted-foreground">Reduces payable invoice total.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="freightAmt">Freight & Shipping (Seller Billed - ₹)</Label>
              <Input
                id="freightAmt"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={freightAmount || ""}
                onChange={(e) => setFreightAmount(Math.max(0, Number(e.target.value)))}
              />
              <p className="text-[11px] text-muted-foreground">Added to Supplier Invoice & Payable Balance.</p>
            </div>

            <div className="space-y-1.5 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded border border-blue-200/60 dark:border-blue-900/60">
              <Label htmlFor="laborAmt" className="text-blue-900 dark:text-blue-200">
                Internal / 3rd Party Labor & Unloading (₹)
              </Label>
              <Input
                id="laborAmt"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={laborCost || ""}
                onChange={(e) => setLaborCost(Math.max(0, Number(e.target.value)))}
                className="border-blue-300 dark:border-blue-800"
              />
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                ⭐ <strong>Landed Cost Rule:</strong> Tracked for stock valuation, but <u>not</u> added to seller payable balance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Line Items Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Billable Items & Tax Breakdown</span>
            <Badge variant="outline" className="font-normal text-xs">
              Pre-filled from GRN #{grn.grnNumber}
            </Badge>
          </CardTitle>
          <CardDescription>Adjust unit price or tax rates if the vendor invoice contains discounted rates or GST lines.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Item & Variant</TableHead>
                  <TableHead className="w-[100px] text-right">Accepted Qty</TableHead>
                  <TableHead className="w-[150px] text-right">Unit Price (₹)</TableHead>
                  <TableHead className="w-[160px]">Applied Tax</TableHead>
                  <TableHead className="w-[120px] text-right">Tax Amount (₹)</TableHead>
                  <TableHead className="w-[140px] text-right">Line Total (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => {
                  const base = line.quantity * line.purchasePrice;
                  const taxAmt = (base * line.taxPercentage) / 100;
                  const lineTotal = base + taxAmt;

                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        <div>{line.productName}</div>
                        {line.variantName && <div className="text-xs text-muted-foreground">{line.variantName}</div>}
                        {line.sku && <div className="text-[11px] text-muted-foreground font-mono">{line.sku}</div>}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{line.quantity}</TableCell>
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
                        <select
                          value={line.taxId}
                          onChange={(e) => handleLineChange(idx, "taxId", Number(e.target.value))}
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {(taxesQuery.data || []).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.taxPercentage}%)
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{money.format(taxAmt)}</TableCell>
                      <TableCell className="text-right font-semibold">{money.format(lineTotal)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Invoice Summary Footer */}
          <div className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Goods Subtotal: <span className="font-semibold text-foreground">{money.format(invoiceSubtotal)}</span></div>
              {discountAmount > 0 && <div>Special Discount: <span className="font-semibold text-emerald-600">-{money.format(discountAmount)}</span></div>}
              <div>Invoice Tax Amount: <span className="font-semibold text-foreground">{money.format(invoiceTaxTotal)}</span></div>
              {freightAmount > 0 && <div>Seller Freight / Shipping: <span className="font-semibold text-foreground">+{money.format(freightAmount)}</span></div>}
              {laborCost > 0 && <div className="text-blue-700 dark:text-blue-300">Internal Unloading/Labor (Landed Cost): <span className="font-semibold">{money.format(laborCost)}</span></div>}
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs text-muted-foreground">Total Payable to Supplier</div>
              <div className="text-2xl font-bold text-primary">{money.format(invoiceGrandTotal)}</div>
              {laborCost > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  Total Inventory Landed Cost: <strong className="text-foreground">{money.format(totalLandedCost)}</strong>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => router.push("/purchases?tab=receipts")}>
          Cancel
        </Button>
        <Button
          size="lg"
          onClick={() => createInvoiceMutation.mutate()}
          disabled={createInvoiceMutation.isPending || !invoiceNumber.trim()}
          className="gap-2 font-semibold"
        >
          <Receipt className="h-4 w-4" />
          {createInvoiceMutation.isPending ? "Posting Invoice..." : "Post Purchase Invoice"}
        </Button>
      </div>
    </div>
  );
}
