import { requireStoreOperator } from "../auth/authorization";
import type {
  FrozenOrder,
  OrderState,
  PaymentMethod,
  PaymentState,
} from "./contracts";

const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "online"];
const ORDER_STATES: readonly OrderState[] = [
  "draft",
  "awaiting_payment",
  "paid",
  "fulfilled",
  "cancelled",
  "voided",
];
const PAYMENT_STATES: readonly PaymentState[] = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export type OrderHistoryQuery = Readonly<{
  search: string | null;
  paymentMethod: PaymentMethod | null;
  orderState: OrderState | null;
  paymentState: PaymentState | null;
  fromDate: string | null;
  toDate: string | null;
  limit: number;
  cursor: string | null;
}>;

type RawQuery = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function allowlist<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | null {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeOrderHistoryQuery(raw: RawQuery): OrderHistoryQuery {
  const rawLimit = Number.parseInt(single(raw.limit) ?? "", 10);
  const limit = Number.isNaN(rawLimit)
    ? DEFAULT_LIMIT
    : Math.min(Math.max(rawLimit, 1), MAX_LIMIT);
  const search = single(raw.search)?.trim();

  return {
    search: search ? search.slice(0, 100) : null,
    paymentMethod: allowlist(single(raw.paymentMethod), PAYMENT_METHODS),
    orderState: allowlist(single(raw.orderState), ORDER_STATES),
    paymentState: allowlist(single(raw.paymentState), PAYMENT_STATES),
    fromDate: isoDate(single(raw.fromDate)),
    toDate: isoDate(single(raw.toDate)),
    limit,
    cursor: single(raw.cursor),
  };
}

export type OrderCursor = Readonly<{ createdAt: string; id: string }>;

export function encodeOrderCursor(cursor: OrderCursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`, "utf8").toString(
    "base64url",
  );
}

export function decodeOrderCursor(value: string | null): OrderCursor | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const separator = decoded.indexOf("|");
    if (separator <= 0) return null;
    const createdAt = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    if (!createdAt || !id || Number.isNaN(new Date(createdAt).getTime())) {
      return null;
    }
    return { createdAt, id };
  } catch {
    return null;
  }
}

export type OrderHistoryRow = Readonly<{
  id: string;
  orderNumber: number;
  status: OrderState;
  paymentMethod: PaymentMethod;
  totalPaise: number;
  createdAt: string;
  paidAt: string | null;
}>;

export type OrderHistoryPage = Readonly<{
  rows: readonly OrderHistoryRow[];
  nextCursor: string | null;
}>;

export async function getOrderHistory(
  query: OrderHistoryQuery,
): Promise<OrderHistoryPage> {
  const { supabase } = await requireStoreOperator();

  let builder = supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_method, total_paise, created_at, paid_at",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(query.limit + 1);

  if (query.paymentMethod) builder = builder.eq("payment_method", query.paymentMethod);
  if (query.orderState) builder = builder.eq("status", query.orderState);
  if (query.fromDate) builder = builder.gte("created_at", query.fromDate);
  if (query.toDate) builder = builder.lte("created_at", query.toDate);
  if (query.search && /^\d+$/u.test(query.search)) {
    builder = builder.eq("order_number", Number.parseInt(query.search, 10));
  }

  const cursor = decodeOrderCursor(query.cursor);
  if (cursor) {
    builder = builder.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await builder;
  if (error) {
    throw new Error(`Failed to load order history: ${error.message}`);
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id as string,
    orderNumber: row.order_number as number,
    status: row.status as OrderState,
    paymentMethod: row.payment_method as PaymentMethod,
    totalPaise: row.total_paise as number,
    createdAt: row.created_at as string,
    paidAt: (row.paid_at as string | null) ?? null,
  }));

  const hasMore = rows.length > query.limit;
  const visible = hasMore ? rows.slice(0, query.limit) : rows;
  const last = visible.at(-1);
  return {
    rows: visible,
    nextCursor:
      hasMore && last
        ? encodeOrderCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}

export type OrderActivityEntry = Readonly<{
  action: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}>;

export type PaymentAttemptRecord = Readonly<{
  id: string;
  method: PaymentMethod;
  status: PaymentState;
  provider: string | null;
  providerCheckoutId: string | null;
  providerPaymentId: string | null;
  amountPaise: number;
  cashReceivedPaise: number | null;
  changeDuePaise: number | null;
  reconciliationCode: string | null;
  reconciliationMessage: string | null;
  failureCode: string | null;
  createdAt: string;
  succeededAt: string | null;
}>;

export type OrderDetail = Readonly<{
  order: FrozenOrder;
  createdBy: string;
  studentId: string | null;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  attempts: readonly PaymentAttemptRecord[];
  activity: readonly OrderActivityEntry[];
}>;

function mapAttempt(row: Record<string, unknown>): PaymentAttemptRecord {
  return {
    id: row.id as string,
    method: row.method as PaymentMethod,
    status: row.status as PaymentState,
    provider: (row.provider as string | null) ?? null,
    providerCheckoutId: (row.provider_checkout_id as string | null) ?? null,
    providerPaymentId: (row.provider_payment_id as string | null) ?? null,
    amountPaise: row.amount_paise as number,
    cashReceivedPaise: (row.cash_received_paise as number | null) ?? null,
    changeDuePaise: (row.change_due_paise as number | null) ?? null,
    reconciliationCode: (row.reconciliation_code as string | null) ?? null,
    reconciliationMessage: (row.reconciliation_message as string | null) ?? null,
    failureCode: (row.failure_code as string | null) ?? null,
    createdAt: row.created_at as string,
    succeededAt: (row.succeeded_at as string | null) ?? null,
  };
}

function mapFrozenOrder(
  order: Record<string, unknown>,
  lines: readonly Record<string, unknown>[],
): FrozenOrder {
  return {
    id: order.id as string,
    orderNumber: order.order_number as number,
    status: order.status as OrderState,
    paymentMethod: order.payment_method as PaymentMethod,
    currency: "INR",
    subtotalPaise: order.subtotal_paise as number,
    totalPaise: order.total_paise as number,
    expiresAt: (order.expires_at as string | null) ?? null,
    lines: lines.map((line) => ({
      id: line.id as string,
      variantId: line.variant_id as string,
      productName: line.product_name as string,
      sku: line.product_sku as string,
      variantDescription: line.variant_description as string,
      unitPricePaise: line.unit_price_paise as number,
      quantity: line.quantity as number,
      lineTotalPaise: line.line_total_paise as number,
    })),
  };
}

export async function getOrderDetail(
  orderId: string,
): Promise<OrderDetail | null> {
  const { supabase } = await requireStoreOperator();

  const [orderResult, linesResult, attemptsResult, activityResult] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
      supabase
        .from("order_lines")
        .select("*")
        .eq("order_id", orderId)
        .order("product_name", { ascending: true }),
      supabase
        .from("payment_attempts")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
      supabase
        .from("audit_events")
        .select("action, created_at, metadata")
        .eq("entity_id", orderId)
        .order("created_at", { ascending: true }),
    ]);

  const order = orderResult.data;
  if (!order) return null;

  return {
    order: mapFrozenOrder(order, linesResult.data ?? []),
    createdBy: order.created_by as string,
    studentId: (order.student_id as string | null) ?? null,
    createdAt: order.created_at as string,
    paidAt: (order.paid_at as string | null) ?? null,
    fulfilledAt: (order.fulfilled_at as string | null) ?? null,
    cancelledAt: (order.cancelled_at as string | null) ?? null,
    attempts: (attemptsResult.data ?? []).map(mapAttempt),
    activity: (activityResult.data ?? []).map((entry) => ({
      action: entry.action as string,
      createdAt: entry.created_at as string,
      metadata: (entry.metadata as Record<string, unknown>) ?? {},
    })),
  };
}

export async function getOrderBill(
  orderId: string,
): Promise<FrozenOrder | null> {
  const detail = await getOrderDetail(orderId);
  return detail?.order ?? null;
}

export type PaymentHistoryRow = PaymentAttemptRecord &
  Readonly<{ orderId: string; orderNumber: number }>;

export type PaymentHistoryPage = Readonly<{
  rows: readonly PaymentHistoryRow[];
  nextCursor: string | null;
}>;

export async function getPaymentHistory(
  query: OrderHistoryQuery,
): Promise<PaymentHistoryPage> {
  const { supabase } = await requireStoreOperator();

  let builder = supabase
    .from("payment_attempts")
    .select(
      "id, method, status, provider, provider_checkout_id, provider_payment_id, amount_paise, cash_received_paise, change_due_paise, reconciliation_code, reconciliation_message, failure_code, created_at, succeeded_at, order_id, orders!inner(order_number)",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(query.limit + 1);

  if (query.paymentMethod) builder = builder.eq("method", query.paymentMethod);
  if (query.paymentState) builder = builder.eq("status", query.paymentState);

  const cursor = decodeOrderCursor(query.cursor);
  if (cursor) {
    builder = builder.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await builder;
  if (error) {
    throw new Error(`Failed to load payment history: ${error.message}`);
  }

  const rows = (data ?? []).map((row) => {
    const orders = row.orders as { order_number: number } | { order_number: number }[];
    const orderNumber = Array.isArray(orders)
      ? orders[0]?.order_number
      : orders?.order_number;
    return {
      ...mapAttempt(row),
      orderId: row.order_id as string,
      orderNumber: orderNumber as number,
    };
  });

  const hasMore = rows.length > query.limit;
  const visible = hasMore ? rows.slice(0, query.limit) : rows;
  const last = visible.at(-1);
  return {
    rows: visible,
    nextCursor:
      hasMore && last
        ? encodeOrderCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}
