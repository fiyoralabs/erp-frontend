import { Suspense } from "react";
import { POSClient } from "@/components/sales/pos-client";

export default function POSPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading POS Terminal...</div>}>
      <POSClient />
    </Suspense>
  );
}
