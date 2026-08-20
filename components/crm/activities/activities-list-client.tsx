"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, MessageSquare, StickyNote, CalendarCheck, MapPin, FileText, Clock, CheckCircle2, AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, type PagedResult } from "@/lib/api-client";
import { buildReturnTo } from "@/lib/return-to";
import type { Activity, ActivityType, FollowUp } from "@/lib/types/crm";
import { formatDateTime } from "@/components/crm/shared/format";
import { useUserNameLookup } from "@/components/crm/shared/user-select";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone, MEETING: CalendarCheck, EMAIL: Mail, WHATSAPP: MessageSquare, SMS: MessageSquare,
  NOTE: StickyNote, VISIT: MapPin, DEMO: FileText, PROPOSAL: FileText, OTHER: FileText,
};

function getRelatedLink(relatedType?: string, relatedId?: number, leadReturnTo?: string) {
  if (!relatedType || !relatedId) return null;
  const t = relatedType.toUpperCase();
  // Lead detail's Back button reads this to return here (including whatever
  // view/page this page was showing) instead of always landing on the plain
  // Leads list -- see lead-detail-client.tsx.
  if (t === "LEAD") {
    const base = `/crm/leads/${relatedId}`;
    return leadReturnTo ? `${base}?returnTo=${encodeURIComponent(leadReturnTo)}` : base;
  }
  if (t === "OPPORTUNITY") return `/crm/opportunities/${relatedId}`;
  if (t === "CONTACT") return `/crm/contacts/${relatedId}`;
  if (t === "ACCOUNT") return `/crm/accounts/${relatedId}`;
  return null;
}

const RELATED_TYPE_LABEL: Record<string, string> = {
  LEAD: "Open Lead", OPPORTUNITY: "Open Deal", CONTACT: "Open Contact", ACCOUNT: "Open Account",
};

const VIEWS = [
  { value: "ALL", label: "All Engagements" },
  { value: "FOLLOWUPS", label: "Follow-ups Only" },
  { value: "ACTIVITIES", label: "Activities Only" },
  { value: "PENDING", label: "Pending Follow-ups" },
  { value: "TODAY", label: "Today's Follow-ups" },
  { value: "OVERDUE", label: "Overdue" },
] as const;

type ActivityViewFilter = "ALL" | "ACTIVITIES" | "FOLLOWUPS" | "PENDING" | "TODAY" | "OVERDUE";
const VIEW_VALUES = new Set(VIEWS.map((v) => v.value));

export function ActivitiesListClient() {
  const router = useRouter();
  // The URL is the source of truth for filter/page state -- not a parallel
  // useState -- so a browser refresh, a direct link, and the Lead detail
  // page's "Back" (which restores this exact URL) all land on the same
  // filtered view without any separate persistence mechanism.
  const searchParams = useSearchParams();

  const requestedView = searchParams.get("view");
  const filter: ActivityViewFilter =
    requestedView && VIEW_VALUES.has(requestedView as ActivityViewFilter)
      ? (requestedView as ActivityViewFilter)
      : "ALL";
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0);

  function updateParams(next: { view?: ActivityViewFilter; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.view !== undefined) {
      if (next.view === "ALL") params.delete("view");
      else params.set("view", next.view);
      params.delete("page"); // changing the view resets pagination, same as before
    }
    if (next.page !== undefined) {
      if (next.page === 0) params.delete("page");
      else params.set("page", String(next.page));
    }
    const qs = params.toString();
    router.replace(`/crm/activities${qs ? `?${qs}` : ""}`);
  }

  const returnTo = buildReturnTo("/crm/activities", searchParams);

  const actQuery = useQuery({
    queryKey: ["crm", "activities", "all", page],
    queryFn: () => apiClient.get<PagedResult<Activity>>(`crm/activities?page=${page}&size=50`),
  });

  const fuQuery = useQuery({
    queryKey: ["crm", "follow-ups", "list", filter, page],
    queryFn: () => apiClient.get<PagedResult<FollowUp>>(`crm/follow-ups?view=${filter === "ACTIVITIES" ? "ALL" : filter}&page=${page}&size=50`),
  });

  // Combine Activities and Follow-ups into a Single Unified Stream
  const combinedData = React.useMemo(() => {
    const items: Array<{
      id: string;
      originalId: number;
      kind: "ACTIVITY" | "FOLLOWUP";
      type: string;
      title: string;
      description?: string;
      relatedType?: string;
      relatedId?: number;
      leadName?: string | null;
      companyName?: string | null;
      dateStr: string;
      status: string;
      rawDate: number;
      assignedUserId?: number | null;
    }> = [];

    if (filter !== "FOLLOWUPS" && filter !== "PENDING" && filter !== "TODAY" && filter !== "OVERDUE") {
      (actQuery.data?.content ?? []).forEach((a) => {
        items.push({
          id: `act-${a.id}`,
          originalId: a.id,
          kind: "ACTIVITY",
          type: a.type,
          title: a.subject,
          description: a.description ?? undefined,
          relatedType: a.relatedType,
          relatedId: a.relatedId,
          leadName: a.leadName,
          companyName: a.companyName,
          dateStr: formatDateTime(a.createdAt),
          status: a.status,
          rawDate: new Date(a.createdAt).getTime(),
          assignedUserId: a.assignedUserId,
        });
      });
    }

    if (filter !== "ACTIVITIES") {
      (fuQuery.data?.content ?? []).forEach((f) => {
        items.push({
          id: `fu-${f.id}`,
          originalId: f.id,
          kind: "FOLLOWUP",
          type: f.method,
          title: f.description || `Scheduled Follow-up (${f.method})`,
          description: f.notes || f.outcome || undefined,
          relatedType: f.relatedType ?? undefined,
          relatedId: f.relatedId ?? undefined,
          leadName: f.leadName,
          companyName: f.companyName,
          dateStr: `${f.followUpDate} ${f.followUpTime || ""}`,
          status: f.status,
          rawDate: new Date(f.followUpDate).getTime(),
          assignedUserId: f.assignedUserId,
        });
      });
    }

    return items.sort((a, b) => b.rawDate - a.rawDate);
  }, [actQuery.data, fuQuery.data, filter]);

  const userNameById = useUserNameLookup();

  const columns: DataTableColumn<(typeof combinedData)[number]>[] = [
    {
      key: "kind",
      header: "Category",
      render: (r) => (
        <Badge variant={r.kind === "FOLLOWUP" ? "secondary" : "outline"} className={r.kind === "FOLLOWUP" ? "bg-blue-500/10 text-blue-600 border-blue-200" : ""}>
          {r.kind === "FOLLOWUP" ? "Follow-up" : "Activity"}
        </Badge>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => {
        const Icon = TYPE_ICON[r.type] || Clock;
        return (
          <span className="flex items-center gap-1.5 font-medium">
            <Icon className="size-4 text-muted-foreground" />
            {r.type}
          </span>
        );
      },
    },
    {
      key: "title",
      header: "Title / Description",
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.title}</p>
          {r.description && <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>}
        </div>
      ),
    },
    {
      key: "leadName",
      header: "Lead Name",
      render: (r) => (r.leadName ? <span className="font-medium">{r.leadName}</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "companyName",
      header: "Company Name",
      render: (r) => (r.companyName ? <span>{r.companyName}</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "assigned",
      header: "Assigned To",
      render: (r) => (r.assignedUserId ? userNameById.get(r.assignedUserId) ?? `User #${r.assignedUserId}` : <span className="text-muted-foreground">Unassigned</span>),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        if (r.status === "COMPLETED") {
          return <Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 size-3" />Completed</Badge>;
        }
        if (r.status === "PENDING" || r.status === "PLANNED") {
          return <Badge variant="outline" className="border-amber-400 text-amber-600"><AlertCircle className="mr-1 size-3" />{r.status}</Badge>;
        }
        return <Badge variant="outline">{r.status}</Badge>;
      },
    },
    {
      key: "date",
      header: "Date / Logged",
      render: (r) => <span className="text-sm font-medium text-muted-foreground">{r.dateStr}</span>,
    },
    {
      key: "action",
      header: "Direct Link",
      render: (r) => {
        const link = getRelatedLink(r.relatedType, r.relatedId, returnTo);
        if (!link) return null;
        return (
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); router.push(link); }}>
            {(r.relatedType && RELATED_TYPE_LABEL[r.relatedType.toUpperCase()]) || "Open"}
          </Button>
        );
      },
      hideOnCard: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">CRM Engagements & Follow-ups</h1>
        <p className="text-sm text-muted-foreground">Unified 360° interaction hub for activities, follow-ups, and sales tasks.</p>
      </div>

      {/* Desktop: existing tab strip, unchanged */}
      <div className="hidden md:block">
        <Tabs value={filter} onValueChange={(v) => updateParams({ view: v as ActivityViewFilter })} className="w-full">
          <div className="overflow-x-auto scrollbar-none pb-1">
            <TabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-max min-w-full">
              {VIEWS.map((v) => <TabsTrigger key={v.value} value={v.value}>{v.label}</TabsTrigger>)}
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* Mobile: same view filter, as a full-width select instead of a
          horizontally-scrolling pill strip -- every option stays reachable
          and legible at narrow widths without introducing page overflow. */}
      <div className="md:hidden">
        <Select value={filter} onValueChange={(v) => updateParams({ view: v as ActivityViewFilter })}>
          <SelectTrigger className="w-full h-11 rounded-xl bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEWS.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={combinedData}
        rowKey={(r) => r.id}
        isLoading={actQuery.isLoading || fuQuery.isLoading}
        emptyMessage="No CRM activities or follow-ups found."
        page={page}
        totalPages={actQuery.data?.totalPages || fuQuery.data?.totalPages}
        onPageChange={(p) => updateParams({ page: p })}
        onRowClick={(r) => {
          const link = getRelatedLink(r.relatedType, r.relatedId, returnTo);
          if (link) router.push(link);
        }}
      />
    </div>
  );
}
