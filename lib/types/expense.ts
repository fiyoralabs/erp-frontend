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
  source:"MANUAL"|"INVENTORY_LOSS"; adjustmentId:number|null; adjustmentNumber:string|null;
  attachments:ExpenseAttachment[]; createdAt:string;
}
