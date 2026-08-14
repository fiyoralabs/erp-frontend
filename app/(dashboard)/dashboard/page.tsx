import Link from "next/link";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, IndianRupee, ShoppingCart, Wallet } from "lucide-react";
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
import { StatTile } from "@/components/shared/stat-tile";
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
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight text-[#1a1c1c] dark:text-white">
            Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#545f73] dark:text-[#a3cfcf]">
            {from} to {to}
          </p>
        </div>
        <DateRangePicker key={`${from}|${to}`} from={from} to={to} />
      </div>

      {!overview ? (
        <div className="p-8 text-center bg-white dark:bg-[#1a1c1c] border border-red-200 dark:border-red-500/30 rounded-[18px] text-red-600 dark:text-red-400">
          <p className="text-sm font-semibold">Unable to load dashboard data.</p>
          <p className="mt-1 text-xs text-[#545f73] dark:text-[#a3cfcf]">
            You may not have the required report permissions, or the erp backend may be unreachable.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          <StatTile
            label="Sales Total"
            value={formatCurrency(overview.salesTotal)}
            tone="success"
            icon={IndianRupee}
          />
          <StatTile
            label="Purchase Total"
            value={formatCurrency(overview.purchaseTotal)}
            icon={ShoppingCart}
          />
          <StatTile
            label="Expense Total"
            value={formatCurrency(overview.expenseTotal)}
            tone="danger"
            icon={Wallet}
          />
          <StatTile
            label="Outstanding Receivables"
            value={formatCurrency(overview.outstandingReceivables)}
            tone="success"
            icon={ArrowDownToLine}
          />
          <StatTile
            label="Outstanding Payables"
            value={formatCurrency(overview.outstandingPayables)}
            tone="danger"
            icon={ArrowUpFromLine}
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

      <Link
        href="/reports"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#0F3D3E] hover:text-[#002627] dark:text-[#a3cfcf] hover:underline"
      >
        View all reports <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
