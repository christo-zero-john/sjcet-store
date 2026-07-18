export type InventoryMutationCode =
  | "VALIDATION_ERROR"
  | "STALE_STOCK"
  | "IDEMPOTENCY_CONFLICT"
  | "UNAUTHORIZED"
  | "UNEXPECTED";

export type InventoryMutationResult =
  | { ok: true; stock: number }
  | { ok: false; code: InventoryMutationCode; message: string; stock?: number };

export type StockOperationInput = Readonly<{
  variantId: string;
  reason: string;
  idempotencyKey: string;
}>;
