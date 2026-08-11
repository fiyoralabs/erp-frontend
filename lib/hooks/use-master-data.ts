"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  Brand,
  Category,
  CustomerGroup,
  PaymentMethod,
  PriceList,
  Reason,
  Tax,
  Unit,
} from "@/lib/types/master";

// Read-only fetch for the 8 "simple" master data entities (see
// lib/types/master.ts). These are admin-edited in Settings > Master Data
// but *read* from a dozen+ unrelated screens (product forms, sales,
// purchases, POS, reports...). Each screen used to give its own query key
// ("product-workspace", "sales", "purchase", ...) for the exact same
// unfiltered list, so React Query treated them as unrelated caches and
// refetched the same rows over and over while navigating between screens.
// One canonical key per entity lets the cache actually dedupe.
//
// staleTime is long because it's safe, not because freshness doesn't
// matter: every mutation on these entities (master-crud-page.tsx's
// invalidate(), and app/(dashboard)/master/categories's own) already calls
// qc.invalidateQueries on the ["master", <entity>] prefix, which matches
// this hook's key too and forces an immediate refetch right after any
// create/update/delete -- so staleness only lingers for edits made by a
// *different* browser tab/user, which is an acceptable tradeoff for data
// that changes on the order of "once a month," not "once a minute."
const REFERENCE_STALE_TIME = 5 * 60_000;

function useMasterList<T>(entity: string, size = 500) {
  return useQuery({
    queryKey: ["master", entity, "lookup"],
    queryFn: () => apiClient.get<PagedResult<T>>(`master/${entity}?page=0&size=${size}`),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export const useCategoriesLookup = () => useMasterList<Category>("categories");
export const useBrandsLookup = () => useMasterList<Brand>("brands");
export const useUnitsLookup = () => useMasterList<Unit>("units");
export const useTaxesLookup = () => useMasterList<Tax>("taxes");
export const usePaymentMethodsLookup = () => useMasterList<PaymentMethod>("payment-methods");
export const useReasonsLookup = () => useMasterList<Reason>("reasons");
export const useCustomerGroupsLookup = () => useMasterList<CustomerGroup>("customer-groups");
export const usePriceListsLookup = () => useMasterList<PriceList>("price-lists");
