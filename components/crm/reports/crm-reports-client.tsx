"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Percent, DollarSign, Scale, Trophy, CheckCircle2, XCircle, Banknote, CalendarClock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { apiClient } from "@/lib/api-client";
import type { CrmReports } from "@/lib/types/crm";
import { formatCurrency } from "@/components/crm/shared/format";
import { CATEGORICAL_COLORS, SEQUENTIAL_BLUE, STATUS_CRITICAL } from "@/components/crm/shared/chart-colors";
import { StatTile } from "@/components/shared/stat-tile";

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm md:text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-64 overflow-x-auto"><div className="h-full min-w-72">{children}</div></CardContent>
    </Card>
  );
}

const tooltipStyle = { fontSize: 12, borderRadius: 8 };

function toChartData(record: Record<string, number>) {
  return Object.entries(record).map(([name, value]) => ({ name: name.replaceAll("_", " "), value }));
}

export function CrmReportsClient() {
  const query = useQuery({ queryKey: ["crm", "reports"], queryFn: () => apiClient.get<CrmReports>("crm/reports") });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading reports...</p>;
  const data = query.data;
  if (!data) return <p className="text-sm text-destructive">Unable to load CRM reports.</p>;

  const agingColumns: DataTableColumn<CrmReports["leadAging"][number]>[] = [
    { key: "lead", header: "Lead", render: (r) => r.fullName },
    { key: "number", header: "Lead Number", render: (r) => r.leadNumber },
    { key: "age", header: "Age (days)", render: (r) => String(r.ageDays) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">CRM Reports</h1>
        <p className="text-sm text-muted-foreground">Lead, opportunity, and sales-forecast analysis.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile icon={Percent} label="Lead Conversion Rate" value={`${data.leadConversionRate.toFixed(1)}%`} />
        <StatTile icon={DollarSign} label="Pipeline Value" value={formatCurrency(data.pipelineValue)} />
        <StatTile icon={Scale} label="Weighted Pipeline" value={formatCurrency(data.weightedPipelineValue)} />
        <StatTile icon={Trophy} tone="success" label="Win Rate" value={`${data.winRate.toFixed(1)}%`} />
        <StatTile icon={CheckCircle2} tone="success" label="Won Deals" value={String(data.wonDeals)} />
        <StatTile icon={XCircle} tone="danger" label="Lost Deals" value={String(data.lostDeals)} />
        <StatTile icon={Banknote} label="Average Deal Size" value={formatCurrency(data.averageDealSize)} />
        <StatTile icon={CalendarClock} label="Avg. Sales Cycle" value={data.averageSalesCycleDays !== null ? `${data.averageSalesCycleDays.toFixed(0)}d` : "—"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Leads by Source">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={toChartData(data.leadsBySource)} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {toChartData(data.leadsBySource).map((_, i) => <Cell key={i} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Leads by Status">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={toChartData(data.leadsByStatus)} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill={SEQUENTIAL_BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Lost Reasons">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={toChartData(data.lostReasons)} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill={STATUS_CRITICAL} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue Forecast by Month">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.forecastByMonth.map((m) => ({ name: m.month, value: m.amount }))} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
              <Line type="monotone" dataKey="value" stroke={SEQUENTIAL_BLUE} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead Aging</CardTitle>
          <CardDescription>Open leads sorted by days since creation.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={agingColumns} data={data.leadAging} rowKey={(r) => r.leadId} emptyMessage="No open leads." />
        </CardContent>
      </Card>
    </div>
  );
}
