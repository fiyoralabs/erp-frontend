"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { FollowUp, RelatedEntityType } from "@/lib/types/crm";
import { FollowUpDialog } from "@/components/crm/shared/follow-up-dialog";
import { FollowUpCompleteDialog } from "@/components/crm/shared/follow-up-complete-dialog";
import { FollowUpStatusBadge } from "@/components/crm/shared/status-badges";
import { formatDate } from "@/components/crm/shared/format";
import { useUserNameLookup } from "@/components/crm/shared/user-select";

export function FollowUpsTab({ relatedType, relatedId }: { relatedType: RelatedEntityType; relatedId: number }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [completingId, setCompletingId] = React.useState<number | null>(null);

  const queryKey = ["crm", "follow-ups", "by-related", relatedType, relatedId] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => apiClient.get<FollowUp[]>(`crm/follow-ups/by-related/${relatedType}/${relatedId}`),
  });

  const followUps = query.data ?? [];
  const userNameById = useUserNameLookup();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> Add Follow-up
        </Button>
      </div>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : followUps.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No follow-ups scheduled.</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {followUps.map((f) => (
            <Card key={f.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{formatDate(f.followUpDate)} · {f.method}</p>
                  {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
                  {f.outcome && <p className="text-xs text-muted-foreground">Outcome: {f.outcome}</p>}
                  {f.assignedUserId && (
                    <p className="text-xs text-muted-foreground">Assigned to {userNameById.get(f.assignedUserId) ?? `User #${f.assignedUserId}`}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <FollowUpStatusBadge status={f.status} />
                  {f.status === "PENDING" && (
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setCompletingId(f.id)} aria-label="Complete follow-up">
                      <CheckCircle2 className="size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <FollowUpDialog open={dialogOpen} onOpenChange={setDialogOpen} relatedType={relatedType} relatedId={relatedId} />
      <FollowUpCompleteDialog open={completingId !== null} onOpenChange={(o) => !o && setCompletingId(null)} followUpId={completingId} invalidateKey={queryKey} />
    </div>
  );
}
