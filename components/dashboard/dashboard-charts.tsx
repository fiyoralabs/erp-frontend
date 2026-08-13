"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/components/crm/shared/format";
import { SEQUENTIAL_BLUE, STATUS_CRITICAL } from "@/components/crm/shared/chart-colors";
import type {
  SalesByDatePoint, TopProduct, TopCustomer, LowStockItem, ExpenseByCategory,
} from "@/lib/types/dashboard";

const tooltipStyle = { fontSize: 12, borderRadius: 8 };

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-64">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data for this range, or you don&apos;t have permission to view it.
          </div>
        ) : (
          <div className="h-full w-full">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ListCard({ title, children, empty, emptyText }: { title: string; children: React.ReactNode; empty: boolean; emptyText: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {empty ? <p className="text-sm text-muted-foreground">{emptyText}</p> : children}
      </CardContent>
    </Card>
  );
}

interface DashboardChartsProps {
  salesByDate: SalesByDatePoint[] | null;
  topProducts: TopProduct[] | null;
  topCustomers: TopCustomer[] | null;
  lowStock: LowStockItem[] | null;
  expenseByCategory: ExpenseByCategory[] | null;
}

export function DashboardCharts({ salesByDate, topProducts, topCustomers, lowStock, expenseByCategory }: DashboardChartsProps) {
  const trendData = (salesByDate ?? []).map((d) => ({ name: d.date.slice(5), value: d.totalAmount }));
  const productData = (topProducts ?? []).map((p) => ({ name: p.productName, value: p.revenue }));
  const categoryData = (expenseByCategory ?? []).map((c) => ({ name: c.categoryName ?? "Uncategorized", value: c.totalAmount }));

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Sales Trend (Last 30 Days)" empty={salesByDate === null || trendData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
              <Line type="monotone" dataKey="value" stroke={SEQUENTIAL_BLUE} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Products by Revenue" empty={topProducts === null || productData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={productData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="value" fill={SEQUENTIAL_BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Expenses by Category" empty={expenseByCategory === null || categoryData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="value" fill={STATUS_CRITICAL} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ListCard
          title="Top Customers"
          empty={topCustomers === null || topCustomers.length === 0}
          emptyText={topCustomers === null ? "No data for this range, or you don't have permission to view it." : "No customer sales in this range."}
        >
          {(topCustomers ?? []).map((c) => (
            <div key={c.customerId} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{c.customerName}</span>
              <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                <span>{c.invoiceCount} invoices</span>
                <span className="font-medium text-foreground">{formatCurrency(c.salesAmount)}</span>
              </div>
            </div>
          ))}
        </ListCard>
      </div>

      <ListCard
        title="Low Stock Alerts"
        empty={lowStock === null || lowStock.length === 0}
        emptyText={lowStock === null ? "No data, or you don't have permission to view it." : "Nothing below reorder level right now."}
      >
        {(lowStock ?? []).map((item) => (
          <div key={`${item.productId}-${item.locationId}`} className="flex items-center justify-between gap-2 text-sm">
            <Link href={`/products/${item.productId}`} className="truncate text-primary hover:underline">
              {item.productName}
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-muted-foreground">
                {item.quantityOnHand} on hand / {item.reorderLevel} reorder level
              </span>
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" />
                -{item.shortageQuantity}
              </Badge>
            </div>
          </div>
        ))}
      </ListCard>
    </>
  );
}
