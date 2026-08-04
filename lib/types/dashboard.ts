// Curl-verified against the live erp instance:
//   GET /api/v1/reports/dashboard/overview?from&to (requires
//   REPORT_SALES_VIEW + REPORT_PURCHASE_VIEW + REPORT_EXPENSE_VIEW, AND'd)
//   -> {"from","to","salesTotal","purchaseTotal","expenseTotal",
//       "outstandingReceivables","outstandingPayables"}
// Note: this endpoint was returning a raw 500 (PostgreSQL parameter type
// inference failure) until fixed as part of this frontend build -- see
// erp's PurchaseOrderRepository.sumTotalAmount javadoc for the root cause.
export interface DashboardOverview {
  from: string;
  to: string;
  salesTotal: number;
  purchaseTotal: number;
  expenseTotal: number;
  outstandingReceivables: number;
  outstandingPayables: number;
}
