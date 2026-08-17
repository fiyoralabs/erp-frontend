"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  Users,
  UserPlus,
  UserCheck,
  CheckCircle2,
  Target,
  Trophy,
  XCircle,
  IndianRupee,
  Scale,
  Percent,
  ListChecks,
  AlertTriangle,
  Download,
  Plus,
  TrendingUp,
  MoreHorizontal,
  Lightbulb,
  CheckCircle,
  Activity,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api-client";
import type { CrmDashboard, Lead, LeadSource, Opportunity, Pipeline } from "@/lib/types/crm";
import { LeadStatusBadge, OpportunityStatusBadge } from "@/components/crm/shared/status-badges";
import { formatCurrency, formatDate } from "@/components/crm/shared/format";
import {
  CATEGORICAL_COLORS,
  STATUS_CRITICAL,
  STATUS_GOOD,
  SEQUENTIAL_TEAL,
} from "@/components/crm/shared/chart-colors";
import { StatTile } from "@/components/shared/stat-tile";

function ChartCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white dark:bg-[#1a1c1c] border border-[#e2e2e2] dark:border-[#404848] rounded-[18px] p-5 sm:p-6 shadow-xs hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all duration-200 flex flex-col justify-between ${className ?? ""}`}
    >
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-bold text-xs sm:text-sm md:text-base text-[#1a1c1c] dark:text-white">
          {title}
        </h3>
        {action || (
          <button
            type="button"
            className="text-[#717978] hover:text-[#1a1c1c] dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 w-full min-h-[220px]">{children}</div>
    </div>
  );
}

const customTooltipStyle = {
  backgroundColor: "#1a1c1c",
  border: "none",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "12px",
  padding: "8px 12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
};

export function CrmDashboardClient() {
  const dashboardQuery = useQuery({
    queryKey: ["crm", "dashboard"],
    queryFn: () => apiClient.get<CrmDashboard>("crm/dashboard"),
  });
  const sourcesQuery = useQuery({
    queryKey: ["crm", "lead-sources"],
    queryFn: () => apiClient.get<LeadSource[]>("crm/settings/lead-sources"),
  });
  const pipelinesQuery = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => apiClient.get<Pipeline[]>("crm/pipelines"),
  });

  const [selectedYear, setSelectedYear] = React.useState("This Year");

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#0F3D3E] border-t-transparent animate-spin" />
        <p className="text-xs text-[#545f73]">Loading CRM Dashboard data...</p>
      </div>
    );
  }

  const data = dashboardQuery.data;
  if (!data) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#1a1c1c] border border-red-200 rounded-[18px] text-red-600">
        <p className="text-sm font-semibold">Unable to load the CRM dashboard.</p>
        <p className="text-xs text-[#545f73] mt-1">Please ensure the backend service is reachable.</p>
      </div>
    );
  }

  const stageNameById = new Map<number, string>();
  (pipelinesQuery.data ?? []).forEach((p) =>
    p.stages.forEach((s) => stageNameById.set(s.id, s.name))
  );
  const sourceNameById = new Map<number, string>();
  (sourcesQuery.data ?? []).forEach((s) => sourceNameById.set(s.id, s.name));

  const statusData = Object.entries(data.leadsByStatus).map(([status, count]) => ({
    name: status.replaceAll("_", " "),
    value: count,
  }));
  const sourceData = Object.entries(data.leadsBySource).map(([id, count]) => ({
    name: sourceNameById.get(Number(id)) ?? `Source #${id}`,
    value: count,
  }));
  const stageData = data.opportunitiesByStage.map((s) => ({
    name: stageNameById.get(s.stageId) ?? `Stage #${s.stageId}`,
    value: s.amount,
    count: s.count,
  }));
  const wonLostData = [
    { name: "Won", value: data.wonOpportunities },
    { name: "Lost", value: data.lostOpportunities },
  ];
  const monthlyData = data.wonRevenueByMonth.map((m) => ({
    name: m.month,
    value: m.amount,
  }));

  const maxStageValue = Math.max(...stageData.map((s) => s.value), 1);
  const totalOverdue = data.overdueTasks + data.overdueFollowUps;

  const handleExport = () => {
    try {
      const exportObject = {
        metrics: {
          totalLeads: data.totalLeads,
          newLeads: data.newLeads,
          qualifiedLeads: data.qualifiedLeads,
          convertedLeads: data.convertedLeads,
          openOpportunities: data.openOpportunities,
          wonOpportunities: data.wonOpportunities,
          lostOpportunities: data.lostOpportunities,
          pipelineValue: data.pipelineValue,
          weightedPipelineValue: data.weightedPipelineValue,
          conversionRate: data.conversionRate,
          tasksDueToday: data.tasksDueToday,
          overdueFollowUps: data.overdueFollowUps,
        },
        recentLeads: data.recentLeads,
        recentOpportunities: data.recentOpportunities,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crm-dashboard-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CRM dashboard data exported successfully!");
    } catch {
      toast.error("Failed to export data");
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-12">
      {/* ======================================================== */}
      {/* Page Header matching Stitch Desktop & Mobile Screens     */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="font-heading text-xl md:text-3xl font-semibold tracking-tight text-[#1a1c1c] dark:text-white">
            CRM Dashboard
          </h1>
          <p className="mt-1 text-xs md:text-sm text-[#545f73] dark:text-[#a3cfcf]">
            Your sales pipeline and performance at a glance.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 sm:flex-none h-10 px-4 rounded-xl border border-[#e2e2e2] dark:border-[#404848] bg-white dark:bg-[#1a1c1c] hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] text-[#1a1c1c] dark:text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4 text-[#545f73]" />
            <span>Export</span>
          </button>

          <Link
            href="/crm/leads/new"
            className="flex-1 sm:flex-none h-10 px-5 rounded-xl bg-[#0F3D3E] hover:bg-[#002627] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Create New</span>
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Overdue Alert Banner (only when there's something overdue) */}
      {/* ======================================================== */}
      {totalOverdue > 0 && (
        <Link
          href="/crm/activities?view=OVERDUE"
          className="flex items-center gap-3 rounded-2xl border border-[#ffdad6] bg-[#fff5f4] dark:border-[#5c2320] dark:bg-[#2a1615] px-4 py-3 sm:px-5 sm:py-3.5 transition-colors hover:bg-[#ffeceb] dark:hover:bg-[#331a19]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ba1a1a] text-white">
            <AlertTriangle className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold text-[#7a1414] dark:text-[#ffb4ab]">
              {totalOverdue} overdue item{totalOverdue === 1 ? "" : "s"} need{totalOverdue === 1 ? "s" : ""} attention
            </p>
            <p className="text-[11px] sm:text-xs text-[#94433d] dark:text-[#e6a29c]">
              {data.overdueTasks} task{data.overdueTasks === 1 ? "" : "s"} and {data.overdueFollowUps} follow-up{data.overdueFollowUps === 1 ? "" : "s"} past their due date.
            </p>
          </div>
          <span className="inline-flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-full bg-[#ba1a1a] px-2 text-xs font-bold text-white">
            {totalOverdue}
          </span>
        </Link>
      )}

      {/* ======================================================== */}
      {/* 12-Metric Stat Grid (4 columns Desktop, 2 cols Mobile)   */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Row 1 */}
        <StatTile
          label="Overdue Follow-ups"
          value={String(data.overdueFollowUps)}
          valueClassName="text-lg md:text-2xl"
          tone={data.overdueFollowUps > 0 ? "danger" : "default"}
          icon={AlertTriangle}
          href="/crm/activities?view=OVERDUE"
          badge={
            data.overdueFollowUps > 0 ? (
              <span className="flex items-center gap-1 rounded-full bg-[#ba1a1a] px-2 py-0.5 text-[10px] font-bold text-white">
                <AlertTriangle className="h-3 w-3" />
                {data.overdueFollowUps}
              </span>
            ) : undefined
          }
        />
        <StatTile
          label="Total Leads"
          value={String(data.totalLeads)}
          valueClassName="text-lg md:text-2xl"
          icon={Users}
          href="/crm/leads"
        />
        <StatTile
          label="New Leads"
          value={String(data.newLeads)}
          valueClassName="text-lg md:text-2xl"
          icon={UserPlus}
          href="/crm/leads?status=NEW"
        />
        <StatTile
          label="Qualified Leads"
          value={String(data.qualifiedLeads)}
          valueClassName="text-lg md:text-2xl"
          icon={UserCheck}
          href="/crm/leads?status=QUALIFIED"
        />

        {/* Row 2 */}
        <StatTile
          label="Converted Leads"
          value={String(data.convertedLeads)}
          valueClassName="text-lg md:text-2xl"
          tone="success"
          href="/crm/leads?status=CONVERTED"
          badge={
            <div className="flex items-center text-xs font-semibold text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          }
        />
        <StatTile
          label="Open Opportunities"
          value={String(data.openOpportunities)}
          valueClassName="text-lg md:text-2xl"
          icon={Target}
          href="/crm/opportunities?status=OPEN"
        />
        <StatTile
          label="Won Opportunities"
          value={String(data.wonOpportunities)}
          valueClassName="text-lg md:text-2xl"
          tone="success"
          icon={Trophy}
          href="/crm/opportunities?status=WON"
        />
        <StatTile
          label="Lost Opportunities"
          value={String(data.lostOpportunities)}
          valueClassName="text-lg md:text-2xl"
          tone={data.lostOpportunities > 0 ? "danger" : "default"}
          icon={XCircle}
          href="/crm/opportunities?status=LOST"
        />

        {/* Row 3 */}
        <StatTile
          label="Pipeline Value"
          value={formatCurrency(data.pipelineValue)}
          valueClassName="text-base sm:text-lg md:text-2xl"
          icon={IndianRupee}
          href="/crm/pipeline"
        />
        <StatTile
          label="Weighted Pipeline"
          value={formatCurrency(data.weightedPipelineValue)}
          valueClassName="text-base sm:text-lg md:text-2xl"
          icon={Scale}
          href="/crm/pipeline"
        />
        <StatTile
          label="Conversion Rate"
          value={`${data.conversionRate.toFixed(1)}%`}
          valueClassName="text-lg md:text-2xl"
          icon={Percent}
          href="/crm/reports"
        />
        <StatTile
          label="Tasks Due Today"
          value={String(data.tasksDueToday)}
          valueClassName="text-lg md:text-2xl"
          tone={data.tasksDueToday > 0 ? "warning" : "default"}
          icon={ListChecks}
          href="/crm/tasks?view=TODAY"
        />
      </div>

      {/* ======================================================== */}
      {/* Charts Row 1: Leads by Status & Leads by Source          */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Status */}
        <ChartCard title="Leads by Status">
          {statusData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#545f73]">
              No leads data available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData} margin={{ left: -15, right: 10, top: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeeed" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#545f73" }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 11, fill: "#545f73" }} allowDecimals={false} />
                <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: "#f3f4f3" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Leads by Source */}
        <ChartCard title="Leads by Source">
          {sourceData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#545f73]">
              No lead source data available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sourceData} margin={{ left: -15, right: 10, top: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeeed" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#545f73" }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 11, fill: "#545f73" }} allowDecimals={false} />
                <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: "#f3f4f3" }} />
                <Bar dataKey="value" fill={SEQUENTIAL_TEAL} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ======================================================== */}
      {/* Charts Row 2: Pipeline Funnel & Won vs Lost Deals Ratio  */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Pipeline Value by Stage */}
        <ChartCard title="Open Pipeline Value by Stage">
          {stageData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#545f73]">
              No active pipeline stages found.
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {stageData.map((stage, idx) => {
                const percentage = Math.round((stage.value / maxStageValue) * 100);
                const barColor =
                  idx === 0
                    ? "bg-[#0F3D3E]"
                    : idx === 1
                    ? "bg-[#3b6566]"
                    : "bg-[#a3cfcf]";
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-[#545f73] dark:text-[#a3cfcf]">
                        {stage.name} <span className="text-[10px] text-[#717978]">({stage.count} deals)</span>
                      </span>
                      <span className="text-[#1a1c1c] dark:text-white font-semibold text-[11px] md:text-xs">
                        {formatCurrency(stage.value)}
                      </span>
                    </div>
                    <div className="w-full bg-[#eeeeed] dark:bg-[#2f3131] h-3 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.max(percentage, stage.value > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        {/* Won vs Lost Deals */}
        <ChartCard title="Won vs Lost Deals">
          <div className="h-full flex items-center justify-center gap-8 sm:gap-12 py-4">
            {/* Won Ring */}
            <div className="text-center">
              <div className="w-24 h-24 rounded-full border-8 border-[#0F3D3E] flex items-center justify-center mb-3 mx-auto shadow-sm">
                <span className="text-lg md:text-2xl font-bold text-[#1a1c1c] dark:text-white">
                  {data.wonOpportunities}
                </span>
              </div>
              <span className="text-xs font-semibold text-[#545f73] dark:text-[#a3cfcf]">
                Won Deals
              </span>
            </div>

            <div className="h-16 w-px bg-[#e2e2e2] dark:bg-[#404848]" />

            {/* Lost Ring */}
            <div className="text-center">
              <div className="w-24 h-24 rounded-full border-8 border-[#e2e2e2] dark:border-[#404848] flex items-center justify-center mb-3 mx-auto">
                <span className="text-lg md:text-2xl font-bold text-[#717978]">
                  {data.lostOpportunities}
                </span>
              </div>
              <span className="text-xs font-semibold text-[#545f73] dark:text-[#a3cfcf]">
                Lost Deals
              </span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ======================================================== */}
      {/* Won Revenue by Month (Line Trend & Empty State)         */}
      {/* ======================================================== */}
      <ChartCard
        title="Won Revenue by Month"
        action={
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-[#f3f4f3] dark:bg-[#2f3131] border border-[#e2e2e2] dark:border-[#404848] text-[#1a1c1c] dark:text-white text-xs rounded-lg px-2 py-1 font-medium outline-none cursor-pointer"
            >
              <option>This Year</option>
            </select>
          </div>
        }
      >
        {monthlyData.length === 0 || monthlyData.every((m) => m.value === 0) ? (
          <div className="h-48 w-full flex flex-col items-center justify-center border-2 border-dashed border-[#e2e2e2] dark:border-[#404848] rounded-xl bg-[#f9f9f9] dark:bg-[#121414] text-center p-6">
            <Activity className="h-8 w-8 text-[#717978] mb-2" />
            <p className="text-xs font-medium text-[#545f73] dark:text-[#a3cfcf]">
              Not enough data to display revenue trend for this period.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyData} margin={{ left: -10, right: 10, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeeed" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#545f73" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "#545f73" }}
                tickFormatter={(v) => formatCurrency(v)}
                width={70}
              />
              <Tooltip
                contentStyle={customTooltipStyle}
                formatter={(v) => [formatCurrency(Number(v)), "Revenue"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0F3D3E"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#0F3D3E" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ======================================================== */}
      {/* Bottom Lists: Recent Leads & Recent Opportunities        */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads Feed */}
        <div className="bg-white dark:bg-[#1a1c1c] border border-[#e2e2e2] dark:border-[#404848] rounded-[18px] overflow-hidden shadow-xs flex flex-col">
          <div className="p-4 sm:p-5 border-b border-[#e2e2e2] dark:border-[#404848] flex justify-between items-center">
            <h3 className="font-bold text-xs sm:text-sm md:text-base text-[#1a1c1c] dark:text-white">
              Recent Leads
            </h3>
            <Link
              href="/crm/leads"
              className="text-xs font-semibold text-[#0F3D3E] dark:text-[#beebeb] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex-1 divide-y divide-[#eeeeed] dark:divide-[#2f3131]">
            {data.recentLeads.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#545f73]">
                No recent leads created yet.
              </div>
            ) : (
              data.recentLeads.slice(0, 5).map((lead: Lead) => (
                <div
                  key={lead.id}
                  className="p-3.5 sm:p-4 hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#d5e0f8] text-[#0F3D3E] flex items-center justify-center font-bold text-xs shrink-0">
                      {lead.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/crm/leads/${lead.id}`}
                        className="font-semibold text-xs md:text-sm text-[#1a1c1c] dark:text-white hover:text-[#0F3D3E] hover:underline truncate block"
                      >
                        {lead.fullName}
                      </Link>
                      <p className="text-[11px] text-[#545f73] dark:text-[#a3cfcf] truncate">
                        {lead.email || lead.phone || "No contact info"}
                      </p>
                    </div>
                  </div>
                  <LeadStatusBadge status={lead.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Opportunities Feed */}
        <div className="bg-white dark:bg-[#1a1c1c] border border-[#e2e2e2] dark:border-[#404848] rounded-[18px] overflow-hidden shadow-xs flex flex-col">
          <div className="p-4 sm:p-5 border-b border-[#e2e2e2] dark:border-[#404848] flex justify-between items-center">
            <h3 className="font-bold text-xs sm:text-sm md:text-base text-[#1a1c1c] dark:text-white">
              Recent Opportunities
            </h3>
            <Link
              href="/crm/opportunities"
              className="text-xs font-semibold text-[#0F3D3E] dark:text-[#beebeb] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex-1 divide-y divide-[#eeeeed] dark:divide-[#2f3131]">
            {data.recentOpportunities.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#545f73]">
                No recent opportunities found.
              </div>
            ) : (
              data.recentOpportunities.slice(0, 5).map((opp: Opportunity) => (
                <div
                  key={opp.id}
                  className="p-3.5 sm:p-4 hover:bg-[#f3f4f3] dark:hover:bg-[#2f3131] transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl border border-[#e2e2e2] dark:border-[#404848] bg-[#f9f9f9] dark:bg-[#2f3131] flex items-center justify-center text-[#0F3D3E] dark:text-[#beebeb] shrink-0">
                      {opp.status === "WON" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Lightbulb className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/crm/opportunities/${opp.id}`}
                        className="font-semibold text-xs md:text-sm text-[#1a1c1c] dark:text-white hover:text-[#0F3D3E] hover:underline truncate block"
                      >
                        {opp.name}
                      </Link>
                      <p className="text-[11px] text-[#545f73] dark:text-[#a3cfcf] truncate">
                        {formatCurrency(opp.amount)}
                      </p>
                    </div>
                  </div>
                  <OpportunityStatusBadge status={opp.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sync Footer */}
      <div className="text-right">
        <p className="text-[11px] text-[#717978]">
          Last synchronized: {formatDate(new Date().toISOString())}
        </p>
      </div>
    </div>
  );
}
