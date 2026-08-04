import { z } from "zod";

// Mirrors erp's CreateProductRequest/UpdateProductRequest bean-validation
// annotations exactly (product/api/request/*.java), curl-verified 2026-08-03.
const codeSchema = z.string().min(1, "Code is required").max(50, "Max 50 characters");
const nameSchema = z.string().min(1, "Name is required").max(255, "Max 255 characters");

export const productSchema = z.object({
  categoryId: z.number({ error: "Category is required" }),
  brandId: z.number().nullable().optional(),
  unitId: z.number({ error: "Unit is required" }),
  taxId: z.number().nullable().optional(),
  code: codeSchema,
  name: nameSchema,
  description: z.string().max(2000, "Max 2000 characters").optional().or(z.literal("")),
  productType: z.enum(["SIMPLE", "VARIANT"]),
  hasVariants: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  allowNegativeStock: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type ProductFormValues = z.infer<typeof productSchema>;

export const variantSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(100, "Max 100 characters"),
  variantName: z.string().max(255, "Max 255 characters").optional(),
  attributeValues: z.array(z.object({ attributeId: z.number(), value: z.string().min(1) })),
  isActive: z.boolean().optional(),
});
export type VariantFormValues = z.infer<typeof variantSchema>;

export const priceSchema = z.object({
  variantId: z.number().nullable().optional(),
  priceListId: z.number({ error: "Price list is required" }),
  costPrice: z.number({ error: "Cost price is required" }).min(0.01, "Must be greater than 0"),
  sellingPrice: z
    .number({ error: "Selling price is required" })
    .min(0.01, "Must be greater than 0"),
  mrp: z.number().min(0.01, "Must be greater than 0").nullable().optional(),
  isActive: z.boolean().optional(),
});
export type PriceFormValues = z.infer<typeof priceSchema>;

export const barcodeSchema = z.object({
  variantId: z.number().nullable().optional(),
  barcode: z.string().min(1, "Barcode is required").max(100, "Max 100 characters"),
  barcodeType: z.string().min(1, "Barcode type is required"),
  isPrimary: z.boolean().optional(),
});
export type BarcodeFormValues = z.infer<typeof barcodeSchema>;

export const imageSchema = z.object({
  imageUrl: z.string().min(1, "Image URL is required"),
  displayOrder: z.number().int().optional(),
  isPrimary: z.boolean().optional(),
});
export type ImageFormValues = z.infer<typeof imageSchema>;
