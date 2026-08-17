"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  Pencil,
  Trash2,
  Handshake,
  Loader2,
  MoreVertical,
  DollarSign,
  Radio,
  Clock3,
  CalendarClock,
  Building2,
  MapPin,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { Lead, LeadSource } from "@/lib/types/crm";
import { LeadRatingBadge, LeadStatusBadge } from "@/components/crm/shared/status-badges";
import { formatCurrency, formatDate, formatDateTime } from "@/components/crm/shared/format";
import { ActivitiesTab } from "@/components/crm/activities/activities-tab";
import { TasksTab } from "@/components/crm/tasks/tasks-tab";
import { FollowUpsTab } from "@/components/crm/shared/follow-ups-tab";
import { LeadProductsTab } from "@/components/crm/leads/lead-products-tab";
import { CrmTimeline } from "@/components/crm/shared/crm-timeline";
import { LeadConvertDialog } from "@/components/crm/leads/lead-convert-dialog";
import { StatTile } from "@/components/shared/stat-tile";
import { ScrollableTabsList } from "@/components/crm/shared/scrollable-tabs";
import { LeadPastInquiriesTab } from "@/components/crm/leads/lead-past-inquiries-tab";

const STATUS_OPTIONS = [
  "NEW",
  "CONTACTED",
  "ATTEMPTED_CONTACT",
  "INTERESTED",
  "QUALIFIED",
  "UNQUALIFIED",
  "NURTURING",
  "LOST",
];

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function LeadDetailClient({ leadId }: { leadId: number }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [convertOpen, setConvertOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const leadQuery = useQuery({
    queryKey: ["crm", "leads", leadId],
    queryFn: () => apiClient.get<Lead>(`crm/leads/${leadId}`),
  });

  const sourcesQuery = useQuery({
    queryKey: ["crm", "lead-sources"],
    queryFn: () => apiClient.get<LeadSource[]>("crm/settings/lead-sources"),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => apiClient.post<Lead>(`crm/leads/${leadId}/status`, { status }),
    onSuccess: () => {
      toast.success("Lead status updated.");
      qc.invalidateQueries({ queryKey: ["crm", "leads", leadId] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const recordContactMutation = useMutation({
    mutationFn: () => apiClient.post<Lead>(`crm/leads/${leadId}/record-contact`),
    onSuccess: () => {
      toast.success("Contact recorded.");
      qc.invalidateQueries({ queryKey: ["crm", "leads", leadId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`crm/leads/${leadId}`),
    onSuccess: () => {
      toast.success("Lead deleted");
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      router.push("/crm/leads");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (leadQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading lead...</p>;
  const lead = leadQuery.data;
  if (!lead) return <p className="text-sm text-destructive">Lead not found.</p>;

  const sourceName = lead.leadSourceId ? sourcesQuery.data?.find((s) => s.id === lead.leadSourceId)?.name : null;
  const isConverted = lead.status === "CONVERTED";
  const initials = `${lead.firstName?.[0] ?? ""}${lead.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-6xl mx-auto w-full pb-12 sm:pb-20">
      {/* Back Navigation */}
      <Button
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="w-fit gap-1.5 text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
        render={<Link href="/crm/leads" />}
      >
        <ArrowLeft className="h-4 w-4" /> Back to Leads
      </Button>

      {/* Hero Lead Card */}
      <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        <CardContent className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Title & Badges */}
            <div className="flex flex-col items-center text-center sm:flex-row sm:text-left sm:items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0f3d3e]/10 dark:bg-[#beebeb]/20 text-[#0f3d3e] dark:text-[#beebeb] flex items-center justify-center font-bold text-xl tracking-tight border border-primary/20 shrink-0 mx-auto sm:mx-0">
                {initials || "L"}
              </div>
              <div className="flex flex-col items-center sm:items-start space-y-1 min-w-0">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-heading text-center sm:text-left truncate">
                  {lead.fullName}
                </h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-2.5">
                  <LeadStatusBadge status={lead.status} />
                  <LeadRatingBadge rating={lead.rating} />
                </div>
                {/* Mobile-only stacked information: CRM ID, Company, Role */}
                <div className="flex flex-col items-center space-y-0.5 pt-0.5 sm:hidden">
                  <p className="text-xs font-mono font-medium text-foreground">{lead.leadNumber}</p>
                  {lead.companyName && <p className="text-xs font-medium text-muted-foreground">{lead.companyName}</p>}
                  {lead.jobTitle && <p className="text-xs text-muted-foreground">{lead.jobTitle}</p>}
                </div>
                {/* Desktop/Tablet-only horizontal subtitle */}
                <p className="hidden sm:flex text-xs md:text-sm text-muted-foreground flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono font-medium text-foreground">{lead.leadNumber}</span>
                  {lead.companyName && <span className="font-medium text-foreground">• {lead.companyName}</span>}
                  {lead.jobTitle && <span>• {lead.jobTitle}</span>}
                </p>
              </div>
            </div>

            {/* Quick Action Toolbar: Single row on mobile with Call, WhatsApp, Edit, More */}
            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              {lead.phone && (
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none rounded-xl h-9 gap-1 text-[11px] sm:text-xs font-semibold px-1.5 sm:px-3 justify-center min-w-0"
                  render={<a href={`tel:${lead.phone}`} />}
                >
                  <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate">Call</span>
                </Button>
              )}
              {(lead.whatsappNumber || lead.phone) && (
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none rounded-xl h-9 gap-1 text-[11px] sm:text-xs font-semibold px-1.5 sm:px-3 justify-center min-w-0"
                  render={
                    <a
                      href={`https://wa.me/${(lead.whatsappNumber || lead.phone)!.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate">WhatsApp</span>
                </Button>
              )}
              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none rounded-xl h-9 gap-1 text-[11px] sm:text-xs font-semibold px-1.5 sm:px-3 justify-center min-w-0"
                render={<Link href={`/crm/leads/${lead.id}/edit`} />}
              >
                <Pencil className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Edit</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      className="flex-1 sm:flex-none rounded-xl h-9 w-auto sm:w-9 shrink-0 justify-center min-w-0"
                      aria-label="More actions"
                    />
                  }
                >
                  <MoreVertical className="h-4 w-4 shrink-0" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {lead.email && (
                    <DropdownMenuItem render={<a href={`mailto:${lead.email}`} />}>
                      <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Email
                    </DropdownMenuItem>
                  )}
                  {!isConverted && (
                    <DropdownMenuItem onClick={() => setConvertOpen(true)}>
                      <Handshake className="h-3.5 w-3.5" /> Convert Lead
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Quick Metrics Tile Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2 border-t border-border/60">
            <StatTile
              variant="inline"
              icon={DollarSign}
              label="Deal Value"
              value={formatCurrency(lead.estimatedDealValue)}
              valueClassName="text-xs sm:text-xs"
            />
            <StatTile variant="inline" icon={Radio} label="Source" value={sourceName ?? "—"} valueClassName="text-xs sm:text-xs" />
            <StatTile variant="inline" icon={Clock3} label="Last Contacted" value={formatDateTime(lead.lastContactedAt)} valueClassName="text-xs sm:text-xs" />
            <StatTile
              variant="inline"
              icon={CalendarClock}
              label="Next Follow-up"
              value={formatDate(lead.nextPendingFollowUpDate)}
              valueClassName="text-xs sm:text-xs"
              tone={
                lead.nextPendingFollowUpDate &&
                new Date(lead.nextPendingFollowUpDate) < new Date(new Date().toDateString())
                  ? "danger"
                  : "default"
              }
            />
          </div>

          {/* Status Switcher & Contact Recorder */}
          {!isConverted && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-border/60">
              <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap shrink-0">Pipeline Status:</span>
                <Select
                  value={lead.status}
                  onValueChange={(v) => v && statusMutation.mutate(v)}
                >
                  <SelectTrigger className="flex-1 sm:w-44 sm:flex-none h-9 text-xs rounded-xl bg-background border-input font-medium min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-9 text-xs font-semibold w-full sm:w-auto justify-center"
                disabled={recordContactMutation.isPending}
                onClick={() => recordContactMutation.mutate()}
              >
                {recordContactMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Mark Contacted Today
              </Button>
            </div>
          )}

          {/* Converted Summary Banner */}
          {isConverted && (
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-900 dark:text-emerald-300">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Converted on {formatDateTime(lead.convertedAt)} →</span>
              {lead.convertedAccountId && (
                <Link
                  className="font-bold underline hover:text-emerald-700"
                  href={`/crm/accounts/${lead.convertedAccountId}`}
                >
                  Linked Account
                </Link>
              )}
              {lead.convertedContactId && (
                <Link
                  className="font-bold underline hover:text-emerald-700"
                  href={`/crm/contacts/${lead.convertedContactId}`}
                >
                  Linked Contact
                </Link>
              )}
              {lead.convertedOpportunityId && (
                <Link
                  className="font-bold underline hover:text-emerald-700"
                  href={`/crm/opportunities/${lead.convertedOpportunityId}`}
                >
                  Linked Deal
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="w-full space-y-4">
        <ScrollableTabsList className="inline-flex h-11 items-center justify-start rounded-2xl bg-muted/60 p-1 text-muted-foreground w-max min-w-full border border-border">
          <TabsTrigger value="overview" className="rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold">
            Overview
          </TabsTrigger>
          <TabsTrigger value="past-inquiries" className="rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold">
            Past Inquiries
          </TabsTrigger>
          <TabsTrigger value="activities" className="rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold">
            Activities
          </TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold">
            Tasks
          </TabsTrigger>
          <TabsTrigger value="follow-ups" className="rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold">
            Follow-ups
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold">
            Products
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold">
            Timeline
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="overview">
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 sm:gap-y-5 p-4 sm:p-6">
              <Field label="Email Address" value={lead.email} />
              <Field label="Alternate Email" value={lead.alternateEmail} />
              <Field label="Primary Phone" value={lead.phone} />
              <Field label="Alternate Phone" value={lead.alternatePhone} />
              <Field label="WhatsApp Number" value={lead.whatsappNumber} />
              <Field label="Website" value={lead.website} />
              <Field label="Industry" value={lead.industry} />
              <Field label="Business Type" value={lead.businessType} />
              <Field label="Employees" value={lead.numberOfEmployees ? String(lead.numberOfEmployees) : null} />
              <Field label="Estimated Revenue" value={lead.estimatedRevenue ? formatCurrency(lead.estimatedRevenue) : null} />
              <Field
                label="Address"
                value={[lead.address, lead.city, lead.state, lead.country, lead.postalCode].filter(Boolean).join(", ") || null}
              />
              <Field label="Expected Closing Date" value={lead.expectedClosingDate ? formatDate(lead.expectedClosingDate) : null} />
              <Field label="Created On" value={formatDateTime(lead.createdAt)} />

              {lead.description && (
                <div className="sm:col-span-2 border-t border-border/60 pt-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Requirement Summary &amp; Description
                  </p>
                  <div
                    className="text-xs sm:text-sm prose max-w-none dark:prose-invert break-words bg-muted/20 p-3 sm:p-4 rounded-xl border border-border overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: lead.description }}
                  />
                </div>
              )}

              {lead.notes && (
                <div className="sm:col-span-2 border-t border-border/60 pt-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Internal Notes</p>
                  <p className="text-xs sm:text-sm text-foreground bg-muted/20 p-3 sm:p-4 rounded-xl border border-border whitespace-pre-wrap break-words">
                    {lead.notes}
                  </p>
                </div>
              )}

              {(lead.customFields || (lead.description && lead.description.includes("--- Additional Details ---"))) && (
                <div className="sm:col-span-2 border-t border-border/60 pt-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Custom Properties &amp; Form Fields
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-3 sm:p-4 rounded-xl border border-border">
                    {(() => {
                      if (lead.customFields) {
                        try {
                          const parsed = JSON.parse(lead.customFields);
                          return Object.entries(parsed).map(([key, val]) => (
                            <div key={key} className="min-w-0">
                              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider break-words">
                                {key.replace(/_/g, " ")}
                              </p>
                              <p className="text-xs font-medium text-foreground break-words">{String(val)}</p>
                            </div>
                          ));
                        } catch {
                          return <p className="text-xs text-muted-foreground break-words">{lead.customFields}</p>;
                        }
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="past-inquiries">
          <LeadPastInquiriesTab leadId={lead.id} />
        </TabsContent>
        <TabsContent value="activities">
          <ActivitiesTab relatedType="LEAD" relatedId={lead.id} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab relatedType="LEAD" relatedId={lead.id} />
        </TabsContent>
        <TabsContent value="follow-ups">
          <FollowUpsTab relatedType="LEAD" relatedId={lead.id} />
        </TabsContent>
        <TabsContent value="products">
          <LeadProductsTab leadId={lead.id} />
        </TabsContent>
        <TabsContent value="timeline">
          <Card className="rounded-2xl border border-border bg-card shadow-xs">
            <CardContent className="p-4 sm:p-6">
              <CrmTimeline relatedType="LEAD" relatedId={lead.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LeadConvertDialog open={convertOpen} onOpenChange={setConvertOpen} lead={lead} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Lead?"
        description={`Are you sure you want to permanently delete "${lead.fullName}"? This action cannot be undone.`}
        confirmText="Delete Lead"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5 sm:space-y-1 min-w-0">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xs sm:text-sm font-medium text-foreground break-words">{value ?? "—"}</p>
    </div>
  );
}
