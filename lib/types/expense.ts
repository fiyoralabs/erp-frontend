export interface ExpenseCategory {
  id:number; code:string; name:string; description:string|null; active:boolean; createdAt:string;
}
export interface ExpenseAttachment {
  id:number; fileName:string; fileUrl:string; uploadedAt:string;
}
export interface Expense {
  id:number; expenseNumber:string; expenseDate:string; status:string; expenseCategoryId:number;
  locationId:number; amount:number; paymentMethodCode:string|null; paymentMethodName:string|null;
  vendorName:string|null; invoiceNumber:string|null; remarks:string|null;
  source:"MANUAL"|"INVENTORY_LOSS"|"RECURRING"; adjustmentId:number|null; adjustmentNumber:string|null;
  recurringTemplateId:number|null; attachments:ExpenseAttachment[]; createdAt:string;
}

export type RecurringExpenseFrequency = "DAILY"|"WEEKLY"|"MONTHLY"|"YEARLY";
export type RecurringExpenseStatus = "ACTIVE"|"PAUSED";
export type DayOfWeekName = "MONDAY"|"TUESDAY"|"WEDNESDAY"|"THURSDAY"|"FRIDAY"|"SATURDAY"|"SUNDAY";

export interface RecurringExpenseTemplate {
  id:number; expenseCategoryId:number; locationId:number; name:string; amount:number;
  paymentMethodCode:string|null; vendorName:string|null; remarks:string|null;
  frequency:RecurringExpenseFrequency; dayOfMonth:number|null; dayOfWeek:DayOfWeekName|null;
  monthOfYear:number|null; startDate:string; endDate:string|null; nextRunDate:string;
  status:RecurringExpenseStatus; createdAt:string;
}
