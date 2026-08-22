"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Customer, SalesInvoice, SalesReturn } from "@/lib/types/sales";
import type { Location } from "@/lib/types/master";

// Single source of truth for what a printed/verified invoice document looks
// like -- used both inside the authenticated SalesInvoiceDialog (POS/Sales)
// and the public /verify/sales-invoice/[token] page. Keeping this in one
// place means the two can never visually drift apart.

export interface POSInvoiceData {
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
  verifyToken?: string | null;
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

export type InvoiceDialogValue = SalesInvoice | POSInvoiceData | SalesReturn | null;

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export interface NormalizedInvoiceDisplay {
  isReturn: boolean;
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  isPaid: boolean;
  customerName: string;
  customerPhone?: string;
  customerGstin?: string;
  locationName: string;
  locationGstin?: string;
  storeUpiId: string | null;
  verifyToken?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  creditAppliedAmount: number;
  returnedAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod: string;
  tenderedCash?: number;
  changeDue?: number;
  previousBalance?: number;
  lines: Array<{
    productName: string;
    variantName?: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

/** Standardizes fields across SalesInvoice, POSInvoiceData, and SalesReturn into one display shape. */
export function normalizeInvoiceForDisplay(
  invoice: InvoiceDialogValue,
  customer?: Customer | null,
  location?: Location | null
): NormalizedInvoiceDisplay | null {
  if (!invoice) return null;

  const id = invoice.id;
  const isReturn = "returnNumber" in invoice;
  const invoiceNumber = isReturn
    ? (invoice as SalesReturn).returnNumber
    : ("invoiceNumber" in invoice ? (invoice as any).invoiceNumber : `INV-${id}`);
  const invoiceDate = isReturn
    ? (invoice as SalesReturn).returnDate
    : ("invoiceDate" in invoice ? (invoice as any).invoiceDate : new Date().toISOString().split("T")[0]);
  const status = invoice.status ?? "POSTED";

  const customerName = ("customerName" in invoice && invoice.customerName)
    ? invoice.customerName
    : customer?.name ?? "Walk-in Customer";
  const customerPhone = ("customerPhone" in invoice && invoice.customerPhone)
    ? invoice.customerPhone
    : customer?.phone ?? undefined;
  const customerGstin = ("customerGstin" in invoice && invoice.customerGstin)
    ? invoice.customerGstin
    : customer?.gstNumber ?? undefined;

  const locationName = ("locationName" in invoice && invoice.locationName)
    ? invoice.locationName
    : location?.name ?? "Main Store";

  const subtotal = ("subtotal" in invoice && typeof invoice.subtotal === "number") ? invoice.subtotal : invoice.totalAmount ?? 0;
  const taxAmount = ("taxAmount" in invoice && typeof invoice.taxAmount === "number") ? invoice.taxAmount : 0;
  const totalAmount = invoice.totalAmount ?? 0;
  const creditAppliedAmount = ("creditAppliedAmount" in invoice && typeof invoice.creditAppliedAmount === "number") ? invoice.creditAppliedAmount : 0;
  const returnedAmount = ("returnedAmount" in invoice && typeof invoice.returnedAmount === "number") ? invoice.returnedAmount : 0;
  const paidAmount = ("paidAmount" in invoice && typeof invoice.paidAmount === "number")
    ? invoice.paidAmount
    : ("payments" in invoice && Array.isArray((invoice as any).payments) && (invoice as any).payments.length > 0)
    ? (invoice as SalesInvoice).payments.reduce((sum, p) => sum + p.amount, 0)
    : totalAmount;

  const balanceAmount = ("balanceAmount" in invoice && typeof invoice.balanceAmount === "number")
    ? invoice.balanceAmount
    : Math.max(0, totalAmount - paidAmount - creditAppliedAmount);

  const paymentMethod = ("paymentMethod" in invoice && invoice.paymentMethod)
    ? invoice.paymentMethod
    : ("payments" in invoice && Array.isArray((invoice as any).payments) && (invoice as any).payments.length > 0)
    ? (invoice as SalesInvoice).payments.map((p) => p.paymentMethodName || p.paymentMethodCode).join(", ")
    : "Cash / Direct";

  // Backend already resolves location-then-company for real SalesInvoice/POSInvoiceData rows
  // (SalesInvoiceServiceImpl.resolveStoreUpiId) -- never guessed client-side, and never a
  // placeholder: null means genuinely unconfigured, and the QR just doesn't render for that.
  const storeUpiId =
    ("locationUpiId" in invoice && invoice.locationUpiId) ? invoice.locationUpiId
    : ("storeUpiId" in invoice && invoice.storeUpiId) ? invoice.storeUpiId
    : null;
  const locationGstin = ("locationGstin" in invoice && invoice.locationGstin) ? invoice.locationGstin : location?.gstin ?? undefined;
  const verifyToken = ("verifyToken" in invoice && invoice.verifyToken) ? invoice.verifyToken : undefined;

  const tenderedCash = ("tenderedCash" in invoice && typeof invoice.tenderedCash === "number") ? invoice.tenderedCash : undefined;
  const changeDue = ("changeDue" in invoice && typeof invoice.changeDue === "number") ? invoice.changeDue : undefined;
  const previousBalance = ("previousBalance" in invoice && typeof invoice.previousBalance === "number") ? invoice.previousBalance : undefined;

  const lines = (invoice.lines ?? []).map((line: any) => ({
    productName: line.productName ?? ("productId" in line ? `Product #${line.productId}` : "Item"),
    variantName: line.variantName ?? undefined,
    sku: line.variantSku ?? line.sku ?? line.productCode ?? undefined,
    quantity: line.quantity ?? 1,
    unitPrice: line.sellingPrice ?? line.unitPrice ?? line.normalSellingPrice ?? 0,
    lineTotal: line.lineTotal ?? ((line.quantity ?? 1) * (line.sellingPrice ?? line.unitPrice ?? 0)),
  }));

  const isPaid = status === "PAID" || status === "POSTED" || balanceAmount <= 0;

  return {
    isReturn, id, invoiceNumber, invoiceDate, status, isPaid,
    customerName, customerPhone, customerGstin,
    locationName, locationGstin, storeUpiId, verifyToken,
    subtotal, taxAmount, totalAmount, creditAppliedAmount, returnedAmount, paidAmount, balanceAmount,
    paymentMethod, tenderedCash, changeDue, previousBalance, lines,
  };
}

/** The actual receipt document body -- store header, line items, totals, signatory footer. No toolbar, no modal chrome. */
export function InvoiceReceiptDocument({ data }: { data: NormalizedInvoiceDisplay }) {
  const showUpiQr = !data.isReturn && !data.isPaid && !!data.storeUpiId;
  return (
    <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 bg-white text-slate-900">
      {/* Store & Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight break-words text-slate-900">{data.locationName}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Fiyora Enterprise Retail & Operations</p>
          {data.locationGstin && (
            <Badge variant="outline" className="mt-1 text-[10px] font-mono">
              GSTIN: {data.locationGstin}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
          {data.verifyToken && (
            <div className="flex flex-col items-center">
              <QRCodeSVG
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/verify/sales-invoice/${data.verifyToken}`}
                size={56}
                level="M"
              />
              <span className="text-[8px] sm:text-[9px] text-slate-400 mt-0.5 font-bold uppercase tracking-widest">
                Scan to Verify
              </span>
            </div>
          )}
          <div className="text-right">
            <h2 className="text-lg sm:text-xl font-black text-[#0F3D3E] tracking-tight">
              {data.isReturn ? "CREDIT NOTE" : "TAX INVOICE"}
            </h2>
            <div className="flex items-center justify-end gap-1.5 flex-wrap">
              <Badge
                className={
                  data.isPaid
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] uppercase font-bold"
                    : "bg-amber-50 text-amber-800 border border-amber-200 text-[10px] uppercase font-bold"
                }
              >
                {data.status.replaceAll("_", " ")}
              </Badge>
              {!data.isReturn && data.returnedAmount > 0 && (
                <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] uppercase font-bold">
                  Item(s) Returned
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edge-to-Edge Meta Strip */}
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-slate-50 rounded-xl border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="min-w-0">
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Document No</span>
          <span className="font-semibold font-mono break-all text-[11px] sm:text-xs text-slate-900">{data.invoiceNumber}</span>
        </div>
        <div className="sm:border-l sm:border-slate-200 sm:pl-3 min-w-0">
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Date</span>
          <span className="font-semibold text-[11px] sm:text-xs text-slate-900">{data.invoiceDate}</span>
        </div>
        <div className="sm:border-l sm:border-slate-200 sm:pl-3 min-w-0">
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Payment Method</span>
          <span className="font-semibold text-[#0F3D3E] text-[11px] sm:text-xs">{data.paymentMethod}</span>
        </div>
        <div className="sm:border-l sm:border-slate-200 sm:pl-3 min-w-0">
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Status</span>
          <span className="font-semibold text-[#0F3D3E] text-[11px] sm:text-xs">{data.status}</span>
        </div>
      </div>

      {/* Billed To Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-b border-slate-200 pb-4 text-xs">
        <div className="min-w-0 space-y-0.5">
          <span className="text-slate-500 uppercase font-bold text-[10px] block mb-1">Billed To</span>
          <div className="font-bold text-sm text-slate-900 break-words">{data.customerName}</div>
          {data.customerPhone && <div className="text-slate-500">Phone: {data.customerPhone}</div>}
          {data.customerGstin && <div className="text-slate-500 font-mono break-all text-[11px]">GSTIN: {data.customerGstin}</div>}
        </div>
        <div className="min-w-0 space-y-0.5">
          <span className="text-slate-500 uppercase font-bold text-[10px] block mb-1">Store Location</span>
          <div className="font-semibold text-slate-900 break-words">{data.locationName}</div>
          <div className="text-slate-500">Thank you for your business!</div>
        </div>
      </div>

      {/* Mobile Purchased Items Card List (<sm) */}
      <div className="sm:hidden space-y-2 border border-slate-200/80 rounded-xl p-2.5 bg-slate-50/50 divide-y divide-slate-200/60">
        <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider pb-1">
          Purchased Items ({data.lines.length})
        </div>
        {data.lines.map((line, idx) => (
          <div key={idx} className="pt-2 pb-1 space-y-1 text-xs">
            <div className="font-medium text-slate-900 break-words">{line.productName}</div>
            {line.variantName && <div className="text-[11px] text-slate-500">{line.variantName}</div>}
            {line.sku && <div className="text-[10px] font-mono text-slate-500">SKU: {line.sku}</div>}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span>
                Qty: <strong className="text-slate-900">{line.quantity}</strong> × {money.format(line.unitPrice)}
              </span>
              <span className="font-bold text-slate-900 text-xs font-mono">{money.format(line.lineTotal)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Line Items Table (≥sm) */}
      <div className="hidden sm:block overflow-x-auto border border-slate-200/80 rounded-xl">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Description</TableHead>
              <TableHead className="text-center w-[80px]">Qty</TableHead>
              <TableHead className="text-right w-[120px]">Rate (₹)</TableHead>
              <TableHead className="text-right w-[130px]">Amount (₹)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.lines.map((line, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium text-xs">
                  <div className="break-words text-slate-900">{line.productName}</div>
                  {line.variantName && <div className="text-[11px] text-slate-500">{line.variantName}</div>}
                  {line.sku && <div className="text-[10px] font-mono text-slate-400">SKU: {line.sku}</div>}
                </TableCell>
                <TableCell className="text-center text-xs font-mono">{line.quantity}</TableCell>
                <TableCell className="text-right text-xs font-mono">{money.format(line.unitPrice)}</TableCell>
                <TableCell className="text-right font-semibold text-xs font-mono">{money.format(line.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer Totals & Dynamic UPI QR -- the payment QR only makes sense while there's still
          something to collect (not a paid invoice, not a return) AND a UPI ID is actually
          configured (location, falling back to company) -- no placeholder, just no QR. */}
      <div className={`flex flex-col sm:flex-row sm:items-end gap-4 pt-4 border-t border-slate-200 ${showUpiQr ? "sm:justify-between" : "sm:justify-end"}`}>
        {showUpiQr && (
          <div className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl bg-slate-50 w-fit self-center sm:self-auto">
            <QRCodeSVG
              value={`upi://pay?pa=${data.storeUpiId}&pn=${encodeURIComponent(data.locationName)}&am=${data.totalAmount}&cu=INR`}
              size={72}
              level="L"
            />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Dynamic UPI QR Code
            </span>
          </div>
        )}

        <div className="w-full sm:w-auto sm:min-w-[280px] space-y-1.5 text-xs text-right">
          {data.subtotal > 0 && (
            <div className="flex justify-between gap-2 text-slate-500">
              <span>Subtotal</span>
              <span className="font-mono">{money.format(data.subtotal)}</span>
            </div>
          )}
          {data.taxAmount > 0 && (
            <div className="flex justify-between gap-2 text-slate-500">
              <span>GST / Tax</span>
              <span className="font-mono">+{money.format(data.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between gap-2 font-semibold border-t border-slate-200 pt-1 text-slate-900">
            <span>Document Total</span>
            <span className="font-mono font-bold">{money.format(data.totalAmount)}</span>
          </div>

          {data.previousBalance && data.previousBalance > 0 ? (
            <div className="flex justify-between gap-2 text-amber-700 font-medium">
              <span>Previous Customer Dues</span>
              <span className="font-mono">+{money.format(data.previousBalance)}</span>
            </div>
          ) : null}

          {data.creditAppliedAmount > 0 && (
            <div className="flex justify-between gap-2 text-emerald-700 font-medium">
              <span>Store Credit Applied</span>
              <span className="font-mono">-{money.format(data.creditAppliedAmount)}</span>
            </div>
          )}

          {data.returnedAmount > 0 && (
            <div className="flex justify-between gap-2 text-amber-700 font-medium">
              <span>Returned</span>
              <span className="font-mono">-{money.format(data.returnedAmount)}</span>
            </div>
          )}

          <div className="flex justify-between gap-2 border-t border-slate-200 pt-2 mt-1">
            <span className="font-bold text-sm text-slate-900">
              Total Paid {data.paymentMethod ? `(${data.paymentMethod})` : ""}
            </span>
            <span className="text-base sm:text-lg font-bold text-[#0F3D3E] font-mono">
              {/* paidAmount only covers THIS invoice's own payment row --
                  previous dues are collected via a separate payment against
                  an older invoice in the same checkout, so it has to be
                  added back in here for the total to match what the
                  cashier actually collected at the register. */}
              {money.format(data.paidAmount + data.creditAppliedAmount + (data.previousBalance ?? 0))}
            </span>
          </div>

          {data.tenderedCash && data.tenderedCash > 0 ? (
            <div className="flex justify-between gap-2 text-slate-500 text-[11px]">
              <span>Tendered Cash</span>
              <span className="font-mono">{money.format(data.tenderedCash)}</span>
            </div>
          ) : null}

          {data.changeDue && data.changeDue > 0 ? (
            <div className="flex justify-between gap-2 text-emerald-700 text-[11px] font-semibold">
              <span>Change Returned</span>
              <span className="font-mono">{money.format(data.changeDue)}</span>
            </div>
          ) : null}

          {data.balanceAmount > 0 && (
            <div className="flex justify-between gap-2 text-amber-700 font-semibold border-t border-slate-200 pt-1 mt-1">
              <span>Balance Due</span>
              <span className="font-mono">{money.format(data.balanceAmount)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar: Signatory Footer Block */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 pt-4 border-t border-slate-200 text-[11px] text-slate-500">
        <div>This is an electronically verified tax invoice receipt.</div>
        <div className="text-left sm:text-right space-y-0.5">
          <div className="font-bold text-slate-900">{data.locationName}</div>
          <div className="text-[10px]">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}
