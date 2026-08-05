import { Suspense } from "react";
import { CreateInvoiceClient } from "@/components/purchases/create-invoice-client";

export default function CreateInvoicePage() {
  return (
    <Suspense fallback={<div className="p-6 font-medium text-sm">Loading invoice workspace...</div>}>
      <CreateInvoiceClient />
    </Suspense>
  );
}
