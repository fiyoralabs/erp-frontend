"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, MessageSquare, StickyNote, CalendarCheck, MapPin, FileText } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, type PagedResult } from "@/lib/api-client";
import type { Activity, ActivityType } from "@/lib/types/crm";
import { formatDateTime } from "@/components/crm/shared/format";

const TYPE_ICON: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  CALL: Phone, MEETING: CalendarCheck, EMAIL: Mail, WHATSAPP: MessageSquare, SMS: MessageSquare,
  NOTE: StickyNote, VISIT: MapPin, DEMO: FileText, PROPOSAL: FileText, OTHER: FileText,
};

export function ActivitiesListClient() {
  const [page, setPage] = React.useState(0);
  const [view, setView] = React.useState<"all" | "mine">("mine");

  const query = useQuery({
    queryKey: ["crm", "activities", "all", view, page],
    queryFn: () => apiClient.get<PagedResult<Activity>>(`crm/activities${view === "mine" ? "/mine" : ""}?page=${page}&size=20`),
  });

  const columns: DataTableColumn<Activity>[] = [
    { key: "type", header: "Type", render: (r) => {
      const Icon = TYPE_ICON[r.type];
      return <span className="flex items-center gap-1.5"><Icon className="size-4 text-muted-foreground" />{r.type}</span>;
    } },
    { key: "subject", header: "Subject", render: (r) => r.subject },
    { key: "related", header: "Related To", render: (r) => `${r.relatedType} #${r.relatedId}` },
    { key: "status", header: "Status", render: (r) => r.status },
    { key: "created", header: "Logged", render: (r) => formatDateTime(r.createdAt), hideOnCard: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Activities</h1>
        <p className="text-sm text-muted-foreground">Calls, meetings, notes and other logged interactions.</p>
      </div>
      <Tabs value={view} onValueChange={(v) => { setView(v as "all" | "mine"); setPage(0); }}>
        <TabsList>
          <TabsTrigger value="mine">My Activities</TabsTrigger>
          <TabsTrigger value="all">All Activities</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        columns={columns}
        data={query.data?.content ?? []}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        emptyMessage="No activities logged yet."
        page={page}
        totalPages={query.data?.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
