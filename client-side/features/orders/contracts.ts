export type PaymentMethod = "cash" | "online";

export type OrderState =
  | "draft"
  | "awaiting_payment"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "voided";

export type PaymentState =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

export type BasketLine = Readonly<{
  variantId: string;
  productName: string;
  sku: string;
  variantDescription: string;
  unitPricePaise: number;
  availableStock: number;
  quantity: number;
  collected: boolean;
}>;

export type CounterOrderItemInput = Readonly<{
  variantId: string;
  quantity: number;
  observedPricePaise: number;
}>;

export type FrozenOrderLine = Readonly<{
  id: string;
  variantId: string;
  productName: string;
  sku: string;
  variantDescription: string;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
}>;

export type FrozenOrder = Readonly<{
  id: string;
  orderNumber: number;
  status: OrderState;
  paymentMethod: PaymentMethod;
  currency: "INR";
  subtotalPaise: number;
  totalPaise: number;
  expiresAt: string | null;
  lines: readonly FrozenOrderLine[];
}>;

export type SellableVariant = Readonly<{
  variantId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  variantDescription: string;
  unitPricePaise: number;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
}>;

export type OnlineOrderResult = Readonly<{
  order: FrozenOrder;
  paymentAttemptId: string;
  handoffUrl: string;
  qrDataUrl: string;
  expiresAt: string;
}>;

export type CashReceipt = Readonly<{
  order: FrozenOrder;
  cashReceivedPaise: number;
  changeDuePaise: number;
}>;

export type CreateOnlineCounterOrderInput = Readonly<{
  items: readonly CounterOrderItemInput[];
  operationId: string;
}>;

export type CompleteCashCounterSaleInput = Readonly<{
  items: readonly CounterOrderItemInput[];
  cashReceivedPaise: number;
  operationId: string;
}>;

export type OrderErrorCode =
  | "EMPTY_BASKET"
  | "INVALID_QUANTITY"
  | "VARIANT_UNAVAILABLE"
  | "PRICE_CHANGED"
  | "INSUFFICIENT_STOCK"
  | "IDEMPOTENCY_CONFLICT"
  | "ORDER_NOT_PAYABLE"
  | "HANDOFF_INVALID"
  | "HANDOFF_CLAIMED"
  | "HANDOFF_EXPIRED"
  | "CHECKOUT_CREATE_FAILED"
  | "PROVIDER_EVENT_INVALID"
  | "PAYMENT_MISMATCH"
  | "UNAUTHORIZED"
  | "UNEXPECTED";

export type OrderResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: OrderErrorCode; message: string };
