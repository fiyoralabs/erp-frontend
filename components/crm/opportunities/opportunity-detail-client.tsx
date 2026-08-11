"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trophy, XCircle, FileText, Loader2, MoreVertical, DollarSign, Percent, TrendingUp, CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { Account, Opportunity, OpportunityProductLine, Pipeline, Quotation } from "@/lib/types/crm";
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
import { StatTile } from "@/components/crm/shared/stat-tile";
import { ScrollableTabsList } from "@/components/crm/shared/scrollable-tabs";

function errorMessage(err: unknown) {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function OpportunityDetailClient({ opportunityId }: { opportunityId: number }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [wonOpen, setWonOpen] = React.useState(false);
  const [lostOpen, setLostOpen] = React.useState(false);

  const opportunityQuery = useQuery({
    queryKey: ["crm", "opportunities", opportunityId],
    queryFn: () => apiClient.get<Opportunity>(`crm/opportunities/${opportunityId}`),
  });

  const accountQuery = useQuery({
    queryKey: ["crm", "accounts", opportunityQuery.data?.accountId],
    queryFn: () => apiClient.get<Account>(`crm/accounts/${opportunityQuery.data!.accountId}`),
    enabled: !!opportunityQuery.data,
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

  return (
    <div className="flex flex-col gap-4">
      <Button nativeButton={false} variant="ghost" size="sm" className="w-fit gap-1.5" render={<Link href="/crm/opportunities" />}>
        <ArrowLeft className="size-4" /> Back to Opportunities
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold sm:text-2xl">{opportunity.name}</h1>
                <OpportunityStatusBadge status={opportunity.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {opportunity.opportunityNumber} · {pipeline?.name ?? "Pipeline"} / {stage?.name ?? "Stage"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isOpen && (
                <>
                  {/* Informational/setup actions -- inline on sm+, collapsed below */}
                  <div className="hidden items-center gap-2 sm:flex">
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
                      <Pencil className="size-4" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5" disabled={createQuotationMutation.isPending} onClick={() => createQuotationMutation.mutate()}>
                      {createQuotationMutation.isPending ? <Loader2 className="animate-spin" /> : <FileText className="size-4" />}
                      Create Quotation
                    </Button>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="sm:hidden" aria-label="More actions" />}>
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => setEditOpen(true)} className="flex items-center gap-2">
                        <Pencil className="size-3.5" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={createQuotationMutation.isPending}
                        onClick={() => createQuotationMutation.mutate()}
                        className="flex items-center gap-2"
                      >
                        <FileText className="size-3.5" /> Create Quotation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* High-consequence actions stay full-weight, always visible */}
                  <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setLostOpen(true)}>
                    <XCircle className="size-4" /> Mark Lost
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => setWonOpen(true)}>
                    <Trophy className="size-4" /> Mark Won
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            <StatTile variant="inline" icon={DollarSign} label="Amount" value={formatCurrency(opportunity.amount)} />
            <StatTile variant="inline" icon={Percent} label="Probability" value={`${opportunity.probability}%`} />
            <StatTile variant="inline" icon={TrendingUp} label="Expected Revenue" value={formatCurrency(opportunity.expectedRevenue)} />
            <StatTile variant="inline" icon={CalendarClock} label="Expected Close" value={formatDate(opportunity.expectedCloseDate)} />
          </div>

          {opportunity.status === "LOST" && opportunity.lossReason && (
            <p className="border-t pt-4 text-sm text-destructive">Lost — reason: {opportunity.lossReason.replaceAll("_", " ")}{opportunity.competitor ? ` (competitor: ${opportunity.competitor})` : ""}</p>
          )}

          {quotationQuery.data && (
            <div className="border-t pt-4 text-sm">
              <span className="text-muted-foreground">Quotation: </span>
              <Link className="text-primary hover:underline" href={`/sales?quotation=${quotationQuery.data.id}`}>
                {quotationQuery.data.quotationNumber} ({quotationQuery.data.status}) — {formatCurrency(quotationQuery.data.totalAmount)}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

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
