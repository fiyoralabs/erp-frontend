import { Badge } from "@/components/ui/badge";
import type { LeadRating, LeadStatus, OpportunityStatus, CrmTaskStatus, FollowUpStatus } from "@/lib/types/crm";
import { cn } from "@/lib/utils";

const LEAD_STATUS_TONE: Record<LeadStatus, string> = {
  NEW: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  CONTACTED: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  ATTEMPTED_CONTACT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  INTERESTED: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  QUALIFIED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  UNQUALIFIED: "bg-muted text-muted-foreground",
  NURTURING: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  CONVERTED: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  LOST: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", LEAD_STATUS_TONE[status])}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

const RATING_TONE: Record<LeadRating, string> = {
  HOT: "bg-red-500/10 text-red-600 dark:text-red-400",
  WARM: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  COLD: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

export function LeadRatingBadge({ rating }: { rating: LeadRating | null }) {
  if (!rating) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className={cn("border-transparent", RATING_TONE[rating])}>
      {rating}
    </Badge>
  );
}

const OPPORTUNITY_STATUS_TONE: Record<OpportunityStatus, string> = {
  OPEN: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  WON: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  LOST: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export function OpportunityStatusBadge({ status }: { status: OpportunityStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", OPPORTUNITY_STATUS_TONE[status])}>
      {status}
    </Badge>
  );
}

const TASK_STATUS_TONE: Record<CrmTaskStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  IN_PROGRESS: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function CrmTaskStatusBadge({ status }: { status: CrmTaskStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", TASK_STATUS_TONE[status])}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

const FOLLOW_UP_STATUS_TONE: Record<FollowUpStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", FOLLOW_UP_STATUS_TONE[status])}>
      {status}
    </Badge>
  );
}
