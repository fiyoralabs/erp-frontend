export interface Customer {
  id: number; code: string; customerType: "INDIVIDUAL" | "BUSINESS"; name: string;
  phone: string | null; email: string | null; gstNumber: string | null; address: string | null;
  city: string | null; state: string | null; country: string | null; postalCode: string | null;
  customerGroupId: number | null; priceListId: number | null; preferredLocationId: number | null;
  creditLimit: number; creditDays: number; remarks: string | null; totalPurchaseAmount: number;
  lastPurchaseAt: string | null; active: boolean; createdAt: string; updatedAt: string;
}
export interface SalesPayment {
  id: number; invoiceId: number; paymentMethodId: number; paymentMethodCode: string;
  paymentMethodName: string; paymentDate: string; amount: number; referenceNumber: string | null;
  remarks: string | null; status: string; createdAt: string;
}
export interface SalesInvoiceLine {
  id: number; productId: number; productVariantId: number | null; productCode: string;
  productName: string; variantSku: string | null; variantName: string | null; quantity: number;
  priceListId: number; priceListCode: string; priceListName: string; normalSellingPrice: number;
  sellingPrice: number; priceOverride: boolean; discountPercentage: number;
  discountAmount: number; taxName: string | null; taxPercentage: number; taxAmount: number;
  lineTotal: number; inventoryTracked: boolean; inventoryTransactionId: number | null;
}
export interface SalesInvoice {
  id: number; customerId: number; customerName: string | null; locationId: number; invoiceNumber: string; invoiceDate: string;
  dueDate: string; subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number;
  paidAmount: number; returnAppliedAmount: number; returnedAmount: number; creditAppliedAmount: number; balanceAmount: number; status: string;
  storeUpiId: string | null;
  createdAt: string; lines: SalesInvoiceLine[]; payments: SalesPayment[]; verifyToken?: string | null;
}
export interface SalesReturnLine {
  id: number; invoiceItemId: number; productId: number; productVariantId: number | null;
  quantity: number; baseAmount: number; discountAmount: number; taxName: string | null;
  taxPercentage: number; taxAmount: number; lineTotal: number; reason: string | null;
  inventoryTracked: boolean; inventoryTransactionId: number | null;
}
export interface SalesReturn {
  id: number; invoiceId: number; customerId: number; customerName: string | null; locationId: number; returnNumber: string;
  returnDate: string; reason: string | null; totalAmount: number; receivableAppliedAmount: number;
  creditAmount: number; creditNumber: string | null; status: string; lines: SalesReturnLine[];
}
export interface WishlistItem {
  id: number; productId: number; productVariantId: number | null; quantity: number; remarks: string | null;
}
export interface Wishlist { id: number; customerId: number; remarks: string | null; items: WishlistItem[]; }
export interface CustomerLedger {
  summary: { customerId: number; customerCode: string; customerName: string; outstandingBalance: number };
  transactions: { content: { entryType: string; sourceId: number; documentNumber: string; businessDate: string; receivableEffect: number }[]; totalElements: number };
}
