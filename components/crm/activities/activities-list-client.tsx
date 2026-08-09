"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, MessageSquare, StickyNote, CalendarCheck, MapPin, FileText, Clock, CheckCircle2, AlertCircle, ArrowUpRight, Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { Activity, ActivityType, FollowUp } from "@/lib/types/crm";
import { formatDateTime } from "@/components/crm/shared/format";
import { useUserNameLookup } from "@/components/crm/shared/user-select";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone, MEETING: CalendarCheck, EMAIL: Mail, WHATSAPP: MessageSquare, SMS: MessageSquare,
  NOTE: StickyNote, VISIT: MapPin, DEMO: FileText, PROPOSAL: FileText, OTHER: FileText,
};

function getRelatedLink(relatedType?: string, relatedId?: number) {
  if (!relatedType || !relatedId) return null;
  const t = relatedType.toUpperCase();
  if (t === "LEAD") return `/crm/leads/${relatedId}`;
  if (t === "OPPORTUNITY") return `/crm/opportunities/${relatedId}`;
  if (t === "CONTACT") return `/crm/contacts/${relatedId}`;
  if (t === "ACCOUNT") return `/crm/accounts/${relatedId}`;
  return null;
}

export function ActivitiesListClient() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"ALL" | "ACTIVITIES" | "FOLLOWUPS" | "PENDING" | "TODAY" | "OVERDUE">("ALL");
  const [page, setPage] = React.useState(0);

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
      key: "related",
      header: "Related Record",
      render: (r) => {
        const link = getRelatedLink(r.relatedType, r.relatedId);
        if (!link) return <span className="text-muted-foreground">—</span>;
        return (
          <Link href={link} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            {r.relatedType} #{r.relatedId}
            <ArrowUpRight className="size-3" />
          </Link>
        );
      },
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
        const link = getRelatedLink(r.relatedType, r.relatedId);
        if (!link) return null;
        return (
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); router.push(link); }}>
            Open Lead / Deal
          </Button>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">CRM Engagements & Follow-ups</h1>
        <p className="text-sm text-muted-foreground">Unified 360° interaction hub for activities, follow-ups, and sales tasks.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground mr-2">
            <Filter className="size-4" /> Quick Filter:
          </span>
          <Button size="sm" variant={filter === "ALL" ? "default" : "outline"} onClick={() => { setFilter("ALL"); setPage(0); }}>
            All Engagements
          </Button>
          <Button size="sm" variant={filter === "FOLLOWUPS" ? "default" : "outline"} onClick={() => { setFilter("FOLLOWUPS"); setPage(0); }}>
            Follow-ups Only
          </Button>
          <Button size="sm" variant={filter === "ACTIVITIES" ? "default" : "outline"} onClick={() => { setFilter("ACTIVITIES"); setPage(0); }}>
            Activities Only
          </Button>
          <Button size="sm" variant={filter === "PENDING" ? "default" : "outline"} onClick={() => { setFilter("PENDING"); setPage(0); }}>
            Pending Follow-ups
          </Button>
          <Button size="sm" variant={filter === "TODAY" ? "default" : "outline"} onClick={() => { setFilter("TODAY"); setPage(0); }}>
            Today's Follow-ups
          </Button>
          <Button size="sm" variant={filter === "OVERDUE" ? "default" : "outline"} onClick={() => { setFilter("OVERDUE"); setPage(0); }}>
            Overdue
          </Button>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={combinedData}
        rowKey={(r) => r.id}
        isLoading={actQuery.isLoading || fuQuery.isLoading}
        emptyMessage="No CRM activities or follow-ups found."
        page={page}
        totalPages={actQuery.data?.totalPages || fuQuery.data?.totalPages}
        onPageChange={setPage}
        onRowClick={(r) => {
          const link = getRelatedLink(r.relatedType, r.relatedId);
          if (link) router.push(link);
        }}
      />
    </div>
  );
}
