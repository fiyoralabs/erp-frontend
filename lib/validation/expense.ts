import { z } from "zod";

// Mirrors erp's CreateRecurringExpenseTemplateRequest/UpdateRecurringExpenseTemplateRequest
// bean-validation annotations (see expense/api/request/*RecurringExpenseTemplateRequest.java).
export const recurringExpenseTemplateSchema = z.object({
  expenseCategoryId: z.number({ error: "Category is required" }),
  locationId: z.number({ error: "Location is required" }),
  name: z.string().min(1, "Name is required").max(200, "Name must be max 200 characters"),
  amount: z.number().positive("Amount must be positive"),
  paymentMethodCode: z.string().optional().or(z.literal("")),
  vendorName: z.string().max(200, "Vendor name must be max 200 characters").optional().or(z.literal("")),
  remarks: z.string().optional().or(z.literal("")),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  dayOfWeek: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]).nullable().optional(),
  monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().or(z.literal("")),
}).superRefine((values, context) => {
  if (values.frequency === "WEEKLY" && !values.dayOfWeek) {
    context.addIssue({ code: "custom", path: ["dayOfWeek"], message: "Day of week is required for a weekly schedule" });
  }
  if (values.frequency === "MONTHLY" && !values.dayOfMonth) {
    context.addIssue({ code: "custom", path: ["dayOfMonth"], message: "Day of month is required for a monthly schedule" });
  }
  if (values.frequency === "YEARLY" && (!values.dayOfMonth || !values.monthOfYear)) {
    context.addIssue({ code: "custom", path: ["monthOfYear"], message: "Day and month are required for a yearly schedule" });
  }
  if (values.endDate && values.startDate && values.endDate < values.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "End date cannot be before start date" });
  }
});
export type RecurringExpenseTemplateFormValues = z.infer<typeof recurringExpenseTemplateSchema>;
