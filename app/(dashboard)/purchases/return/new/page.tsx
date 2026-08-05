import { Suspense } from "react";
import { CreateReturnClient } from "@/components/purchases/create-return-client";

export default function CreateReturnPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading purchase return...</div>}>
      <CreateReturnClient />
    </Suspense>
  );
}
