import { XCircle } from "lucide-react";
import { getErpApiUrl } from "@/lib/env-config";
import type { ApiResponse } from "@/lib/api-client";
import type { NormalizedInvoiceDisplay } from "@/components/sales/invoice-receipt-document";
import { InvoiceReceiptDocument } from "@/components/sales/invoice-receipt-document";
import { PrintReceiptButton } from "./print-button";

// Public, unauthenticated page -- reachable by anyone who scans the "Scan to
// Verify" QR on a printed receipt, no login required. By explicit product
// decision there is no authenticated/anonymous distinction: whoever holds
// the unguessable verify_token link sees the exact same full invoice detail
// a cashier would, rendered with the same shared receipt component used in
// POS/Sales (see InvoiceReceiptDocument) -- never a separate, lesser view.

interface PublicVerificationLine {
  productName: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  sellingPrice: number;
  lineTotal: number;
}

interface PublicInvoiceVerification {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  creditAppliedAmount: number;
  returnedAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod: string;
  customerName: string | null;
  customerPhone: string | null;
  customerGstin: string | null;
  storeName: string;
  storeGstin: string | null;
  storeUpiId: string | null;
  lines: PublicVerificationLine[];
}

async function fetchVerification(token: string): Promise<PublicInvoiceVerification | null> {
  try {
    const res = await fetch(`${getErpApiUrl()}/api/v1/sales/invoices/verify/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const body = (await res.json()) as ApiResponse<PublicInvoiceVerification>;
    if (!res.ok || !body.success) return null;
    return body.data;
  } catch {
    return null;
  }
}

function toDisplay(v: PublicInvoiceVerification, token: string): NormalizedInvoiceDisplay {
  return {
    isReturn: false,
    id: v.id,
    invoiceNumber: v.invoiceNumber,
    invoiceDate: v.invoiceDate,
    status: v.status,
    isPaid: v.status === "PAID" || v.status === "POSTED" || v.balanceAmount <= 0,
    customerName: v.customerName ?? "Walk-in Customer",
    customerPhone: v.customerPhone ?? undefined,
    customerGstin: v.customerGstin ?? undefined,
    locationName: v.storeName,
    locationGstin: v.storeGstin ?? undefined,
    storeUpiId: v.storeUpiId,
    verifyToken: token,
    subtotal: v.subtotal,
    taxAmount: v.taxAmount,
    totalAmount: v.totalAmount,
    creditAppliedAmount: v.creditAppliedAmount,
    returnedAmount: v.returnedAmount,
    paidAmount: v.paidAmount,
    balanceAmount: v.balanceAmount,
    paymentMethod: v.paymentMethod,
    lines: v.lines.map((line) => ({
      productName: line.productName,
      variantName: line.variantName ?? undefined,
      sku: line.sku ?? undefined,
      quantity: line.quantity,
      unitPrice: line.sellingPrice,
      lineTotal: line.lineTotal,
    })),
  };
}

export default async function VerifySalesInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const verification = await fetchVerification(token);

  if (!verification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-lg p-6 text-center">
          <XCircle className="h-10 w-10 text-slate-300 mx-auto" />
          <h1 className="mt-3 text-base font-bold text-slate-900">This receipt could not be verified</h1>
          <p className="text-xs text-slate-500 mt-1.5">
            The link is invalid or expired. If you believe this is an error, contact the store directly.
          </p>
        </div>
      </div>
    );
  }

  const data = toDisplay(verification, token);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="flex justify-end print:hidden">
          <PrintReceiptButton />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <InvoiceReceiptDocument data={data} />
        </div>
      </div>
    </div>
  );
}
