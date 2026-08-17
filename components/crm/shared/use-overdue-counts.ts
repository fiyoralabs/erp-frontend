"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

type RelatedEntityType = "LEAD" | "CONTACT" | "ACCOUNT" | "OPPORTUNITY";

interface OverdueSummary {
  overdueTasks: number;
  overdueFollowUps: number;
  totalOverdue: number;
  overdueByRelatedType: Partial<Record<RelatedEntityType, number>>;
}

const NAV_HREF_TO_RELATED_TYPE: Record<string, RelatedEntityType> = {
  "/crm/leads": "LEAD",
  "/crm/contacts": "CONTACT",
  "/crm/accounts": "ACCOUNT",
  "/crm/opportunities": "OPPORTUNITY",
};

function useOverdueCountsInternal() {
  const query = useQuery({
    queryKey: ["crm", "dashboard", "overdue-summary"],
    queryFn: () => apiClient.get<OverdueSummary>("crm/dashboard/overdue-summary"),
    refetchInterval: 60_000,
  });
  const byType = query.data?.overdueByRelatedType ?? {};

  return {
    forNavHref(href: string): number {
      const type = NAV_HREF_TO_RELATED_TYPE[href];
      return type ? byType[type] ?? 0 : 0;
    },
  };
}

// Polled from the sidebar/nav so each entity's badge shows only what's overdue
// for *that* entity (combined overdue tasks + follow-ups), instead of every nav
// item repeating the same company-wide total.
export function useOverdueCounts() {
  let hasClient = false;
  try {
    useQueryClient();
    hasClient = true;
  } catch {
    hasClient = false;
  }

  if (!hasClient) {
    return {
      forNavHref(): number {
        return 0;
      },
    };
  }

  return useOverdueCountsInternal();
}
