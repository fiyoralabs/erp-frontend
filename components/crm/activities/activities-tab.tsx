"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Phone, Mail, MessageSquare, StickyNote, CalendarCheck, MapPin, FileText, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { Activity, ActivityType, RelatedEntityType } from "@/lib/types/crm";
import { ActivityDialog } from "@/components/crm/activities/activity-dialog";
import { formatDateTime } from "@/components/crm/shared/format";
import { useUserNameLookup } from "@/components/crm/shared/user-select";

const TYPE_ICON: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  CALL: Phone, MEETING: CalendarCheck, EMAIL: Mail, WHATSAPP: MessageSquare, SMS: MessageSquare,
  NOTE: StickyNote, VISIT: MapPin, DEMO: FileText, PROPOSAL: FileText, OTHER: FileText,
};

export function ActivitiesTab({ relatedType, relatedId }: { relatedType: RelatedEntityType; relatedId: number }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const query = useQuery({
    queryKey: ["crm", "activities", relatedType, relatedId],
    queryFn: () => apiClient.get<Activity[]>(`crm/activities/by-related/${relatedType}/${relatedId}`),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`crm/activities/${id}/complete`),
    onSuccess: () => {
      toast.success("Activity marked complete.");
      qc.invalidateQueries({ queryKey: ["crm", "activities", relatedType, relatedId] });
    },
  });

  const activities = query.data ?? [];
  const userNameById = useUserNameLookup();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> Log Activity
        </Button>
      </div>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : activities.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No activities logged yet.</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {activities.map((a) => {
            const Icon = TYPE_ICON[a.type];
            return (
              <Card key={a.id}>
                <CardContent className="flex items-start justify-between gap-3 py-3">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{a.subject}</p>
                      {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(a.createdAt)} · {a.status}
                        {a.assignedUserId && <> · Attended by {userNameById.get(a.assignedUserId) ?? `User #${a.assignedUserId}`}</>}
                        {a.createdBy && <> · Logged by {userNameById.get(a.createdBy) ?? `User #${a.createdBy}`}</>}
                      </p>
                    </div>
                  </div>
                  {a.status !== "COMPLETED" && (
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => completeMutation.mutate(a.id)} aria-label="Mark complete">
                      <CheckCircle2 className="size-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} relatedType={relatedType} relatedId={relatedId} />
    </div>
  );
}
