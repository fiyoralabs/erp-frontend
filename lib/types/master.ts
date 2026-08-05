// Curl-verified 2026-08-03 against live erp (company 2 / admin@globalcorp.com) --
// every field below was observed in a real response, not assumed from Swagger.
// All 8 "simple" entities share the same envelope: paginated GET, POST create,
// PUT update (full replace of mutable fields), DELETE (soft -- isActive flips
// to false, GET by id still 200s afterward; list endpoints have no isActive
// filter param, so soft-deleted rows still appear in lists).

export interface Category {
  id: number;
  code: string;
  name: string;
  parentCategoryId: number | null;
  parentCategoryName: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CategoryTreeNode {
  id: number;
  code: string;
  name: string;
  displayOrder: number;
  children: CategoryTreeNode[];
}

export type CategoryAttributeDataType = "SELECT" | "TEXT" | "NUMBER" | "BOOLEAN";

export interface CategoryAttributeOption {
  id: number;
  value: string;
  displayOrder: number;
  isActive: boolean;
}

export interface CategoryAttribute {
  id: number;
  code: string | null;
  name: string;
  dataType: CategoryAttributeDataType;
  required: boolean;
  variant: boolean;
  filterable: boolean;
  displayOrder: number;
  options: CategoryAttributeOption[];
}

export interface Brand {
  id: number;
  code: string;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Unit {
  id: number;
  code: string;
  name: string;
  symbol: string;
  decimalPrecision: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Tax {
  id: number;
  code: string;
  name: string;
  taxPercentage: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  displayOrder: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

// reasonType is a free-text field server-side (no enum) -- STOCK_ADJUSTMENT
// confirmed live; other values are UI-suggested conventions, not enforced.
export interface Reason {
  id: number;
  code: string;
  name: string;
  reasonType: string;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerGroup {
  id: number;
  code: string;
  name: string;
  defaultPriceListId: number | null;
  defaultPriceListName: string | null;
  creditLimit: number;
  creditDays: number;
  isActive: boolean;
  createdAt: string;
}

export interface PriceList {
  id: number;
  code: string;
  name: string;
  description: string | null;
  minimumQuantity: number;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

// LocationType enum values confirmed from erp source
// (master/domain/entity/LocationType.java) -- STORE and WAREHOUSE curl-verified.
export type LocationType = "STORE" | "WAREHOUSE" | "OFFICE" | "KITCHEN" | "OUTLET";

export interface Location {
  id: number;
  code: string;
  name: string;
  type: LocationType;
  parentId: number | null;
  parentName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  gstin?: string | null;
  upiId?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankIfsc?: string | null;
  isDefault: boolean;
  isUserDefault?: boolean | null;
  isActive: boolean;
  createdAt: string;
}

export interface LocationConfiguration {
  id: number;
  locationId: number;
  currency: string | null;
  timezone: string | null;
  receiptTemplate: string | null;
  invoicePrefix: string | null;
  allowNegativeStock: boolean;
  enableRoundOff: boolean;
  enableBarcode: boolean;
  enableKot: boolean;
  printerName: string | null;
}

// A fresh location auto-provisions a configuration row (confirmed live --
// GET .../configuration on a location created seconds earlier already
// returned defaults, no 404).

// Real document types actually consumed for number generation (grepped from
// every masterModule.generateNextDocumentNumber(companyId, "...") call site
// across sales/purchase/expense/finance) -- this is the authoritative list,
// NOT from any enum (the field is a free string server-side). Purchase
// Invoice numbers are supplier-supplied, not generated, so no type for it.
export const DOCUMENT_TYPES = [
  "SALES_INVOICE",
  "SALES_RETURN",
  "PURCHASE_ORDER",
  "PURCHASE_RETURN",
  "GOODS_RECEIPT",
  "EXPENSE",
  "JOURNAL_ENTRY",
  "STOCK_ADJUSTMENT",
  "STOCK_TRANSFER",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface DocumentSequence {
  id: number;
  documentType: string;
  prefix: string;
  suffix: string;
  padding: number;
  currentValue: number;
  nextFormattedNumber: string;
  resetFrequency: string;
  updatedAt: string;
}
