"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Phone, Mail, MessageSquare, StickyNote, CalendarCheck, MapPin, 
  FileText, Clock, CheckCircle2, AlertCircle, Plus, Search, 
  X, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, User,
  Calendar, Building, BarChart2
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient, type PagedResult } from "@/lib/api-client";
import { buildReturnTo } from "@/lib/return-to";
import type { Activity, ActivityType, FollowUp } from "@/lib/types/crm";
import { formatDateTime } from "@/components/crm/shared/format";
import { useUserNameLookup, useCrmUsers } from "@/components/crm/shared/user-select";
import { ActivityDialog } from "@/components/crm/activities/activity-dialog";
import { FollowUpCompleteDialog } from "@/components/crm/shared/follow-up-complete-dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone, MEETING: CalendarCheck, EMAIL: Mail, WHATSAPP: MessageSquare, SMS: MessageSquare,
  NOTE: StickyNote, VISIT: MapPin, DEMO: FileText, PROPOSAL: FileText, OTHER: FileText,
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "text-orange-600 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50",
  URGENT: "text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50",
  MEDIUM: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50",
  LOW: "text-slate-500 bg-slate-50 dark:bg-slate-955/20 border-slate-200 dark:border-slate-800",
};

function getRelatedLink(relatedType?: string, relatedId?: number, leadReturnTo?: string) {
  if (!relatedType || !relatedId) return null;
  const t = relatedType.toUpperCase();
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
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const usersQuery = useCrmUsers();

  const requestedView = searchParams.get("view");
  const filter: ActivityViewFilter =
    requestedView && VIEW_VALUES.has(requestedView as ActivityViewFilter)
      ? (requestedView as ActivityViewFilter)
      : "ALL";
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0);

  const search = searchParams.get("search") ?? "";
  const typeFilter = searchParams.get("type") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const assignedUserIdFilter = searchParams.get("assignedUserId") ?? "";
  const dateFilter = searchParams.get("date") ?? "";

  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [completingFollowUpId, setCompletingFollowUpId] = React.useState<number | null>(null);

  function updateParams(next: { 
    view?: ActivityViewFilter; 
    page?: number;
    search?: string;
    type?: string;
    status?: string;
    assignedUserId?: string;
    date?: string;
    clearAll?: boolean;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.clearAll) {
      params.delete("search");
      params.delete("type");
      params.delete("status");
      params.delete("assignedUserId");
      params.delete("date");
      params.delete("page");
    } else {
      if (next.view !== undefined) {
        if (next.view === "ALL") params.delete("view");
        else params.set("view", next.view);
        params.delete("page");
      }
      if (next.page !== undefined) {
        if (next.page === 0) params.delete("page");
        else params.set("page", String(next.page));
      }
      if (next.search !== undefined) {
        if (next.search === "") params.delete("search");
        else params.set("search", next.search);
        params.delete("page");
      }
      if (next.type !== undefined) {
        if (next.type === "" || next.type === "ALL") params.delete("type");
        else params.set("type", next.type);
        params.delete("page");
      }
      if (next.status !== undefined) {
        if (next.status === "" || next.status === "ALL") params.delete("status");
        else params.set("status", next.status);
        params.delete("page");
      }
      if (next.assignedUserId !== undefined) {
        if (next.assignedUserId === "" || next.assignedUserId === "ALL") params.delete("assignedUserId");
        else params.set("assignedUserId", next.assignedUserId);
        params.delete("page");
      }
      if (next.date !== undefined) {
        if (next.date === "") params.delete("date");
        else params.set("date", next.date);
        params.delete("page");
      }
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

  const completeActivityMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`crm/activities/${id}/complete`),
    onSuccess: () => {
      toast.success("Activity marked complete.");
      qc.invalidateQueries({ queryKey: ["crm", "activities", "all"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to complete activity");
    },
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
      priority?: string | null;
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
          priority: a.priority,
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
          priority: undefined,
        });
      });
    }

    return items.sort((a, b) => b.rawDate - a.rawDate);
  }, [actQuery.data, fuQuery.data, filter]);

  const filteredData = React.useMemo(() => {
    return combinedData.filter((item) => {
      if (search) {
        const s = search.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(s);
        const descMatch = item.description?.toLowerCase().includes(s);
        const leadMatch = item.leadName?.toLowerCase().includes(s);
        const compMatch = item.companyName?.toLowerCase().includes(s);
        if (!titleMatch && !descMatch && !leadMatch && !compMatch) return false;
      }
      if (typeFilter && typeFilter !== "ALL") {
        if (item.type !== typeFilter) return false;
      }
      if (statusFilter && statusFilter !== "ALL") {
        if (item.status !== statusFilter) return false;
      }
      if (assignedUserIdFilter && assignedUserIdFilter !== "ALL") {
        if (assignedUserIdFilter === "UNASSIGNED") {
          if (item.assignedUserId !== null && item.assignedUserId !== undefined) return false;
        } else if (String(item.assignedUserId) !== assignedUserIdFilter) {
          return false;
        }
      }
      if (dateFilter) {
        const itemDate = new Date(item.rawDate);
        const year = itemDate.getFullYear();
        const month = String(itemDate.getMonth() + 1).padStart(2, "0");
        const day = String(itemDate.getDate()).padStart(2, "0");
        const itemDateStr = `${year}-${month}-${day}`;
        if (itemDateStr !== dateFilter) return false;
      }
      return true;
    });
  }, [combinedData, search, typeFilter, statusFilter, assignedUserIdFilter, dateFilter]);

  const stats = React.useMemo(() => {
    let total = combinedData.length;
    let calls = 0;
    let meetings = 0;
    let tasks = 0;
    let overdue = 0;

    combinedData.forEach((item) => {
      if (item.type === "CALL") {
        calls++;
      } else if (item.type === "MEETING") {
        meetings++;
      } else {
        tasks++;
      }

      if (item.status === "OVERDUE") {
        overdue++;
      } else if (item.kind === "FOLLOWUP" && item.status === "PENDING") {
        const isPast = item.rawDate < Date.now();
        if (isPast) overdue++;
      }
    });

    return { total, calls, meetings, tasks, overdue };
  }, [combinedData]);

  const userNameById = useUserNameLookup();

  const typeSelectItems = React.useMemo(() => ({
    ALL: "All Types",
    CALL: "Call",
    MEETING: "Meeting",
    EMAIL: "Email",
    WHATSAPP: "WhatsApp",
    SMS: "SMS",
    NOTE: "Note",
    VISIT: "Visit",
    DEMO: "Demo",
    PROPOSAL: "Proposal",
    OTHER: "Other"
  }), []);

  const statusSelectItems = React.useMemo(() => ({
    ALL: "All Statuses",
    PENDING: "Pending",
    PLANNED: "Planned",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled"
  }), []);

  const assignedUserSelectItems = React.useMemo(() => {
    const map: Record<string, string> = { ALL: "All Assignees", UNASSIGNED: "Unassigned" };
    (usersQuery.data ?? []).forEach((u) => { map[String(u.id)] = u.fullName; });
    return map;
  }, [usersQuery.data]);

  const totalPages = Math.max(actQuery.data?.totalPages ?? 0, fuQuery.data?.totalPages ?? 0);
  const totalElements = (actQuery.data?.totalElements ?? 0) + (fuQuery.data?.totalElements ?? 0);

  // Original columns configuration (preserved for mobile DataTable)
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
    <div className="flex flex-col gap-5">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] dark:text-white">Activities</h1>
          <p className="text-sm text-[#545f73] dark:text-[#a3cfcf] mt-1">Manage calls, meetings, tasks and other CRM activities</p>
        </div>
        <div className="hidden md:inline-flex">
          <Button
            onClick={() => setAddDialogOpen(true)}
            className="h-10 bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90 dark:bg-[#beebeb] dark:text-[#002020] dark:hover:bg-[#beebeb]/90"
          >
            <Plus className="mr-1.5 size-4" /> Add Activity
          </Button>
        </div>
      </div>

      {/* SUMMARY SECTION (Desktop Only) */}
      <div className="hidden md:grid grid-cols-5 gap-4">
        {[
          { label: "Total Activities", value: stats.total, icon: BarChart2, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
          { label: "Calls Logged", value: stats.calls, icon: Phone, color: "text-[#0F3D3E] bg-[#0F3D3E]/5 dark:bg-[#a3cfcf]/10" },
          { label: "Meetings Scheduled", value: stats.meetings, icon: CalendarCheck, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Tasks & Notes", value: stats.tasks, icon: StickyNote, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
          { label: "Overdue Items", value: stats.overdue, icon: AlertCircle, color: "text-rose-600 bg-rose-50 dark:bg-rose-900/20" }
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-4">
              <div className={`p-2.5 rounded-lg shrink-0 ${c.color}`}>
                <Icon className="size-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{c.label}</span>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{c.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* FILTER / SEARCH TOOLBAR (Desktop Only) */}
      <div className="hidden md:flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Search Activities..."
            className="pl-9 h-9 rounded-lg border-slate-200"
            value={search}
            onChange={(e) => updateParams({ search: e.target.value })}
          />
        </div>
        
        <Select items={typeSelectItems} value={typeFilter || "ALL"} onValueChange={(v) => updateParams({ type: v ?? undefined })}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Activity Type" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(typeSelectItems).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select items={statusSelectItems} value={statusFilter || "ALL"} onValueChange={(v) => updateParams({ status: v ?? undefined })}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusSelectItems).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select items={assignedUserSelectItems} value={assignedUserIdFilter || "ALL"} onValueChange={(v) => updateParams({ assignedUserId: v ?? undefined })}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Assigned To" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(assignedUserSelectItems).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-[150px] h-9 rounded-lg border-slate-200"
          value={dateFilter}
          onChange={(e) => updateParams({ date: e.target.value })}
        />

        {(search || typeFilter || statusFilter || assignedUserIdFilter || dateFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateParams({ clearAll: true })}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-9 px-3"
          >
            <X className="mr-1.5 size-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* VIEW TABS (Desktop Only) */}
      <div className="hidden md:block">
        <Tabs value={filter} onValueChange={(v) => updateParams({ view: v as ActivityViewFilter })} className="w-full">
          <div className="overflow-x-auto scrollbar-none pb-1">
            <TabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-max min-w-full">
              {VIEWS.map((v) => <TabsTrigger key={v.value} value={v.value}>{v.label}</TabsTrigger>)}
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* Mobile view select dropdown - UNTOUCHED (md:hidden) */}
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

      {/* ACTIVITY CONTENT (Desktop Redesigned Table - auto-fit, no scrollbars) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl md:overflow-x-visible shadow-xs">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
              <TableHead className="w-[20%] pl-3 font-bold text-slate-700 dark:text-slate-300 text-xs py-2">Activity</TableHead>
              <TableHead className="w-[8%] font-bold text-slate-700 dark:text-slate-300 text-xs py-2">Type</TableHead>
              <TableHead className="w-[15%] font-bold text-slate-700 dark:text-slate-300 text-xs py-2">Company</TableHead>
              <TableHead className="w-[12%] font-bold text-slate-700 dark:text-slate-300 text-xs py-2">Contact</TableHead>
              <TableHead className="w-[14%] font-bold text-slate-700 dark:text-slate-300 text-xs py-2">Assigned To</TableHead>
              <TableHead className="w-[12%] font-bold text-slate-700 dark:text-slate-300 text-xs py-2">Date</TableHead>
              <TableHead className="w-[8%] font-bold text-slate-700 dark:text-slate-300 text-xs py-2">Priority</TableHead>
              <TableHead className="w-[9%] font-bold text-slate-700 dark:text-slate-300 text-xs py-2">Status</TableHead>
              <TableHead className="w-[2%] pr-3 text-right font-bold text-slate-700 dark:text-slate-300 text-xs py-2"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actQuery.isLoading || fuQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-slate-100 dark:border-slate-800">
                  <TableCell className="pl-3 py-2"><div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                  <TableCell className="py-2"><div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                  <TableCell className="py-2"><div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                  <TableCell className="py-2"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                  <TableCell className="py-2"><div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                  <TableCell className="py-2"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                  <TableCell className="py-2"><div className="h-5 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                  <TableCell className="py-2"><div className="h-6 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                  <TableCell className="pr-3 py-2"><div className="h-6 w-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-36 text-center py-6">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No activities found</p>
                    <p className="text-xs text-slate-500 max-w-sm">Try adjusting your filters or log a new CRM activity.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((r) => {
                const Icon = TYPE_ICON[r.type] || Clock;
                const link = getRelatedLink(r.relatedType, r.relatedId, returnTo);
                const assignedName = r.assignedUserId ? userNameById.get(r.assignedUserId) ?? `User #${r.assignedUserId}` : "Unassigned";
                const initials = assignedName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-850"
                    onClick={() => {
                      if (link) router.push(link);
                    }}
                  >
                    {/* Activity Column (Includes Category & Title/Description stacked) */}
                    <TableCell className="pl-3 py-1.5 align-middle">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Badge variant={r.kind === "FOLLOWUP" ? "secondary" : "outline"} className={cn("text-[9px] font-bold py-0 px-1 rounded-xs shrink-0 pointer-events-none select-none", r.kind === "FOLLOWUP" ? "bg-blue-500/10 text-blue-600 border-blue-200" : "bg-[#0F3D3E]/10 text-[#0F3D3E] border-[#0F3D3E]/20")}>
                            {r.kind === "FOLLOWUP" ? "Followup" : "Activity"}
                          </Badge>
                          <span title={r.title} className="font-semibold text-slate-950 dark:text-white text-xs truncate block">
                            {r.title}
                          </span>
                        </div>
                        {r.description && (
                          <p title={r.description} className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                            {r.description}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Type Column */}
                    <TableCell className="px-2 py-1.5 align-middle">
                      <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 text-xs">
                        <Icon className="size-3.5 text-slate-400 shrink-0" />
                        <span className="uppercase tracking-wider font-semibold text-[10px]">{r.type}</span>
                      </span>
                    </TableCell>

                    {/* Company Column */}
                    <TableCell className="px-2 py-1.5 align-middle">
                      {r.companyName ? (
                        <span title={r.companyName} className="font-medium text-slate-900 dark:text-slate-100 text-xs truncate block">
                          {r.companyName}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Contact/Lead Column */}
                    <TableCell className="px-2 py-1.5 align-middle" onClick={(e) => e.stopPropagation()}>
                      {link ? (
                        <button
                          onClick={() => router.push(link)}
                          className="flex flex-col items-start gap-0 hover:underline text-left min-w-0"
                        >
                          <span className="text-[9px] font-bold text-[#0F3D3E] dark:text-[#a3cfcf] uppercase tracking-wider leading-none">{r.relatedType}</span>
                          <span title={r.leadName || `ID: ${r.relatedId}`} className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block w-full">{r.leadName || `ID: ${r.relatedId}`}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Assigned To Column */}
                    <TableCell className="px-2 py-1.5 align-middle">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="flex size-5.5 items-center justify-center rounded-full bg-[#0F3D3E]/10 text-[#0F3D3E] text-[9px] font-bold shrink-0 border border-[#0F3D3E]/20">
                          {r.assignedUserId ? initials : "?"}
                        </div>
                        <span title={assignedName} className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate block">
                          {assignedName}
                        </span>
                      </div>
                    </TableCell>

                    {/* Date Column */}
                    <TableCell className="px-2 py-1.5 align-middle">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{r.dateStr}</span>
                    </TableCell>

                    {/* Priority Column */}
                    <TableCell className="px-2 py-1.5 align-middle">
                      {r.priority ? (
                        <Badge variant="outline" className={cn("text-[9px] font-extrabold py-0 px-1.5 rounded-sm capitalize pointer-events-none select-none", PRIORITY_COLORS[r.priority] || "text-slate-500 bg-slate-50 border-slate-200")}>
                          {r.priority.toLowerCase()}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Status Column */}
                    <TableCell className="px-2 py-1.5 align-middle">
                      {r.status === "COMPLETED" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800 gap-1 rounded-sm py-0 px-1 text-[10px] pointer-events-none select-none">
                          <CheckCircle2 className="size-2.5 shrink-0" /> Completed
                        </Badge>
                      ) : r.status === "PENDING" || r.status === "PLANNED" ? (
                        <Badge className="bg-amber-500/10 text-amber-600 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-800 gap-1 rounded-sm py-0 px-1 text-[10px] pointer-events-none select-none">
                          <AlertCircle className="size-2.5 shrink-0" /> {r.status === "PENDING" ? "Pending" : "Planned"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-600 dark:text-slate-400 rounded-sm py-0 px-1 text-[10px] pointer-events-none select-none">
                          {r.status}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions Column */}
                    <TableCell className="pr-3 py-1.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button variant="ghost" size="icon" className="size-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="More actions">
                            <MoreHorizontal className="size-3.5 text-slate-500" />
                          </Button>
                        } />
                        <DropdownMenuContent align="end">
                          {link && (
                            <DropdownMenuItem onClick={() => router.push(link)}>
                              View Related Record
                            </DropdownMenuItem>
                          )}
                          {r.status !== "COMPLETED" && (
                            <DropdownMenuItem
                              onClick={() => {
                                if (r.kind === "FOLLOWUP") {
                                  setCompletingFollowUpId(r.originalId);
                                } else {
                                  completeActivityMutation.mutate(r.originalId);
                                }
                              }}
                            >
                              Mark Completed
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Desktop Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing page <strong className="text-slate-900 dark:text-white font-semibold">{page + 1}</strong> of <strong className="text-slate-900 dark:text-white font-semibold">{totalPages}</strong> (Total <strong className="text-slate-900 dark:text-white font-semibold">{totalElements}</strong> items)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-9"
                disabled={page === 0}
                onClick={() => updateParams({ page: page - 1 })}
              >
                <ChevronLeft className="mr-1.5 size-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-9"
                disabled={page + 1 >= totalPages}
                onClick={() => updateParams({ page: page + 1 })}
              >
                Next <ChevronRight className="ml-1.5 size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE / TABLET VIEW (DataTable rendered untouched, md:hidden) */}
      <div className="md:hidden">
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

      {/* Modals & Dialogs */}
      <ActivityDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      {completingFollowUpId !== null && (
        <FollowUpCompleteDialog
          open={completingFollowUpId !== null}
          onOpenChange={(o) => !o && setCompletingFollowUpId(null)}
          followUpId={completingFollowUpId}
          invalidateKey={["crm", "follow-ups"]}
        />
      )}
    </div>
  );
}
