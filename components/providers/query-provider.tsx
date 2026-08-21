"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) =>
        toast.error(errorMessage(error), {
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
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client for SSR requests
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // Avoids re-creating client if React suspends during initial render
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
