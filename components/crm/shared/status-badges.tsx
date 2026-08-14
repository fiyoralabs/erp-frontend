import { Badge } from "@/components/ui/badge";
import type { LeadRating, LeadStatus, OpportunityStatus, CrmTaskStatus, FollowUpStatus } from "@/lib/types/crm";
import { cn } from "@/lib/utils";

const LEAD_STATUS_TONE: Record<LeadStatus, string> = {
  NEW: "bg-[#E8F0FE] text-[#1A73E8] dark:bg-[#1A73E8]/20 dark:text-[#8AB4F8]",
  CONTACTED: "bg-[#FFF8E1] text-[#B78103] dark:bg-[#B78103]/20 dark:text-[#FDD663]",
  ATTEMPTED_CONTACT: "bg-[#FFF8E1] text-[#B78103] dark:bg-[#B78103]/20 dark:text-[#FDD663]",
  INTERESTED: "bg-[#F3E8FD] text-[#9334E8] dark:bg-[#9334E8]/20 dark:text-[#C58AF9]",
  QUALIFIED: "bg-[#E6F4EA] text-[#137333] dark:bg-[#137333]/20 dark:text-[#81C995]",
  UNQUALIFIED: "bg-[#F1F3F4] text-[#5F6368] dark:bg-[#3C4043] dark:text-[#BDC1C6]",
  NURTURING: "bg-[#E8EAF6] text-[#3F51B5] dark:bg-[#3F51B5]/20 dark:text-[#9FA8DA]",
  CONVERTED: "bg-[#E6F4EA] text-[#137333] dark:bg-[#137333]/20 dark:text-[#81C995]",
  LOST: "bg-[#FCE8E6] text-[#C5221F] dark:bg-[#C5221F]/20 dark:text-[#F28B82]",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-semibold uppercase tracking-wider text-[11px] px-2.5 py-0.5 rounded-md", LEAD_STATUS_TONE[status])}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

const RATING_TONE: Record<LeadRating, string> = {
  HOT: "bg-[#FCE8E6] text-[#C5221F] dark:bg-[#C5221F]/20 dark:text-[#F28B82]",
  WARM: "bg-[#FFF8E1] text-[#B78103] dark:bg-[#B78103]/20 dark:text-[#FDD663]",
  COLD: "bg-[#d5e0f8] text-[#586377] dark:bg-[#3c475a] dark:text-[#bcc7de]",
};

export function LeadRatingBadge({ rating }: { rating: LeadRating | null }) {
  if (!rating) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className={cn("border-transparent font-semibold uppercase tracking-wider text-[11px] px-2.5 py-0.5 rounded-md", RATING_TONE[rating])}>
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
