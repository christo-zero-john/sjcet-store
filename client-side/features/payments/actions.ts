import { fingerprintCounterOrder } from "../orders/fingerprint";
import { mapDatabaseError, type OrderRpc } from "../orders/actions";
import type {
  CounterOrderItemInput,
  FrozenOrder,
  OnlineOrderResult,
  OrderResult,
  PaymentMethod,
} from "../orders/contracts";
import { ProviderCheckoutError, type PaymentProvider } from "./contracts";
import { buildHandoffUrl, hashHandoffToken, type HandoffToken } from "./handoff";

const MODULE_METADATA = "store_counter_sale";

export type ClaimantLine = Readonly<{
  productName: string;
  variantDescription: string;
  sku: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}>;

export type ClaimantOrderView = Readonly<{
  orderNumber: number;
  status: string;
  currency: string;
  totalPaise: number;
  paymentState: string;
  lines: readonly ClaimantLine[];
}>;

export type PaymentReturnStatus = Readonly<{
  paymentState: string;
  orderStatus: string;
  orderNumber: number;
}>;

async function authenticatedRpc() {
  const { requireAuthenticatedUser } = await import("../auth/authorization");
  const { supabase } = await requireAuthenticatedUser();
  return async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(fn, args);
    return {
      data,
      error: error ? { code: error.code, message: error.message } : null,
    };
  };
}

/**
 * Claims (or reopens) a handoff for the authenticated user and returns the
 * frozen, id-free claimant projection.
 */
export async function claimPaymentHandoff(
  rawToken: string,
): Promise<OrderResult<ClaimantOrderView>> {
  const rpc = await authenticatedRpc();
  const { data, error } = await rpc("claim_payment_handoff", {
    handoff_token_sha256: hashHandoffToken(rawToken),
  });
  if (error) return mapDatabaseError(error);
  return { ok: true, data: data as ClaimantOrderView };
}

export async function getPaymentReturnStatus(
  attemptId: string,
): Promise<OrderResult<PaymentReturnStatus>> {
  const rpc = await authenticatedRpc();
  const { data, error } = await rpc("get_payment_return_status", {
    target_attempt_id: attemptId,
  });
  if (error) return mapDatabaseError(error);
  return { ok: true, data: data as PaymentReturnStatus };
}

/**
 * Resolves the server-stored checkout URL for the claimant. The browser never
 * supplies a provider URL; it is read only here, immediately before redirect.
 */
export async function getPaymentRedirectUrl(
  rawToken: string,
): Promise<OrderResult<{ checkoutUrl: string }>> {
  const rpc = await authenticatedRpc();
  const { data, error } = await rpc("get_payment_redirect", {
    handoff_token_sha256: hashHandoffToken(rawToken),
  });
  if (error) return mapDatabaseError(error);
  return { ok: true, data: data as { checkoutUrl: string } };
}

export type OnlineCheckoutDeps = Readonly<{
  rpc: OrderRpc;
  provider: PaymentProvider;
  siteUrl: string;
  ttlMinutes: number;
  generateHandoff: () => HandoffToken;
  renderQr: (handoffUrl: string) => Promise<string>;
  customerEmail?: string;
}>;

type CreatedOnlineOrder = {
  order: FrozenOrder;
  paymentAttemptId: string;
  expiresAt: string;
};

function itemsToRpc(
  items: readonly CounterOrderItemInput[],
): Record<string, unknown>[] {
  return items.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
    observedPricePaise: item.observedPricePaise,
  }));
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function checkoutCreateFailed(message: string): OrderResult<never> {
  return { ok: false, code: "CHECKOUT_CREATE_FAILED", message };
}

async function finalizeResult(
  created: CreatedOnlineOrder,
  handoff: HandoffToken,
  deps: OnlineCheckoutDeps,
): Promise<OrderResult<OnlineOrderResult>> {
  const handoffUrl = buildHandoffUrl(deps.siteUrl, handoff.rawToken);
  const qrDataUrl = await deps.renderQr(handoffUrl);
  return {
    ok: true,
    data: {
      order: created.order,
      paymentAttemptId: created.paymentAttemptId,
      handoffUrl,
      qrDataUrl,
      expiresAt: created.expiresAt,
    },
  };
}

/**
 * The create/attach/fail online-checkout saga. A Postgres transaction cannot
 * include the provider, so the frozen order, attempt, and reservations are
 * created transactionally, the provider is called using only the frozen data,
 * and the checkout is attached in a second transaction. Ambiguous provider
 * results retain the reservation for an idempotent retry.
 */
export async function runOnlineCheckoutSaga(
  items: readonly CounterOrderItemInput[],
  operationId: string,
  deps: OnlineCheckoutDeps,
): Promise<OrderResult<OnlineOrderResult>> {
  const handoff = deps.generateHandoff();
  const fingerprint = fingerprintCounterOrder("online", items);

  const created = await deps.rpc("create_online_counter_order", {
    items: itemsToRpc(items),
    operation_id: operationId,
    request_fingerprint: fingerprint,
    provider_name: deps.provider.id,
    handoff_token_sha256: handoff.sha256,
    reservation_ttl_minutes: deps.ttlMinutes,
  });
  if (created.error) {
    return mapDatabaseError(created.error);
  }
  const order = created.data as CreatedOnlineOrder;

  const returnUrl = `${trimTrailingSlash(deps.siteUrl)}/pay/return/${order.paymentAttemptId}`;
  const cancelUrl = `${returnUrl}?cancelled=1`;

  let checkout;
  try {
    checkout = await deps.provider.createCheckout({
      idempotencyKey: order.paymentAttemptId,
      orderId: order.order.id,
      orderNumber: order.order.orderNumber,
      amountPaise: order.order.totalPaise,
      currency: "INR",
      returnUrl,
      cancelUrl,
      customerEmail: deps.customerEmail,
      metadata: {
        order_id: order.order.id,
        order_number: String(order.order.orderNumber),
        module: MODULE_METADATA,
      },
    });
  } catch (error) {
    if (error instanceof ProviderCheckoutError && error.outcome === "rejected") {
      await deps.rpc("fail_provider_checkout_creation", {
        target_order_id: order.order.id,
        target_attempt_id: order.paymentAttemptId,
        failure_code: error.code,
        failure_message: error.message,
      });
      return checkoutCreateFailed(
        "The payment could not be started. Please try again.",
      );
    }
    await deps.rpc("record_provider_checkout_uncertain", {
      target_order_id: order.order.id,
      target_attempt_id: order.paymentAttemptId,
      reconciliation_code:
        error instanceof ProviderCheckoutError ? error.code : "provider_uncertain",
      reconciliation_message: "Checkout creation did not confirm.",
    });
    return checkoutCreateFailed(
      "The payment provider did not respond. Retry to resume this sale.",
    );
  }

  const attached = await deps.rpc("attach_provider_checkout", {
    target_order_id: order.order.id,
    target_attempt_id: order.paymentAttemptId,
    provider_name: deps.provider.id,
    provider_checkout_id: checkout.checkoutId,
    provider_checkout_url: checkout.checkoutUrl,
    checkout_expires_at: null,
  });
  if (attached.error) {
    await deps.rpc("record_provider_checkout_uncertain", {
      target_order_id: order.order.id,
      target_attempt_id: order.paymentAttemptId,
      reconciliation_code: "attach_failed",
      reconciliation_message: "Attaching the checkout did not confirm.",
    });
    return checkoutCreateFailed(
      "The payment link could not be finalized. Retry to resume this sale.",
    );
  }

  return finalizeResult(order, handoff, deps);
}

/**
 * Restarts an unpaid online order with a fresh attempt, rotated handoff token,
 * and re-run provider checkout. Reuses the same saga after the database
 * reacquires availability.
 */
export async function runRestartCheckoutSaga(
  orderId: string,
  operationId: string,
  deps: OnlineCheckoutDeps,
): Promise<OrderResult<OnlineOrderResult>> {
  const handoff = deps.generateHandoff();
  const restarted = await deps.rpc("restart_online_payment", {
    target_order_id: orderId,
    operation_id: operationId,
    request_fingerprint: fingerprintCounterOrder("online", [], undefined),
    provider_name: deps.provider.id,
    handoff_token_sha256: handoff.sha256,
    reservation_ttl_minutes: deps.ttlMinutes,
  });
  if (restarted.error) {
    return mapDatabaseError(restarted.error);
  }
  const order = restarted.data as CreatedOnlineOrder;

  const returnUrl = `${trimTrailingSlash(deps.siteUrl)}/pay/return/${order.paymentAttemptId}`;
  try {
    const checkout = await deps.provider.createCheckout({
      idempotencyKey: order.paymentAttemptId,
      orderId: order.order.id,
      orderNumber: order.order.orderNumber,
      amountPaise: order.order.totalPaise,
      currency: "INR",
      returnUrl,
      cancelUrl: `${returnUrl}?cancelled=1`,
      customerEmail: deps.customerEmail,
      metadata: {
        order_id: order.order.id,
        order_number: String(order.order.orderNumber),
        module: MODULE_METADATA,
      },
    });
    const attached = await deps.rpc("attach_provider_checkout", {
      target_order_id: order.order.id,
      target_attempt_id: order.paymentAttemptId,
      provider_name: deps.provider.id,
      provider_checkout_id: checkout.checkoutId,
      provider_checkout_url: checkout.checkoutUrl,
      checkout_expires_at: null,
    });
    if (attached.error) {
      return checkoutCreateFailed(
        "The payment link could not be finalized. Retry to resume this sale.",
      );
    }
  } catch {
    return checkoutCreateFailed(
      "The payment provider did not respond. Retry to resume this sale.",
    );
  }

  return finalizeResult(order, handoff, deps);
}

/**
 * Rotates the handoff token for an unclaimed order and returns a new QR without
 * changing frozen lines, totals, or the payment attempt.
 */
export async function runRotateHandoff(
  orderId: string,
  deps: Pick<
    OnlineCheckoutDeps,
    "rpc" | "siteUrl" | "generateHandoff" | "renderQr"
  >,
): Promise<OrderResult<OnlineOrderResult>> {
  const handoff = deps.generateHandoff();
  const rotated = await deps.rpc("rotate_payment_handoff", {
    target_order_id: orderId,
    handoff_token_sha256: handoff.sha256,
  });
  if (rotated.error) {
    return mapDatabaseError(rotated.error);
  }
  const payload = rotated.data as CreatedOnlineOrder;
  const handoffUrl = buildHandoffUrl(deps.siteUrl, handoff.rawToken);
  return {
    ok: true,
    data: {
      order: payload.order,
      paymentAttemptId: payload.paymentAttemptId,
      handoffUrl,
      qrDataUrl: await deps.renderQr(handoffUrl),
      expiresAt: payload.expiresAt,
    },
  };
}

export type { PaymentMethod };
