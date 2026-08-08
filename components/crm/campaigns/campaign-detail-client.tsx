"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { Campaign, CampaignStats } from "@/lib/types/crm";
import { CampaignDialog } from "@/components/crm/campaigns/campaign-dialog";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";

export function CampaignDetailClient({ campaignId }: { campaignId: number }) {
  const [editOpen, setEditOpen] = React.useState(false);

  const campaignQuery = useQuery({
    queryKey: ["crm", "campaigns", campaignId],
    queryFn: () => apiClient.get<Campaign>(`crm/campaigns/${campaignId}`),
  });

  const statsQuery = useQuery({
    queryKey: ["crm", "campaigns", campaignId, "stats"],
    queryFn: () => apiClient.get<CampaignStats>(`crm/campaigns/${campaignId}/stats`),
  });

  if (campaignQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading campaign...</p>;
  const campaign = campaignQuery.data;
  if (!campaign) return <p className="text-sm text-destructive">Campaign not found.</p>;
  const stats = statsQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <Button nativeButton={false} variant="ghost" size="sm" className="w-fit gap-1.5" render={<Link href="/crm/campaigns" />}>
        <ArrowLeft className="size-4" /> Back to Campaigns
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-xl font-semibold sm:text-2xl">{campaign.name}</h1>
              <p className="text-sm text-muted-foreground">{campaign.type.replaceAll("_", " ")} · {campaign.status} · {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit
            </Button>
          </div>
          {campaign.description && <p className="border-t pt-4 text-sm">{campaign.description}</p>}
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          <StatCard label="Leads Generated" value={String(stats.leadsGenerated)} />
          <StatCard label="Opportunities" value={String(stats.opportunitiesGenerated)} />
          <StatCard label="Converted Customers" value={String(stats.convertedCustomers)} />
          <StatCard label="Conversion Rate" value={`${stats.conversionRate.toFixed(1)}%`} />
          <StatCard label="Pipeline Value" value={formatCurrency(stats.pipelineValue)} />
          <StatCard label="Won Revenue" value={formatCurrency(stats.wonRevenue)} />
          <StatCard label="Budget" value={formatCurrency(campaign.budget)} />
          <StatCard label="ROI" value={stats.roi !== null ? `${stats.roi.toFixed(1)}%` : "—"} />
        </div>
      )}

      <CampaignDialog open={editOpen} onOpenChange={setEditOpen} campaign={campaign} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
