"use client";

import * as React from "react";
import { Loader2, Printer, Receipt, Send, X } from "lucide-react";
import { toast } from "sonner";

import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { Customer, SalesInvoice, SalesReturn } from "@/lib/types/sales";
import type { Location } from "@/lib/types/master";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  InvoiceReceiptDocument,
  normalizeInvoiceForDisplay,
  type InvoiceDialogValue,
  type POSInvoiceData,
} from "@/components/sales/invoice-receipt-document";

export type { InvoiceDialogValue, POSInvoiceData };

interface SalesInvoiceDialogProps {
  open: boolean;
  invoice: InvoiceDialogValue;
  customer?: Customer | null;
  location?: Location | null;
  onClose: () => void;
}

const message = (e: unknown) => (e instanceof ApiRequestError || e instanceof Error ? e.message : "Something went wrong");

export function SalesInvoiceDialog({ open, invoice, customer, location, onClose }: SalesInvoiceDialogProps) {
  const [isSendingWa, setIsSendingWa] = React.useState(false);

  const data = normalizeInvoiceForDisplay(invoice, customer, location);
  if (!invoice || !data) return null;

  const handleSendWhatsApp = async () => {
    setIsSendingWa(true);
    try {
      await apiClient.post(`sales/invoices/${data.id}/send-whatsapp`, {});
      toast.success("Invoice sent via WhatsApp");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setIsSendingWa(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 border-none bg-transparent shadow-2xl">
        <div className="bg-card border rounded-2xl overflow-hidden shadow-2xl text-foreground">
          {/* Top Invoice Actions Toolbar */}
          <div className="p-3 sm:p-4 border-b bg-muted/40 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Receipt className="h-5 w-5 text-[#0F3D3E] shrink-0" />
              <h2 className="font-bold text-sm sm:text-base truncate font-mono">
                {data.isReturn ? "Return" : "Invoice"} #{data.invoiceNumber}
              </h2>
              <Badge
                variant="secondary"
                className={
                  data.isPaid
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 shrink-0 text-[10px] sm:text-xs"
                    : "bg-amber-50 text-amber-800 border-amber-200 shrink-0 text-[10px] sm:text-xs"
                }
              >
                {data.status.replaceAll("_", " ")}
              </Badge>
            </div>

            <div className="flex items-center gap-2 shrink-0 justify-end">
              <Button
                size="sm"
                onClick={handleSendWhatsApp}
                disabled={isSendingWa}
                className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 text-xs font-semibold h-8 px-2.5"
              >
                {isSendingWa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span className="hidden xs:inline">Send via</span> WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 text-xs h-8 px-2.5">
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <InvoiceReceiptDocument data={data} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
