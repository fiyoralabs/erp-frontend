import Link from "next/link";
import { serverApiGet } from "@/lib/server-api";
import type {
  DashboardOverview,
  PagedReportResult,
  SalesByDatePoint,
  TopProduct,
  TopCustomer,
  LowStockItem,
  ExpenseByCategory,
} from "@/lib/types/dashboard";
import { localDateInputValue } from "@/lib/date";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";

function todayRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(1);
  from.setMonth(0); // Jan 1 of current year -- year-to-date default window
  return { from: localDateInputValue(from), to: localDateInputValue(to) };
}

// Trend chart always shows the last 30 days ending on `to`, independent of
// the (potentially much wider, e.g. year-to-date) overview range -- report
// endpoints cap page size at 100, and a daily trend over a full year would
// blow past that as well as being unreadable as a bar/line chart.
function last30Days(to: string) {
  const toDate = new Date(to);
  const from = new Date(toDate);
  from.setDate(from.getDate() - 29);
  return { from: localDateInputValue(from), to };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

interface StatCardProps {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}

function StatCard({ label, value, tone = "default" }: StatCardProps) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
      ? "text-red-600 dark:text-red-400"
      : "";
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-2xl ${toneClass}`}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const defaults = todayRange();
  const from = params.from || defaults.from;
  const to = params.to || defaults.to;
  const trend = last30Days(to);

  const [overview, salesByDate, topProducts, topCustomers, lowStock, expenseByCategory] =
    await Promise.all([
      serverApiGet<DashboardOverview>(`reports/dashboard/overview?from=${from}&to=${to}`),
      serverApiGet<PagedReportResult<SalesByDatePoint>>(
        `reports/sales/by-date?from=${trend.from}&to=${trend.to}&size=31`
      ),
      serverApiGet<PagedReportResult<TopProduct>>(
        `reports/sales/top-products?from=${from}&to=${to}&size=5`
      ),
      serverApiGet<PagedReportResult<TopCustomer>>(
        `reports/sales/top-customers?from=${from}&to=${to}&size=5`
      ),
      serverApiGet<PagedReportResult<LowStockItem>>(`reports/inventory/low-stock?size=5`),
      serverApiGet<PagedReportResult<ExpenseByCategory>>(
        `reports/expenses/by-category?from=${from}&to=${to}&size=6`
      ),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {from} to {to}
          </p>
        </div>
        <DateRangePicker key={`${from}|${to}`} from={from} to={to} />
      </div>

      {!overview ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Unable to load dashboard data. You may not have the required
            report permissions, or the erp backend may be unreachable.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Sales Total"
            value={formatCurrency(overview.salesTotal)}
            tone="positive"
          />
          <StatCard
            label="Purchase Total"
            value={formatCurrency(overview.purchaseTotal)}
          />
          <StatCard
            label="Expense Total"
            value={formatCurrency(overview.expenseTotal)}
            tone="negative"
          />
          <StatCard
            label="Outstanding Receivables"
            value={formatCurrency(overview.outstandingReceivables)}
            tone="positive"
          />
          <StatCard
            label="Outstanding Payables"
            value={formatCurrency(overview.outstandingPayables)}
            tone="negative"
          />
        </div>
      )}

      <DashboardCharts
        salesByDate={salesByDate?.content ?? null}
        topProducts={topProducts?.content ?? null}
        topCustomers={topCustomers?.content ?? null}
        lowStock={lowStock?.content ?? null}
        expenseByCategory={expenseByCategory?.content ?? null}
      />

      <Link href="/reports" className="text-sm text-primary hover:underline">
        View all reports →
      </Link>
    </div>
  );
}
