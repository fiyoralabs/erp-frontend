"use client";

import { useState } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One QueryClient per browser session (useState lazy init), not module
  // scope -- module-scope would leak cached data across different users in
  // any SSR context and cause hydration mismatches.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => toast.error(errorMessage(error), {
            id: `query-error-${query.queryHash}`,
          }),
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            // Most existing mutations already provide a contextual onError.
            // Supply the global fallback only when a screen omitted one.
            if (!mutation.options.onError) toast.error(errorMessage(error));
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
