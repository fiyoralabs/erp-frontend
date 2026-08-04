export interface InventoryStock {
  productId: number;
  productVariantId: number | null;
  productCode: string;
  productName: string;
  variantName: string | null;
  sku: string | null;
  locationId: number;
  locationName: string;
  quantityOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderLevel: number | null;
}

export interface InventoryBatch {
  batchId: number;
  productId: number;
  productVariantId: number | null;
  batchNumber: string | null;
  expiryDate: string | null;
  remainingQuantity: number;
  purchasePrice: number;
}

export interface InventoryMovement {
  date: string;
  type: string;
  quantity: number;
  reference: string;
}

export interface InventoryLineDetail {
  productId: number;
  productName: string;
  productVariantId: number | null;
  variantName: string | null;
  batchId: number | null;
  batchNumber: string | null;
  quantity: number;
  quantityBefore?: number;
  quantityAfter?: number;
  unitCost?: number | null;
}

export interface StockTransfer {
  id: number;
  transferNumber: string;
  sourceLocationId: number;
  sourceLocationName: string;
  destinationLocationId: number;
  destinationLocationName: string;
  transferDate: string;
  status: "PENDING" | "RECEIVED";
  remarks: string | null;
  createdAt: string;
  lines: InventoryLineDetail[];
}

export interface StockAdjustment {
  id: number;
  adjustmentNumber: string;
  locationId: number;
  locationName: string;
  adjustmentDate: string;
  adjustmentType: "FOUND" | "DAMAGED" | "EXPIRED" | "LOST";
  reason: string;
  status: "POSTED" | "DISPOSED";
  writtenOffAt: string | null;
  expenseId: number | null;
  lines: InventoryLineDetail[];
}

export interface OpeningStockResult { transactionIds: number[]; message: string }
export interface AdjustmentResult {
  id: number;
  adjustmentNumber: string;
  status: string;
  expense?: { expenseId: number; expenseNumber: string; amount: number; category: string } | null;
}
export interface TransferResult { id: number; transferNumber: string; status: string }
