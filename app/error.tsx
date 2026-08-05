"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { toast.error(error.message || "This page could not be loaded"); }, [error]);
  return <div className="mx-auto flex min-h-64 max-w-lg flex-col items-center justify-center gap-3 text-center"><h2 className="text-xl font-semibold">Something went wrong</h2><p className="text-sm text-muted-foreground">{error.message || "This page could not be loaded."}</p><Button onClick={reset}>Try again</Button></div>;
}
