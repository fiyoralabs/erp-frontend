import { z } from "zod";
import { isValidCurrency, isValidTimezone } from "@/lib/intl-options";

// Mirrors erp's CreateXRequest/UpdateXRequest bean-validation annotations
// exactly (see master/api/request/*.java) -- code pattern, required fields,
// numeric ranges all curl-verified 2026-08-03.
const codeSchema = z
  .string()
  .min(1, "Code is required")
  .regex(/^[a-zA-Z0-9_-]+$/, "Code can only contain letters, numbers, hyphens, and underscores");

const nameSchema = z.string().min(1, "Name is required");

// Category codes are optional on create -- erp auto-generates one from the name
// (e.g. "Electronics" -> "ELECTRONICS") when left blank, so this only validates the
// charset when the user does type one, unlike codeSchema's required min(1) above.
const optionalCodeSchema = z
  .string()
  .regex(/^$|^[a-zA-Z0-9_-]+$/, "Code can only contain letters, numbers, hyphens, and underscores")
  .optional()
  .or(z.literal(""));

export const categorySchema = z.object({
  code: optionalCodeSchema,
  name: nameSchema,
  parentCategoryId: z.number().nullable().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type CategoryFormValues = z.infer<typeof categorySchema>;

export const brandSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  logoUrl: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});
export type BrandFormValues = z.infer<typeof brandSchema>;

export const unitSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  symbol: z.string().min(1, "Symbol is required"),
  decimalPrecision: z.number().int().min(0).max(6).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type UnitFormValues = z.infer<typeof unitSchema>;

export const taxSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  taxPercentage: z.number().min(0).max(100),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type TaxFormValues = z.infer<typeof taxSchema>;

export const paymentMethodSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  displayOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>;

export const reasonSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  reasonType: z.string().min(1, "Reason type is required"),
  isActive: z.boolean().optional(),
});
export type ReasonFormValues = z.infer<typeof reasonSchema>;

export const customerGroupSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  defaultPriceListId: z.number().nullable().optional(),
  creditLimit: z.number().min(0).optional(),
  creditDays: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type CustomerGroupFormValues = z.infer<typeof customerGroupSchema>;

export const priceListSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  description: z.string().optional().or(z.literal("")),
  minimumQuantity: z.number().positive().optional(),
  priority: z.number().int(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type PriceListFormValues = z.infer<typeof priceListSchema>;

export const locationSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  type: z.enum(["STORE", "WAREHOUSE", "OFFICE", "KITCHEN", "OUTLET"]),
  parentId: z.number().nullable().optional(),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  postalCode: z.string().optional().or(z.literal("")),
  gstin: z.string().optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  priceLists: z.array(z.object({
    priceListId: z.number(),
    isDefault: z.boolean(),
  })).optional(),
}).superRefine((values, context) => {
  if (values.priceLists === undefined) return; // Existing-location detail edits use the assignment screen.
  if (values.priceLists.length === 0) {
    context.addIssue({ code: "custom", path: ["priceLists"], message: "Select at least one price list" });
  } else if (values.priceLists.filter((item) => item.isDefault).length !== 1) {
    context.addIssue({ code: "custom", path: ["priceLists"], message: "Choose exactly one default price list" });
  }
});
export type LocationFormValues = z.infer<typeof locationSchema>;

export const categoryAttributeSchema = z.object({
  code: z.string().max(50).regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, hyphens, or underscores").optional().or(z.literal("")),
  name: z.string().min(1, "Name is required").max(100),
  dataType: z.enum(["SELECT", "TEXT", "NUMBER", "BOOLEAN"]),
  required: z.boolean(),
  variant: z.boolean(),
  filterable: z.boolean(),
  displayOrder: z.number().int(),
  optionText: z.string().optional(),
}).superRefine((value, context) => {
  if (value.dataType === "SELECT" && !(value.optionText ?? "").split(",").some((item) => item.trim())) {
    context.addIssue({ code: "custom", path: ["optionText"], message: "Add at least one comma-separated option" });
  }
});
export type CategoryAttributeFormValues = z.infer<typeof categoryAttributeSchema>;

// Same shape as categoryAttributeSchema minus required/variant/filterable --
// a product-level attribute's only purpose is generating that one product's
// variants, so those category-wide flags don't apply.
export const productAttributeSchema = z.object({
  code: z.string().max(30).regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, hyphens, or underscores").optional().or(z.literal("")),
  name: z.string().min(1, "Name is required").max(100),
  dataType: z.enum(["SELECT", "TEXT", "NUMBER", "BOOLEAN"]),
  displayOrder: z.number().int(),
  optionText: z.string().optional(),
}).superRefine((value, context) => {
  if (value.dataType === "SELECT" && !(value.optionText ?? "").split(",").some((item) => item.trim())) {
    context.addIssue({ code: "custom", path: ["optionText"], message: "Add at least one comma-separated option" });
  }
});
export type ProductAttributeFormValues = z.infer<typeof productAttributeSchema>;

export const locationConfigurationSchema = z.object({
  // Currency and timezone are used later to format/print real amounts and
  // dates on receipts and reports -- unlike City, garbage here silently
  // breaks that later, so both must be an exact, valid ISO 4217 / IANA
  // value (picked from the Combobox's suggestions) rather than arbitrary
  // free text.
  currency: z
    .string()
    .optional()
    .refine((val) => !val || isValidCurrency(val), {
      message: "Must be a valid currency code (e.g. INR) — pick one from the list.",
    }),
  timezone: z
    .string()
    .optional()
    .refine((val) => !val || isValidTimezone(val), {
      message: "Must be a valid timezone (e.g. Asia/Kolkata) — pick one from the list.",
    }),
  receiptTemplate: z.string().optional().or(z.literal("")),
  invoicePrefix: z.string().optional().or(z.literal("")),
  allowNegativeStock: z.boolean().optional(),
  enableRoundOff: z.boolean().optional(),
  enableBarcode: z.boolean().optional(),
  enableKot: z.boolean().optional(),
  printerName: z.string().optional().or(z.literal("")),
});
export type LocationConfigurationFormValues = z.infer<typeof locationConfigurationSchema>;

export const documentSequenceSchema = z.object({
  prefix: z.string().optional().or(z.literal("")),
  suffix: z.string().optional().or(z.literal("")),
  padding: z.number().int().min(1, "Padding must be at least 1").optional(),
  currentValue: z.number().int().min(0).optional(),
  resetFrequency: z.string().optional().or(z.literal("")),
});
export type DocumentSequenceFormValues = z.infer<typeof documentSequenceSchema>;
