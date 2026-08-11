"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiClient, ApiRequestError, type PagedResult } from "@/lib/api-client";
import type { Account, Opportunity } from "@/lib/types/crm";
import { OpportunityStatusBadge } from "@/components/crm/shared/status-badges";
import { formatCurrency } from "@/components/crm/shared/format";
import { CrmTimeline } from "@/components/crm/shared/crm-timeline";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

// Ties an existing ERP Sales Customer back to its CRM Account (if any),
// so users don't have to maintain two disconnected customer records --
// section 49/66 of the CRM spec ("Customer 360").
export function CustomerCrmDialog({ customerId, close }: { customerId: number | null; close: () => void }) {
  const qc = useQueryClient();
  const accountQuery = useQuery({
    queryKey: ["crm", "accounts", "by-customer", customerId],
    queryFn: async () => {
      try {
        return await apiClient.get<Account>(`crm/accounts/by-customer/${customerId}`);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: customerId !== null,
  });

  const linkMutation = useMutation({
    mutationFn: () => apiClient.post<Account>(`crm/accounts/from-customer/${customerId}`),
    onSuccess: () => {
      toast.success("CRM Account created and linked to this customer.");
      qc.invalidateQueries({ queryKey: ["crm", "accounts", "by-customer", customerId] });
      qc.invalidateQueries({ queryKey: ["crm", "accounts"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const opportunitiesQuery = useQuery({
    queryKey: ["crm", "opportunities", "by-account", accountQuery.data?.id],
    queryFn: () => apiClient.get<PagedResult<Opportunity>>(`crm/opportunities?accountId=${accountQuery.data!.id}&size=20`),
    enabled: !!accountQuery.data,
  });

  return (
    <Dialog open={customerId !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>CRM Activity</DialogTitle>
          <DialogDescription>Opportunities and activity linked to this customer via its CRM Account.</DialogDescription>
        </DialogHeader>

        {accountQuery.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading...</div>
        ) : !accountQuery.data ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">No CRM Account is linked to this customer yet.</p>
            <p className="text-xs text-muted-foreground">Create one now to track opportunities, activities, and timeline against this customer here in CRM.</p>
            <Button size="sm" onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending}>
              {linkMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Create CRM Account for this Customer
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>CRM Account: <span className="font-medium">{accountQuery.data.name}</span> ({accountQuery.data.accountNumber})</span>
              <Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/crm/accounts/${accountQuery.data.id}`} />}>Open Account</Button>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Opportunities</p>
              <div className="flex flex-col gap-2">
                {(opportunitiesQuery.data?.content ?? []).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/crm/opportunities/${o.id}`} className="text-primary hover:underline">{o.name}</Link>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{formatCurrency(o.amount)}</span>
                      <OpportunityStatusBadge status={o.status} />
                    </div>
                  </div>
                ))}
                {(opportunitiesQuery.data?.content?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No opportunities yet.</p>}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Timeline</p>
              <CrmTimeline relatedType="ACCOUNT" relatedId={accountQuery.data.id} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
