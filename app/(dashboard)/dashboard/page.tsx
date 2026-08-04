import { serverApiGet } from "@/lib/server-api";
import type { DashboardOverview } from "@/lib/types/dashboard";
import { localDateInputValue } from "@/lib/date";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

function todayRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(1);
  from.setMonth(0); // Jan 1 of current year -- year-to-date default window
  return { from: localDateInputValue(from), to: localDateInputValue(to) };
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

export default async function DashboardPage() {
  const { from, to } = todayRange();
  const overview = await serverApiGet<DashboardOverview>(
    `reports/dashboard/overview?from=${from}&to=${to}`
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {from} to {to}
        </p>
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
    </div>
  );
}
