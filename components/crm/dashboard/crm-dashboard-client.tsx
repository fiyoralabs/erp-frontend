"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import {
  Users, UserPlus, UserCheck, CheckCircle2, Target, Trophy, XCircle, DollarSign,
  Scale, Percent, ListChecks, AlertTriangle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { CrmDashboard, Lead, LeadSource, Opportunity, Pipeline } from "@/lib/types/crm";
import { LeadStatusBadge, OpportunityStatusBadge } from "@/components/crm/shared/status-badges";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";
import { CATEGORICAL_COLORS, STATUS_CRITICAL, STATUS_GOOD, SEQUENTIAL_BLUE } from "@/components/crm/shared/chart-colors";
import { StatTile } from "@/components/crm/shared/stat-tile";

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-64 overflow-x-auto">
        <div className="h-full min-w-72">{children}</div>
      </CardContent>
    </Card>
  );
}

const tooltipStyle = { fontSize: 12, borderRadius: 8 };

export function CrmDashboardClient() {
  const dashboardQuery = useQuery({
    queryKey: ["crm", "dashboard"],
    queryFn: () => apiClient.get<CrmDashboard>("crm/dashboard"),
  });
  const sourcesQuery = useQuery({ queryKey: ["crm", "lead-sources"], queryFn: () => apiClient.get<LeadSource[]>("crm/settings/lead-sources") });
  const pipelinesQuery = useQuery({ queryKey: ["crm", "pipelines"], queryFn: () => apiClient.get<Pipeline[]>("crm/pipelines") });

  if (dashboardQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading dashboard...</p>;
  const data = dashboardQuery.data;
  if (!data) return <p className="text-sm text-destructive">Unable to load the CRM dashboard.</p>;

  const noData = data.totalLeads === 0 && data.openOpportunities === 0 && data.wonOpportunities === 0 && data.lostOpportunities === 0;

  const stageNameById = new Map<number, string>();
  (pipelinesQuery.data ?? []).forEach((p) => p.stages.forEach((s) => stageNameById.set(s.id, s.name)));
  const sourceNameById = new Map<number, string>();
  (sourcesQuery.data ?? []).forEach((s) => sourceNameById.set(s.id, s.name));

  const statusData = Object.entries(data.leadsByStatus).map(([status, count]) => ({ name: status.replaceAll("_", " "), value: count }));
  const sourceData = Object.entries(data.leadsBySource).map(([id, count]) => ({ name: sourceNameById.get(Number(id)) ?? `Source #${id}`, value: count }));
  const stageData = data.opportunitiesByStage.map((s) => ({ name: stageNameById.get(s.stageId) ?? `Stage #${s.stageId}`, value: s.amount, count: s.count }));
  const wonLostData = [
    { name: "Won", value: data.wonOpportunities },
    { name: "Lost", value: data.lostOpportunities },
  ];
  const monthlyData = data.wonRevenueByMonth.map((m) => ({ name: m.month, value: m.amount }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">CRM Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your sales pipeline at a glance.</p>
      </div>

      {noData ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No CRM data yet.</p>
            <p className="text-sm text-muted-foreground">Create your first lead to start building your sales pipeline.</p>
            <Link href="/crm/leads/new" className="text-sm text-primary hover:underline">Create a Lead</Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            <StatTile icon={Users} label="Total Leads" value={String(data.totalLeads)} />
            <StatTile icon={UserPlus} label="New Leads" value={String(data.newLeads)} />
            <StatTile icon={UserCheck} label="Qualified Leads" value={String(data.qualifiedLeads)} />
            <StatTile icon={CheckCircle2} tone="success" label="Converted Leads" value={String(data.convertedLeads)} />
            <StatTile icon={Target} label="Open Opportunities" value={String(data.openOpportunities)} />
            <StatTile icon={Trophy} tone="success" label="Won Opportunities" value={String(data.wonOpportunities)} />
            <StatTile icon={XCircle} tone="danger" label="Lost Opportunities" value={String(data.lostOpportunities)} />
            <StatTile icon={DollarSign} label="Pipeline Value" value={formatCurrency(data.pipelineValue)} />
            <StatTile icon={Scale} label="Weighted Pipeline" value={formatCurrency(data.weightedPipelineValue)} />
            <StatTile icon={Percent} label="Conversion Rate" value={`${data.conversionRate.toFixed(1)}%`} />
            <StatTile icon={ListChecks} tone={data.tasksDueToday > 0 ? "warning" : "default"} label="Tasks Due Today" value={String(data.tasksDueToday)} />
            <StatTile icon={AlertTriangle} tone={data.overdueFollowUps > 0 ? "danger" : "default"} label="Overdue Follow-ups" value={String(data.overdueFollowUps)} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Leads by Status">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {statusData.map((_, i) => <Cell key={i} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Leads by Source">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill={SEQUENTIAL_BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Open Pipeline Value by Stage">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} width={70} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="value" fill={SEQUENTIAL_BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Won vs Lost Deals">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wonLostData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    <Cell fill={STATUS_GOOD} />
                    <Cell fill={STATUS_CRITICAL} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Won Revenue by Month">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} width={70} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                  <Line type="monotone" dataKey="value" stroke={SEQUENTIAL_BLUE} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Recent Leads</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                {data.recentLeads.length === 0 && <p className="text-sm text-muted-foreground">No leads yet.</p>}
                {data.recentLeads.map((lead: Lead) => (
                  <div key={lead.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/crm/leads/${lead.id}`} className="text-primary hover:underline">{lead.fullName}</Link>
                    <LeadStatusBadge status={lead.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Recent Opportunities</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                {data.recentOpportunities.length === 0 && <p className="text-sm text-muted-foreground">No opportunities yet.</p>}
                {data.recentOpportunities.map((opp: Opportunity) => (
                  <div key={opp.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/crm/opportunities/${opp.id}`} className="text-primary hover:underline">{opp.name}</Link>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{formatCurrency(opp.amount)}</span>
                      <OpportunityStatusBadge status={opp.status} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">As of {formatDate(new Date().toISOString())}</p>
        </>
      )}
    </div>
  );
}
