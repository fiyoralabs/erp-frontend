import { Suspense } from "react";
import { CreatePaymentClient } from "@/components/purchases/create-payment-client";

export default function CreatePaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 font-medium text-sm">Loading payment workspace...</div>}>
      <CreatePaymentClient />
    </Suspense>
  );
}
