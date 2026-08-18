"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintReceiptButton() {
  return (
    <Button onClick={() => window.print()} className="gap-1.5 text-xs h-9 px-3 bg-emerald-700 hover:bg-emerald-800 text-white">
      <Download className="h-3.5 w-3.5" /> Download / Print
    </Button>
  );
}
