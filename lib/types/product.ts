// Curl-verified 2026-08-03 against live erp + real Postgres (company 2) --
// every field below observed in a real response. Two backend bugs were
// found and fixed during this verification pass (see erp's ProductMapper/
// PriceMapper/VariantMapper/BarcodeMapper/ProductImageMapper javadoc-style
// comments and Product.java's unit field): GET/UPDATE product 500'd for
// every product (wrong JPA entity for unit), and every *update* endpoint
// in this module 500'd whenever the caller omitted an optional field.
// Both fixed and re-verified live before this file was written.

export type ProductType = "SIMPLE" | "VARIANT" | "SET";

export interface SetSizeComposition {
  size: string;
  quantity: number;
}

export interface ProductSet {
  id?: number;
  productId?: number;
  colour: string;
  setName: string;
  sku: string;
  barcode?: string | null;
  piecesPerSet: number;
  sizeComposition: SetSizeComposition[];
  costPrice: number;
  sellingPrice: number;
  mrp?: number | null;
  openingSets?: number;
}

export interface Product {
  id: number;
  companyId: number;
  categoryId: number;
  categoryName: string | null;
  brandId: number | null;
  brandName: string | null;
  unitId: number;
  unitName: string | null;
  taxId: number | null;
  taxName: string | null;
  code: string;
  name: string;
  description: string | null;
  productType: ProductType;
  hasVariants: boolean;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ProductSummary {
  id: number;
  categoryId: number;
  categoryName: string | null;
  brandId: number | null;
  brandName: string | null;
  code: string;
  name: string;
  primaryImageUrl: string | null;
  taxId?: number | null;
  hasVariants: boolean;
  isActive: boolean;
}

export interface Variant {
  id: number;
  productId: number;
  sku: string;
  variantName: string;
  isActive: boolean;
  // Confirmed live: always null on create/list -- CreateVariantRequest's
  // mapper ignores createdAt and erp never refreshes the entity after
  // insert, so the DB-default timestamp never makes it back into the
  // response. Cosmetic gap, not relied on anywhere in this UI.
  createdAt: string | null;
  attributeValues: VariantAttributeValue[];
}

export interface VariantAttributeValue {
  attributeId: number;
  attributeName: string;
  value: string;
  // false/undefined = attributeId is a category attribute id; true = a
  // product-level attribute id owned by this product only.
  productLevel?: boolean;
}

// Product-level (single-product-scoped) variant attributes -- same shape as
// master/types.ts's CategoryAttribute but owned by one product instead of shared
// across a whole category, so there's no required/variant/filterable flag: a
// product attribute's only purpose is generating this one product's variants.
export type ProductAttributeDataType = "SELECT" | "TEXT" | "NUMBER" | "BOOLEAN";

export interface ProductAttributeOption {
  id: number;
  value: string;
  displayOrder: number;
  isActive: boolean;
}

export interface ProductAttribute {
  id: number;
  code: string | null;
  name: string;
  dataType: ProductAttributeDataType;
  displayOrder: number;
  options: ProductAttributeOption[];
}

export interface ProductImage {
  id: number;
  productId: number;
  variantId: number | null;
  imageUrl: string;
  originalFileName: string | null;
  contentType: string | null;
  fileSize: number | null;
  displayOrder: number;
  isPrimary: boolean;
  createdAt: string | null;
}

export interface Barcode {
  id: number;
  productId: number;
  variantId: number | null;
  barcode: string;
  barcodeType: string;
  isPrimary: boolean;
  createdAt: string | null;
}

export interface Price {
  id: number;
  productId: number;
  variantId: number | null;
  priceListId: number;
  costPrice: number;
  sellingPrice: number;
  mrp: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string | null;
}

export interface PriceHistoryEntry {
  id: number;
  priceId: number;
  oldCostPrice: number;
  newCostPrice: number;
  oldSellingPrice: number;
  newSellingPrice: number;
  changedAt: string;
  changedBy: number;
}

// Common barcode type conventions (GS1) offered as suggestions -- the field
// is free text server-side, same pattern as Reason.reasonType.
export const BARCODE_TYPES = ["PRIMARY", "EAN13", "EAN8", "UPC", "CODE128", "QR"] as const;
