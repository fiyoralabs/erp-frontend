"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Phone, Mail, MessageSquare, Pencil, Handshake, Loader2, MoreVertical, DollarSign, Radio, Clock3, CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
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
import { StatTile } from "@/components/crm/shared/stat-tile";
import { ScrollableTabsList } from "@/components/crm/shared/scrollable-tabs";

const STATUS_OPTIONS = ["NEW", "CONTACTED", "ATTEMPTED_CONTACT", "INTERESTED", "QUALIFIED", "UNQUALIFIED", "NURTURING", "LOST"];

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

import { LeadPastInquiriesTab } from "@/components/crm/leads/lead-past-inquiries-tab";

// ...
export function LeadDetailClient({ leadId }: { leadId: number }) {
  const qc = useQueryClient();
  const [convertOpen, setConvertOpen] = React.useState(false);

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

  if (leadQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading lead...</p>;
  const lead = leadQuery.data;
  if (!lead) return <p className="text-sm text-destructive">Lead not found.</p>;

  const sourceName = lead.leadSourceId ? sourcesQuery.data?.find((s) => s.id === lead.leadSourceId)?.name : null;
  const isConverted = lead.status === "CONVERTED";

  return (
    <div className="flex flex-col gap-4">
      <Button nativeButton={false} variant="ghost" size="sm" className="w-fit gap-1.5" render={<Link href="/crm/leads" />}>
        <ArrowLeft className="size-4" /> Back to Leads
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold sm:text-2xl">{lead.fullName}</h1>
                <LeadStatusBadge status={lead.status} />
                <LeadRatingBadge rating={lead.rating} />
              </div>
              <p className="text-sm text-muted-foreground">
                {lead.leadNumber} {lead.companyName ? `· ${lead.companyName}` : ""} {lead.jobTitle ? `· ${lead.jobTitle}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden items-center gap-2 sm:flex">
                {lead.phone && (
                  <Button nativeButton={false} variant="ghost" size="sm" className="gap-1.5" render={<a href={`tel:${lead.phone}`} />}>
                    <Phone className="size-4" /> Call
                  </Button>
                )}
                {lead.email && (
                  <Button nativeButton={false} variant="ghost" size="sm" className="gap-1.5" render={<a href={`mailto:${lead.email}`} />}>
                    <Mail className="size-4" /> Email
                  </Button>
                )}
                {(lead.whatsappNumber || lead.phone) && (
                  <Button nativeButton={false} variant="ghost" size="sm" className="gap-1.5" render={<a href={`https://wa.me/${(lead.whatsappNumber || lead.phone)!.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" />}>
                    <MessageSquare className="size-4" /> WhatsApp
                  </Button>
                )}
                <Button nativeButton={false} variant="ghost" size="sm" className="gap-1.5" render={<Link href={`/crm/leads/${lead.id}/edit`} />}>
                  <Pencil className="size-4" /> Edit
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="sm:hidden" aria-label="More actions" />}>
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {lead.phone && (
                    <DropdownMenuItem render={<a href={`tel:${lead.phone}`} className="flex items-center gap-2" />}>
                      <Phone className="size-3.5" /> Call
                    </DropdownMenuItem>
                  )}
                  {lead.email && (
                    <DropdownMenuItem render={<a href={`mailto:${lead.email}`} className="flex items-center gap-2" />}>
                      <Mail className="size-3.5" /> Email
                    </DropdownMenuItem>
                  )}
                  {(lead.whatsappNumber || lead.phone) && (
                    <DropdownMenuItem render={<a href={`https://wa.me/${(lead.whatsappNumber || lead.phone)!.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2" />}>
                      <MessageSquare className="size-3.5" /> WhatsApp
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem render={<Link href={`/crm/leads/${lead.id}/edit`} className="flex items-center gap-2" />}>
                    <Pencil className="size-3.5" /> Edit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {!isConverted && (
                <Button size="sm" className="gap-1.5" onClick={() => setConvertOpen(true)}>
                  <Handshake className="size-4" /> Convert
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            <StatTile variant="inline" icon={DollarSign} label="Deal Value" value={formatCurrency(lead.estimatedDealValue)} />
            <StatTile variant="inline" icon={Radio} label="Source" value={sourceName ?? "—"} />
            <StatTile variant="inline" icon={Clock3} label="Last Contacted" value={formatDateTime(lead.lastContactedAt)} />
            <StatTile variant="inline" icon={CalendarClock} label="Next Follow-up" value={formatDateTime(lead.nextFollowUpAt)} />
          </div>

          {!isConverted && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <span className="text-sm text-muted-foreground">Change status:</span>
              <Select items={Object.fromEntries(STATUS_OPTIONS.map((s) => [s, s.replaceAll("_", " ")]))} value={lead.status} onValueChange={(v) => v && statusMutation.mutate(v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={recordContactMutation.isPending} onClick={() => recordContactMutation.mutate()}>
                {recordContactMutation.isPending && <Loader2 className="animate-spin" />}
                Mark Contacted
              </Button>
            </div>
          )}

          {isConverted && (
            <div className="flex flex-wrap gap-3 border-t pt-4 text-sm">
              <span className="text-muted-foreground">Converted {formatDateTime(lead.convertedAt)} →</span>
              {lead.convertedAccountId && <Link className="text-primary hover:underline" href={`/crm/accounts/${lead.convertedAccountId}`}>Account</Link>}
              {lead.convertedContactId && <Link className="text-primary hover:underline" href={`/crm/contacts/${lead.convertedContactId}`}>Contact</Link>}
              {lead.convertedOpportunityId && <Link className="text-primary hover:underline" href={`/crm/opportunities/${lead.convertedOpportunityId}`}>Opportunity</Link>}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <ScrollableTabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-max min-w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="past-inquiries">Past Inquiries</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </ScrollableTabsList>
        <TabsContent value="overview">
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
              <Field label="Email" value={lead.email} />
              <Field label="Alternate Email" value={lead.alternateEmail} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Alternate Phone" value={lead.alternatePhone} />
              <Field label="Website" value={lead.website} />
              <Field label="Industry" value={lead.industry} />
              <Field label="Business Type" value={lead.businessType} />
              <Field label="Employees" value={lead.numberOfEmployees ? String(lead.numberOfEmployees) : null} />
              <Field label="Estimated Revenue" value={lead.estimatedRevenue ? formatCurrency(lead.estimatedRevenue) : null} />
              <Field label="Address" value={[lead.address, lead.city, lead.state, lead.country, lead.postalCode].filter(Boolean).join(", ") || null} />
              <Field label="Expected Closing Date" value={lead.expectedClosingDate ? formatDate(lead.expectedClosingDate) : null} />
              <Field label="Created" value={formatDateTime(lead.createdAt)} />
              {lead.description && <div className="sm:col-span-2"><p className="text-muted-foreground text-sm">Description</p><p className="text-sm">{lead.description}</p></div>}
              {lead.notes && <div className="sm:col-span-2"><p className="text-muted-foreground text-sm">Notes</p><p className="text-sm">{lead.notes}</p></div>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="past-inquiries"><LeadPastInquiriesTab leadId={lead.id} /></TabsContent>
        <TabsContent value="activities"><ActivitiesTab relatedType="LEAD" relatedId={lead.id} /></TabsContent>
        <TabsContent value="tasks"><TasksTab relatedType="LEAD" relatedId={lead.id} /></TabsContent>
        <TabsContent value="follow-ups"><FollowUpsTab relatedType="LEAD" relatedId={lead.id} /></TabsContent>
        <TabsContent value="products"><LeadProductsTab leadId={lead.id} /></TabsContent>
        <TabsContent value="timeline"><Card><CardContent className="pt-6"><CrmTimeline relatedType="LEAD" relatedId={lead.id} /></CardContent></Card></TabsContent>
      </Tabs>

      <LeadConvertDialog open={convertOpen} onOpenChange={setConvertOpen} lead={lead} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}
