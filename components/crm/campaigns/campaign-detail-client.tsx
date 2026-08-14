"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Users, Target, UserCheck, Percent, DollarSign, Trophy, Wallet, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { Campaign, CampaignStats } from "@/lib/types/crm";
import { CampaignDialog } from "@/components/crm/campaigns/campaign-dialog";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";
import { StatTile } from "@/components/shared/stat-tile";

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
          <StatTile icon={Users} label="Leads Generated" value={String(stats.leadsGenerated)} />
          <StatTile icon={Target} label="Opportunities" value={String(stats.opportunitiesGenerated)} />
          <StatTile icon={UserCheck} tone="success" label="Converted Customers" value={String(stats.convertedCustomers)} />
          <StatTile icon={Percent} label="Conversion Rate" value={`${stats.conversionRate.toFixed(1)}%`} />
          <StatTile icon={DollarSign} label="Pipeline Value" value={formatCurrency(stats.pipelineValue)} />
          <StatTile icon={Trophy} tone="success" label="Won Revenue" value={formatCurrency(stats.wonRevenue)} />
          <StatTile icon={Wallet} label="Budget" value={formatCurrency(campaign.budget)} />
          <StatTile icon={TrendingUp} tone={stats.roi !== null && stats.roi < 0 ? "danger" : "success"} label="ROI" value={stats.roi !== null ? `${stats.roi.toFixed(1)}%` : "—"} />
        </div>
      )}

      <CampaignDialog open={editOpen} onOpenChange={setEditOpen} campaign={campaign} />
    </div>
  );
}
