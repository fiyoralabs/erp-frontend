import { Suspense } from "react";
import { ReceivePOClient } from "@/components/purchases/receive-po-client";
import { Loader2 } from "lucide-react";

export default function ReceiveGoodsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ReceivePOClient />
    </Suspense>
  );
}
