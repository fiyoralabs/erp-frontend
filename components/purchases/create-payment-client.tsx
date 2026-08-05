"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Receipt,
  FileCheck,
  Loader2,
  Package,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";

const PAYMENT_METHODS = [
  { code: "BANK_TRANSFER", name: "Bank Transfer / NEFT / RTGS" },
  { code: "UPI", name: "UPI / QR Payment" },
  { code: "CASH", name: "Cash Payment" },
  { code: "CHEQUE", name: "Cheque / Demand Draft" },
  { code: "CREDIT_CARD", name: "Company Credit Card" },
];

export function CreatePaymentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");
  const queryClient = useQueryClient();

  const [paymentMethodCode, setPaymentMethodCode] = React.useState("BANK_TRANSFER");
  const [paymentDate, setPaymentDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [attachmentUrl, setAttachmentUrl] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [amount, setAmount] = React.useState<string>("");

  // Fetch Invoices to locate invoice details
  const workspaceQuery = useQuery({
    queryKey: ["purchases", "invoices"],
    queryFn: async () => {
      const res = await apiClient.get<Array<{
        id: number;
        invoiceNumber: string;
        supplierId: number;
        supplierName: string;
        locationName?: string;
        grnNumber?: string;
        invoiceDate: string;
        dueDate: string;
        status: string;
        totalAmount: number;
        paidAmount: number;
        balanceAmount: number;
        lines?: Array<{
          productId: number;
          productVariantId: number | null;
          productName: string;
          variantName?: string | null;
          sku?: string | null;
          quantity: number;
          purchasePrice: number;
          taxPercentage?: number;
          taxAmount?: number;
          lineTotal?: number;
        }>;
      }>>("purchases/invoices");
      return { invoices: res || [] };
    },
  });

  const invoice = React.useMemo(() => {
    if (!workspaceQuery.data || !invoiceId) return null;
    return workspaceQuery.data.invoices.find((i) => String(i.id) === String(invoiceId)) || null;
  }, [workspaceQuery.data, invoiceId]);

  // Pre-fill amount with outstanding balance
  React.useEffect(() => {
    if (invoice && amount === "") {
      setAmount(String(invoice.balanceAmount));
    }
  }, [invoice, amount]);

  // Record Payment Mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error("Invoice not found");
      const payAmount = Number(amount);
      if (isNaN(payAmount) || payAmount <= 0) throw new Error("Please enter a valid payment amount greater than 0");
      if (payAmount > invoice.balanceAmount + 0.01) {
        throw new Error(`Payment amount cannot exceed outstanding balance (${money.format(invoice.balanceAmount)})`);
      }

      const payload = {
        purchaseInvoiceId: invoice.id,
        supplierId: invoice.supplierId,
        paymentMethodCode,
        amount: payAmount,
        paymentDate,
        referenceNumber: referenceNumber.trim() || undefined,
        attachmentUrl: attachmentUrl || undefined,
      };

      return apiClient.post(`purchases/invoices/${invoice.id}/payments`, payload);
    },
    onSuccess: () => {
      toast.success("Supplier payment recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["purchases-workspace"] });
      router.push("/purchases?tab=invoices");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to record payment");
    },
  });

  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
  const payAmountNum = Number(amount) || 0;
  const remainingBalanceAfterPay = Math.max(0, (invoice?.balanceAmount || 0) - payAmountNum);

  if (workspaceQuery.isLoading) {
    return <div className="p-8 text-center text-sm font-medium">Loading invoice payment details...</div>;
  }

  if (!invoice) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-semibold">Purchase Invoice Not Found</h2>
        <p className="text-sm text-muted-foreground">Select a valid unpaid invoice from the list to record a payment.</p>
        <Button onClick={() => router.push("/purchases?tab=invoices")}>Return to Invoices</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push("/purchases?tab=invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" /> Record Supplier Payment
            </h1>
            <p className="text-xs text-muted-foreground">
              Make payment towards Invoice <span className="font-semibold text-foreground">{invoice.invoiceNumber}</span>
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-semibold px-3 py-1">
          {invoice.supplierName}
        </Badge>
      </div>

      {/* Financial Summary Card */}
      <Card className="bg-gradient-to-br from-background to-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> Invoice Balance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-3 rounded-lg bg-background border">
              <div className="text-xs text-muted-foreground">Total Invoice Value</div>
              <div className="text-lg font-bold mt-1">{money.format(invoice.totalAmount)}</div>
            </div>
            <div className="p-3 rounded-lg bg-background border">
              <div className="text-xs text-muted-foreground">Previously Paid</div>
              <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mt-1">{money.format(invoice.paidAmount)}</div>
            </div>
            <div className="p-3 rounded-lg bg-background border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="text-xs text-amber-800 dark:text-amber-300 font-medium">Outstanding Balance Due</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{money.format(invoice.balanceAmount)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchased Line Items Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Purchased Items In Bill ({invoice.lines?.length || 0})
            </span>
            {invoice.grnNumber && (
              <Badge variant="outline" className="text-[11px] font-normal">
                Ref GRN #{invoice.grnNumber}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            Review items, quantities, and unit prices included in this supplier invoice before executing payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(!invoice.lines || invoice.lines.length === 0) ? (
            <div className="p-4 text-xs text-muted-foreground text-center">No line items detailed on this invoice.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Item & Variant</TableHead>
                    <TableHead className="w-[100px]">SKU</TableHead>
                    <TableHead className="text-right w-[90px]">Qty</TableHead>
                    <TableHead className="text-right w-[120px]">Unit Price (₹)</TableHead>
                    <TableHead className="text-right w-[130px]">Line Total (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.map((line, idx) => {
                    const lineTotal = line.lineTotal ?? (line.quantity * line.purchasePrice);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-xs">
                          <div>{line.productName}</div>
                          {line.variantName && <div className="text-[11px] text-muted-foreground">{line.variantName}</div>}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{line.sku || "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-xs">{line.quantity}</TableCell>
                        <TableCell className="text-right text-xs">{money.format(line.purchasePrice)}</TableCell>
                        <TableCell className="text-right font-semibold text-xs">{money.format(lineTotal)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Entry Form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Payment Execution Details
          </CardTitle>
          <CardDescription>Select payment method, date, transaction reference, and amount to transfer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payMethod">Payment Method *</Label>
              <select
                id="payMethod"
                value={paymentMethodCode}
                onChange={(e) => setPaymentMethodCode(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payDate">Payment Date *</Label>
              <Input id="payDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="refNum">Transaction Reference / UTR / Cheque #</Label>
              <Input
                id="refNum"
                placeholder="e.g. UTR998822019 or Cheque #000122"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payAmount">Payment Amount (₹) *</Label>
              <Input
                id="payAmount"
                type="number"
                min="0.01"
                step="0.01"
                max={invoice.balanceAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-bold text-lg text-primary"
              />
            </div>

            {/* Payment Proof Attachment */}
            <div className="sm:col-span-2 space-y-1.5 pt-2 border-t mt-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <FileCheck className="h-3.5 w-3.5 text-muted-foreground" /> Attach Scanned Payment Receipt / Proof of Payment (Bank Advice / Screenshot)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  disabled={isUploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setIsUploading(true);
                    try {
                      const data = new FormData();
                      data.append("file", f);
                      data.append("folder", "payments");
                      const res = await apiClient.post<{ url: string }>("attachments/upload", data);
                      setAttachmentUrl(res.url);
                      toast.success(`Payment proof attached: ${f.name}`);
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : "Upload failed");
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  className="text-xs"
                />
                {isUploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          </div>

          {/* Payment Impact Preview */}
          <div className="p-3.5 rounded-md bg-muted/40 border text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Paying Now:</span>
              <span className="font-semibold text-foreground">{money.format(payAmountNum)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Remaining Balance After Payment:</span>
              <span className="font-bold text-foreground">{money.format(remainingBalanceAfterPay)}</span>
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
          size="lg"
          onClick={() => paymentMutation.mutate()}
          disabled={paymentMutation.isPending || payAmountNum <= 0 || payAmountNum > invoice.balanceAmount + 0.01}
          className="gap-2 font-semibold"
        >
          <FileCheck className="h-4 w-4" />
          {paymentMutation.isPending ? "Recording Payment..." : "Confirm & Post Payment"}
        </Button>
      </div>
    </div>
  );
}
