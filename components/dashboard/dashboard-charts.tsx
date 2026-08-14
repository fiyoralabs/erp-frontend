"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, MoreHorizontal } from "lucide-react";

import { formatCurrency } from "@/components/crm/shared/format";
import { SEQUENTIAL_BLUE, STATUS_CRITICAL } from "@/components/crm/shared/chart-colors";
import type {
  SalesByDatePoint, TopProduct, TopCustomer, LowStockItem, ExpenseByCategory,
} from "@/lib/types/dashboard";

const tooltipStyle = {
  backgroundColor: "#1a1c1c",
  border: "none",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "12px",
  padding: "8px 12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
};

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }) {
  return (
    <div className="bg-white dark:bg-[#1a1c1c] border border-[#e2e2e2] dark:border-[#404848] rounded-[18px] p-5 sm:p-6 shadow-xs hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all duration-200 flex flex-col justify-between">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-bold text-sm sm:text-base text-[#1a1c1c] dark:text-white">{title}</h3>
        <MoreHorizontal className="h-4 w-4 text-[#717978]" />
      </div>
      <div className="flex-1 w-full min-h-[220px] h-64">
        {empty ? (
          <div className="flex h-full items-center justify-center text-center text-xs text-[#545f73] dark:text-[#a3cfcf]">
            No data for this range, or you don&apos;t have permission to view it.
          </div>
        ) : (
          <div className="h-full w-full">{children}</div>
        )}
      </div>
    </div>
  );
}

function ListCard({ title, children, empty, emptyText }: { title: string; children: React.ReactNode; empty: boolean; emptyText: string }) {
  return (
    <div className="bg-white dark:bg-[#1a1c1c] border border-[#e2e2e2] dark:border-[#404848] rounded-[18px] p-5 sm:p-6 shadow-xs hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all duration-200">
      <h3 className="font-bold text-sm sm:text-base text-[#1a1c1c] dark:text-white mb-4">{title}</h3>
      <div className="flex flex-col gap-2.5">
        {empty ? <p className="text-xs text-[#545f73] dark:text-[#a3cfcf]">{emptyText}</p> : children}
      </div>
    </div>
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
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <ChartCard title="Sales Trend (Last 30 Days)" empty={salesByDate === null || trendData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeeed" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#545f73" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "#545f73" }} tickFormatter={(v) => formatCurrency(v)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
              <Line type="monotone" dataKey="value" stroke={SEQUENTIAL_BLUE} strokeWidth={2.5} dot={{ r: 3, fill: SEQUENTIAL_BLUE }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Products by Revenue" empty={topProducts === null || productData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={productData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeeed" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#545f73" }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: "#545f73" }} tickFormatter={(v) => formatCurrency(v)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="value" fill={SEQUENTIAL_BLUE} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Expenses by Category" empty={expenseByCategory === null || categoryData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeeed" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#545f73" }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: "#545f73" }} tickFormatter={(v) => formatCurrency(v)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="value" fill={STATUS_CRITICAL} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ListCard
          title="Top Customers"
          empty={topCustomers === null || topCustomers.length === 0}
          emptyText={topCustomers === null ? "No data for this range, or you don't have permission to view it." : "No customer sales in this range."}
        >
          {(topCustomers ?? []).map((c) => (
            <div key={c.customerId} className="flex items-center justify-between gap-2 text-sm py-1">
              <span className="truncate text-[#1a1c1c] dark:text-white">{c.customerName}</span>
              <div className="flex shrink-0 items-center gap-2 text-[#545f73] dark:text-[#a3cfcf]">
                <span className="text-xs">{c.invoiceCount} invoices</span>
                <span className="font-semibold text-[#0F3D3E] dark:text-[#beebeb]">{formatCurrency(c.salesAmount)}</span>
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
          <div key={`${item.productId}-${item.locationId}`} className="flex items-center justify-between gap-2 text-sm py-1">
            <Link href={`/products/${item.productId}`} className="truncate text-[#0F3D3E] dark:text-[#a3cfcf] hover:underline font-medium">
              {item.productName}
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-[#545f73] dark:text-[#a3cfcf]">
                {item.quantityOnHand} on hand / {item.reorderLevel} reorder level
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ffdad6] px-2 py-0.5 text-[11px] font-semibold text-[#ba1a1a]">
                <AlertTriangle className="size-3" />
                -{item.shortageQuantity}
              </span>
            </div>
          </div>
        ))}
      </ListCard>
    </>
  );
}
