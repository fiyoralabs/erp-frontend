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
  salesTotal: number; // net of returns for the period
  salesReturns: number;
  purchaseTotal: number;
  expenseTotal: number;
  outstandingReceivables: number;
  outstandingPayables: number;
}

// erp's report endpoints wrap list results in this shape
// (com.fiyora.erp.common.response.PageResponse) -- distinct from the
// PagedResult shape used by non-report list endpoints (see api-client.ts).
export interface PagedReportResult<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

// GET /reports/sales/by-date
export interface SalesByDatePoint {
  date: string;
  invoiceCount: number;
  totalAmount: number;
}

// GET /reports/sales/top-products -- ranked by revenue desc
export interface TopProduct {
  productId: number;
  productCode: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

// GET /reports/sales/top-customers -- ranked by salesAmount desc
export interface TopCustomer {
  customerId: number;
  customerCode: string;
  customerName: string;
  invoiceCount: number;
  salesAmount: number;
  outstandingAmount: number;
}

// GET /reports/inventory/low-stock -- quantityOnHand <= reorderLevel
export interface LowStockItem {
  productId: number;
  productCode: string;
  productName: string;
  productVariantId: number | null;
  locationId: number;
  quantityOnHand: number;
  reorderLevel: number;
  shortageQuantity: number;
}

// GET /reports/expenses/by-category -- ranked by totalAmount desc
export interface ExpenseByCategory {
  expenseCategoryId: number | null;
  categoryCode: string | null;
  categoryName: string | null;
  expenseCount: number;
  totalAmount: number;
}
