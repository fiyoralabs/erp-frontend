"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Phone, Mail, MessageSquare, StickyNote, CalendarCheck, CheckSquare, Clock,
  UserPlus, ArrowRightLeft, Handshake, FileText, DollarSign, Trophy, XCircle,
} from "lucide-react";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { RelatedEntityType, TimelineEvent } from "@/lib/types/crm";
import { formatDateTime } from "@/components/crm/shared/format";
import { useUserNameLookup } from "@/components/crm/shared/user-select";
import { Loader2 } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LEAD_CREATED: UserPlus,
  LEAD_ASSIGNED: ArrowRightLeft,
  LEAD_STATUS_CHANGED: ArrowRightLeft,
  LEAD_CONVERTED: Handshake,
  ACCOUNT_CREATED: UserPlus,
  CONTACT_CREATED: UserPlus,
  OPPORTUNITY_CREATED: FileText,
  OPPORTUNITY_STAGE_CHANGED: ArrowRightLeft,
  OPPORTUNITY_WON: Trophy,
  OPPORTUNITY_LOST: XCircle,
  QUOTATION_CREATED: DollarSign,
  FOLLOW_UP_SCHEDULED: Clock,
  FOLLOW_UP_COMPLETED: CalendarCheck,
  ACTIVITY_CALL: Phone,
  ACTIVITY_MEETING: CalendarCheck,
  ACTIVITY_EMAIL: Mail,
  ACTIVITY_WHATSAPP: MessageSquare,
  ACTIVITY_NOTE: StickyNote,
  ACTIVITY_TASK: CheckSquare,
};

export function CrmTimeline({ relatedType, relatedId }: { relatedType: RelatedEntityType; relatedId: number }) {
  const query = useQuery({
    queryKey: ["crm", "timeline", relatedType, relatedId],
    queryFn: () => apiClient.get<PagedResult<TimelineEvent>>(`crm/timeline/${relatedType}/${relatedId}?size=50`),
  });
  const userNameById = useUserNameLookup();

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading timeline...
      </div>
    );
  }

  const events = query.data?.content ?? [];
  if (events.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {events.map((event) => {
        const Icon = ICONS[event.eventType] ?? Clock;
        return (
          <li key={event.id} className="flex gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">{event.title}</p>
              {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
              <p className="text-xs text-muted-foreground">
                {formatDateTime(event.occurredAt)}
                {event.actorUserId && <> · {userNameById.get(event.actorUserId) ?? `User #${event.actorUserId}`}</>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
