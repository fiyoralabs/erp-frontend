"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trophy, XCircle, FileText, Loader2, MoreVertical, DollarSign, Percent, TrendingUp, CalendarClock } from "lucide-react";

import { resolveReturnTo } from "@/lib/return-to";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { Account, Opportunity, OpportunityProductLine, Pipeline, Quotation, Contact } from "@/lib/types/crm";
import { OpportunityStatusBadge } from "@/components/crm/shared/status-badges";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";
import { OpportunityDialog } from "@/components/crm/opportunities/opportunity-dialog";
import { OpportunityWonDialog } from "@/components/crm/opportunities/opportunity-won-dialog";
import { OpportunityLostDialog } from "@/components/crm/opportunities/opportunity-lost-dialog";
import { OpportunityProductsTab } from "@/components/crm/opportunities/opportunity-products-tab";
import { ActivitiesTab } from "@/components/crm/activities/activities-tab";
import { TasksTab } from "@/components/crm/tasks/tasks-tab";
import { FollowUpsTab } from "@/components/crm/shared/follow-ups-tab";
import { CrmTimeline } from "@/components/crm/shared/crm-timeline";
import { ScrollableTabsList } from "@/components/crm/shared/scrollable-tabs";
import { useUserNameLookup } from "@/components/crm/shared/user-select";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function OpportunityDetailClient({ opportunityId }: { opportunityId: number }) {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editOpen, setEditOpen] = React.useState(false);
  const [wonOpen, setWonOpen] = React.useState(false);
  const [lostOpen, setLostOpen] = React.useState(false);
  const userNameById = useUserNameLookup();

  const opportunityQuery = useQuery({
    queryKey: ["crm", "opportunities", opportunityId],
    queryFn: () => apiClient.get<Opportunity>(`crm/opportunities/${opportunityId}`),
  });

  const accountQuery = useQuery({
    queryKey: ["crm", "accounts", opportunityQuery.data?.accountId],
    queryFn: () => apiClient.get<Account>(`crm/accounts/${opportunityQuery.data!.accountId}`),
    enabled: !!opportunityQuery.data,
  });

  const contactQuery = useQuery({
    queryKey: ["crm", "contacts", opportunityQuery.data?.primaryContactId],
    queryFn: () => apiClient.get<Contact>(`crm/contacts/${opportunityQuery.data!.primaryContactId}`),
    enabled: !!opportunityQuery.data?.primaryContactId,
  });

  const pipelinesQuery = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => apiClient.get<Pipeline[]>("crm/pipelines"),
  });

  const quotationQuery = useQuery({
    queryKey: ["crm", "quotation", "by-opportunity", opportunityId],
    queryFn: async () => {
      try {
        return await apiClient.get<Quotation>(`sales/quotations/by-opportunity/${opportunityId}`);
      } catch {
        return null;
      }
    },
  });

  const createQuotationMutation = useMutation({
    mutationFn: async () => {
      const opp = opportunityQuery.data!;
      const customerId = accountQuery.data?.customerId;
      if (!customerId) {
        throw new Error("Link this Account to an ERP Customer first (see the Account page) before creating a quotation.");
      }
      const products = await apiClient.get<OpportunityProductLine[]>(`crm/opportunities/${opp.id}/products`);
      if (products.length === 0) {
        throw new Error("Add at least one product to this opportunity before creating a quotation.");
      }
      const quotation = await apiClient.post<Quotation>("sales/quotations", {
        customerId,
        locationId: opp.locationId,
        opportunityId: opp.id,
        quotationDate: new Date().toISOString().slice(0, 10),
        items: products.map((p) => ({
          productId: p.productId,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          discountAmount: p.discount,
          taxPercentage: 0,
        })),
      });
      await apiClient.post(`crm/opportunities/${opp.id}/quotation`, { quotationId: quotation.id });
      return quotation;
    },
    onSuccess: () => {
      toast.success("Quotation created and linked to this opportunity.");
      qc.invalidateQueries({ queryKey: ["crm", "quotation", "by-opportunity", opportunityId] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (opportunityQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading opportunity...</p>;
  const opportunity = opportunityQuery.data;
  if (!opportunity) return <p className="text-sm text-destructive">Opportunity not found.</p>;

  const pipeline = pipelinesQuery.data?.find((p) => p.id === opportunity.pipelineId);
  const stage = pipeline?.stages.find((s) => s.id === opportunity.stageId);
  const isOpen = opportunity.status === "OPEN";

  const salespersonName = opportunity.assignedUserId ? (userNameById.get(opportunity.assignedUserId) ?? `User #${opportunity.assignedUserId}`) : "Unassigned";

  return (
    <div className="flex flex-col gap-3">
      {/* Back button */}
      <Button 
        variant="ghost" 
        size="sm" 
        className="w-fit gap-1 text-[11px] h-7 px-2" 
        onClick={() => router.push(resolveReturnTo(searchParams, "/crm/opportunities"))}
      >
        <ArrowLeft className="size-3.5" /> Back to Opportunities
      </Button>

      {/* Header section */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{opportunity.name}</h1>
            <OpportunityStatusBadge status={opportunity.status} />
          </div>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            Deal: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{opportunity.opportunityNumber}</strong> · {pipeline?.name ?? "Pipeline"} / {stage?.name ?? "Stage"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {isOpen && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
              <div className="hidden sm:inline-flex">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs gap-1" 
                  disabled={createQuotationMutation.isPending} 
                  onClick={() => createQuotationMutation.mutate()}
                >
                  {createQuotationMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
                  Create Quotation
                </Button>
              </div>
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="outline" size="icon" className="size-8 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="More actions">
                      <MoreVertical className="size-3.5" />
                    </Button>
                  } />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={createQuotationMutation.isPending}
                      onClick={() => createQuotationMutation.mutate()}
                      className="flex items-center gap-1.5"
                    >
                      <FileText className="size-3.5" /> Create Quotation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Button variant="destructive" size="sm" className="h-8 text-xs gap-1" onClick={() => setLostOpen(true)}>
                <XCircle className="size-3.5" /> Mark Lost
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1 bg-[#0F3D3E] text-white hover:bg-[#0F3D3E]/90 dark:bg-[#beebeb] dark:text-[#002020] dark:hover:bg-[#beebeb]/90" onClick={() => setWonOpen(true)}>
                <Trophy className="size-3.5" /> Mark Won
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Key Stats Card */}
      <Card className="shadow-xs border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="p-1.5 bg-[#0F3D3E]/5 dark:bg-[#beebeb]/10 text-[#0F3D3E] dark:text-[#beebeb] rounded-md shrink-0">
                <DollarSign className="size-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Amount</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5 block">{formatCurrency(opportunity.amount)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-md shrink-0">
                <Percent className="size-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Probability</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5 block">{opportunity.probability}%</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-md shrink-0">
                <TrendingUp className="size-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Expected Revenue</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5 block">{formatCurrency(opportunity.expectedRevenue)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="p-1.5 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-md shrink-0">
                <CalendarClock className="size-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Expected Close</span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5 block">{formatDate(opportunity.expectedCloseDate)}</span>
              </div>
            </div>
          </div>

          {opportunity.status === "LOST" && opportunity.lossReason && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center gap-2 text-xs text-rose-600 font-semibold">
              <XCircle className="size-4 shrink-0" />
              <span>Lost — reason: {opportunity.lossReason.replaceAll("_", " ")}{opportunity.competitor ? ` (competitor: ${opportunity.competitor})` : ""}</span>
            </div>
          )}

          {quotationQuery.data && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 text-xs flex items-center gap-1.5">
              <FileText className="size-4 text-slate-400 shrink-0" />
              <span className="text-slate-500">Linked Quotation: </span>
              <Link className="text-[#0F3D3E] dark:text-[#a3cfcf] font-semibold hover:underline" href={`/sales?quotation=${quotationQuery.data.id}`}>
                {quotationQuery.data.quotationNumber} ({quotationQuery.data.status}) — {formatCurrency(quotationQuery.data.totalAmount)}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid containing Details Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Details Card */}
        <Card className="lg:col-span-2 shadow-xs border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <CardContent className="p-4 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-3">Opportunity Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Opportunity Name</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block truncate" title={opportunity.name}>{opportunity.name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Deal Number</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{opportunity.opportunityNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Status</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{opportunity.status}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Account / Company</span>
                  {accountQuery.isLoading ? (
                    <span className="text-xs text-slate-450 animate-pulse">Loading Account...</span>
                  ) : accountQuery.data ? (
                    <Link href={`/crm/accounts/${opportunity.accountId}`} className="text-[#0F3D3E] dark:text-[#a3cfcf] text-xs font-semibold hover:underline mt-0.5 block truncate" title={accountQuery.data.name}>
                      {accountQuery.data.name}
                    </Link>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-600 text-xs mt-0.5 block">—</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Primary Contact</span>
                  {opportunity.primaryContactId ? (
                    contactQuery.isLoading ? (
                      <span className="text-xs text-slate-450 animate-pulse">Loading Contact...</span>
                    ) : contactQuery.data ? (
                      <Link href={`/crm/contacts/${opportunity.primaryContactId}`} className="text-[#0F3D3E] dark:text-[#a3cfcf] text-xs font-semibold hover:underline mt-0.5 block truncate" title={`${contactQuery.data.firstName} ${contactQuery.data.lastName || ""}`}>
                        {contactQuery.data.firstName} {contactQuery.data.lastName || ""}
                      </Link>
                    ) : (
                      <span className="text-slate-450 dark:text-slate-600 text-xs mt-0.5 block">Contact ID: {opportunity.primaryContactId}</span>
                    )
                  ) : (
                    <span className="text-slate-400 dark:text-slate-600 text-xs mt-0.5 block">—</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Assigned Owner</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{salespersonName}</span>
                </div>
              </div>
            </div>

            {opportunity.description && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Description</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line leading-relaxed max-w-full overflow-wrap-break-word">
                  {opportunity.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales & Pipeline Details Card */}
        <Card className="shadow-xs border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <CardContent className="p-4 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-3">Sales Information</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Pipeline</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{pipeline?.name ?? "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Current Stage</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{stage?.name ?? "—"}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Lead Source ID</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block">{opportunity.leadSourceId ? String(opportunity.leadSourceId) : "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Competitor</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-105 mt-0.5 block truncate" title={opportunity.competitor ?? ""}>{opportunity.competitor ?? "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Related Sections */}
      <Tabs defaultValue="products" className="w-full">
        <ScrollableTabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-max min-w-full">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </ScrollableTabsList>
        <TabsContent value="products"><OpportunityProductsTab opportunityId={opportunity.id} /></TabsContent>
        <TabsContent value="activities"><ActivitiesTab relatedType="OPPORTUNITY" relatedId={opportunity.id} /></TabsContent>
        <TabsContent value="tasks"><TasksTab relatedType="OPPORTUNITY" relatedId={opportunity.id} /></TabsContent>
        <TabsContent value="follow-ups"><FollowUpsTab relatedType="OPPORTUNITY" relatedId={opportunity.id} /></TabsContent>
        <TabsContent value="timeline"><Card><CardContent className="pt-6"><CrmTimeline relatedType="OPPORTUNITY" relatedId={opportunity.id} /></CardContent></Card></TabsContent>
      </Tabs>

      <OpportunityDialog open={editOpen} onOpenChange={setEditOpen} opportunity={opportunity} />
      <OpportunityWonDialog open={wonOpen} onOpenChange={setWonOpen} opportunity={opportunity} />
      <OpportunityLostDialog open={lostOpen} onOpenChange={setLostOpen} opportunity={opportunity} />
    </div>
  );
}
