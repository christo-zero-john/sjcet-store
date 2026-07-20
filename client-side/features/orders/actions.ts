import { z } from "zod";

import { fingerprintCounterOrder } from "./fingerprint";
import type {
  CashReceipt,
  CompleteCashCounterSaleInput,
  CreateOnlineCounterOrderInput,
  FrozenOrder,
  OnlineOrderResult,
  OrderErrorCode,
  OrderResult,
  SellableVariant,
} from "./contracts";

export type DatabaseError = { code?: string; message: string };

export type OrderRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: DatabaseError | null }>;

export type OrderActionContext = { rpc: OrderRpc };

const KNOWN_CODES = new Set<OrderErrorCode>([
  "EMPTY_BASKET",
  "INVALID_QUANTITY",
  "VARIANT_UNAVAILABLE",
  "PRICE_CHANGED",
  "INSUFFICIENT_STOCK",
  "IDEMPOTENCY_CONFLICT",
  "ORDER_NOT_PAYABLE",
  "HANDOFF_INVALID",
  "HANDOFF_CLAIMED",
  "HANDOFF_EXPIRED",
  "CHECKOUT_CREATE_FAILED",
  "PROVIDER_EVENT_INVALID",
  "PAYMENT_MISMATCH",
  "UNAUTHORIZED",
  "UNEXPECTED",
]);

function fail(code: OrderErrorCode, message: string): OrderResult<never> {
  return { ok: false, code, message };
}

/**
 * Maps a database error into a stable {@link OrderErrorCode}. Functions raise
 * messages prefixed with the machine code; authorization failures surface as
 * SQLSTATE 42501.
 */
export function mapDatabaseError(error: DatabaseError): OrderResult<never> {
  const message = error.message ?? "";
  const match = /^([A-Z_]+):\s*(.*)$/u.exec(message.trim());
  if (match && KNOWN_CODES.has(match[1] as OrderErrorCode)) {
    return fail(match[1] as OrderErrorCode, match[2] || "Request failed.");
  }
  if (error.code === "42501") {
    return fail("UNAUTHORIZED", "Store-manager access is required.");
  }
  return fail("UNEXPECTED", "Something went wrong. Please try again.");
}

const safeNonNegativeInteger = z
  .number()
  .int()
  .min(0)
  .refine((value) => Number.isSafeInteger(value), "Amount is out of range.");

const itemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(1000),
  observedPricePaise: safeNonNegativeInteger,
});

export const counterItemsSchema = z
  .array(itemSchema)
  .min(1)
  .max(100)
  .refine(
    (items) => new Set(items.map((item) => item.variantId)).size === items.length,
    "A variant cannot appear more than once.",
  );

const operationIdSchema = z.string().uuid();
const searchQuerySchema = z.string().trim().max(100);
const orderIdSchema = z.string().uuid();

function itemsToRpc(
  items: readonly z.infer<typeof itemSchema>[],
): Record<string, unknown>[] {
  return items.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
    observedPricePaise: item.observedPricePaise,
  }));
}

async function defaultContext(): Promise<OrderActionContext> {
  const { requireStoreOperator } = await import("../auth/authorization");
  const { supabase } = await requireStoreOperator();
  return {
    rpc: async (fn, args) => {
      const { data, error } = await supabase.rpc(fn, args);
      return { data, error: error ? { code: error.code, message: error.message } : null };
    },
  };
}

function parseFrozenOrder(value: unknown): FrozenOrder {
  return value as FrozenOrder;
}

export async function searchSellableVariants(
  query: string,
  context?: OrderActionContext,
): Promise<OrderResult<readonly SellableVariant[]>> {
  const parsed = searchQuerySchema.safeParse(query);
  if (!parsed.success) {
    return fail("UNEXPECTED", "Search text is too long.");
  }

  const ctx = context ?? (await defaultContext());
  const { data, error } = await ctx.rpc("search_sellable_variants", {
    search_query: parsed.data,
    result_limit: 30,
  });
  if (error) {
    return mapDatabaseError(error);
  }
  return { ok: true, data: (data as SellableVariant[]) ?? [] };
}

export async function completeCashCounterSale(
  input: CompleteCashCounterSaleInput,
  context?: OrderActionContext,
): Promise<OrderResult<CashReceipt>> {
  const items = counterItemsSchema.safeParse(input.items);
  if (!items.success) {
    return input.items.length === 0
      ? fail("EMPTY_BASKET", "Add at least one product before checkout.")
      : fail("INVALID_QUANTITY", "Review the basket and try again.");
  }

  const operationId = operationIdSchema.safeParse(input.operationId);
  const cashReceived = safeNonNegativeInteger.safeParse(input.cashReceivedPaise);
  if (!operationId.success || !cashReceived.success) {
    return fail("INVALID_QUANTITY", "Enter a valid cash amount.");
  }

  const fingerprint = fingerprintCounterOrder(
    "cash",
    items.data,
    cashReceived.data,
  );

  const ctx = context ?? (await defaultContext());
  const { data, error } = await ctx.rpc("complete_cash_counter_sale", {
    items: itemsToRpc(items.data),
    cash_received_paise: cashReceived.data,
    operation_id: operationId.data,
    request_fingerprint: fingerprint,
  });
  if (error) {
    return mapDatabaseError(error);
  }

  const record = data as {
    order: unknown;
    cashReceivedPaise: number;
    changeDuePaise: number;
  };
  return {
    ok: true,
    data: {
      order: parseFrozenOrder(record.order),
      cashReceivedPaise: record.cashReceivedPaise,
      changeDuePaise: record.changeDuePaise,
    },
  };
}

export async function cancelOnlineOrder(
  orderId: string,
  context?: OrderActionContext,
): Promise<OrderResult<{ orderId: string }>> {
  const parsed = orderIdSchema.safeParse(orderId);
  if (!parsed.success) {
    return fail("ORDER_NOT_PAYABLE", "That order cannot be cancelled.");
  }

  const ctx = context ?? (await defaultContext());
  const { error } = await ctx.rpc("cancel_online_counter_order", {
    target_order_id: parsed.data,
  });
  if (error) {
    return mapDatabaseError(error);
  }
  return { ok: true, data: { orderId: parsed.data } };
}

async function defaultCheckoutDeps(rpc: OrderRpc) {
  const [{ getPaymentProvider }, { getPaymentEnvironment }, { createHandoffToken }, qrcode] =
    await Promise.all([
      import("../payments/provider"),
      import("../payments/environment"),
      import("../payments/handoff"),
      import("qrcode"),
    ]);
  const environment = getPaymentEnvironment();
  return {
    rpc,
    provider: getPaymentProvider(),
    siteUrl: environment.siteUrl,
    ttlMinutes: environment.handoffTtlMinutes,
    generateHandoff: createHandoffToken,
    renderQr: (handoffUrl: string) =>
      qrcode.default.toDataURL(handoffUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 320,
        color: { dark: "#10251A", light: "#FFFFFF" },
      }),
  };
}

export async function createOnlineCounterOrder(
  input: CreateOnlineCounterOrderInput,
  context?: OrderActionContext,
): Promise<OrderResult<OnlineOrderResult>> {
  const items = counterItemsSchema.safeParse(input.items);
  if (!items.success) {
    return input.items.length === 0
      ? fail("EMPTY_BASKET", "Add at least one product before checkout.")
      : fail("INVALID_QUANTITY", "Review the basket and try again.");
  }
  const operationId = operationIdSchema.safeParse(input.operationId);
  if (!operationId.success) {
    return fail("UNEXPECTED", "Retry this sale from a fresh basket.");
  }

  const ctx = context ?? (await defaultContext());
  const { runOnlineCheckoutSaga } = await import("../payments/actions");
  return runOnlineCheckoutSaga(
    items.data,
    operationId.data,
    await defaultCheckoutDeps(ctx.rpc),
  );
}

export async function retryOnlinePayment(
  input: { orderId: string; operationId: string },
  context?: OrderActionContext,
): Promise<OrderResult<OnlineOrderResult>> {
  const orderId = orderIdSchema.safeParse(input.orderId);
  const operationId = operationIdSchema.safeParse(input.operationId);
  if (!orderId.success || !operationId.success) {
    return fail("ORDER_NOT_PAYABLE", "That order cannot be retried.");
  }

  const ctx = context ?? (await defaultContext());
  const { runRestartCheckoutSaga } = await import("../payments/actions");
  return runRestartCheckoutSaga(
    orderId.data,
    operationId.data,
    await defaultCheckoutDeps(ctx.rpc),
  );
}

export async function rotatePaymentHandoff(
  orderId: string,
  context?: OrderActionContext,
): Promise<OrderResult<OnlineOrderResult>> {
  const parsed = orderIdSchema.safeParse(orderId);
  if (!parsed.success) {
    return fail("HANDOFF_INVALID", "That handoff cannot be rotated.");
  }

  const ctx = context ?? (await defaultContext());
  const { runRotateHandoff } = await import("../payments/actions");
  const deps = await defaultCheckoutDeps(ctx.rpc);
  return runRotateHandoff(parsed.data, deps);
}
