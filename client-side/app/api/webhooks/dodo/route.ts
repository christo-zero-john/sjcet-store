import { NextResponse } from "next/server";

import { ProviderCheckoutError, type PaymentProvider } from "../../../../features/payments/contracts";

export type WebhookRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export type WebhookDeps = Readonly<{
  provider: PaymentProvider;
  rpc: WebhookRpc;
}>;

/**
 * Verifies the raw provider webhook before any parsing or database access, then
 * hands the normalized event to the service-role-only processing function. Raw
 * bodies, signatures, secrets, and full URLs are never logged.
 */
export async function handleDodoWebhook(
  request: Request,
  deps: WebhookDeps,
): Promise<Response> {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let event;
  try {
    event = await deps.provider.verifyAndNormalizeWebhook(rawBody, headers);
  } catch (error) {
    if (
      error instanceof ProviderCheckoutError &&
      error.code === "signature_invalid"
    ) {
      return new NextResponse("invalid signature", { status: 401 });
    }
    return new NextResponse("invalid payload", { status: 400 });
  }

  try {
    const { error } = await deps.rpc("process_online_payment_event", {
      provider_name: event.provider,
      provider_event_id: event.eventId,
      event_type: event.type,
      provider_checkout_id: event.checkoutId,
      provider_payment_id: event.paymentId ?? null,
      event_amount_paise: event.amountPaise,
      event_currency: event.currency,
      event_order_id: event.orderId ?? null,
      payload_sha256: event.payloadSha256,
      occurred_at: event.occurredAt,
    });
    if (error) {
      return new NextResponse("processing failed", { status: 500 });
    }
    return new NextResponse("ok", { status: 200 });
  } catch {
    return new NextResponse("processing failed", { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const { getPaymentProvider } = await import(
    "../../../../features/payments/provider"
  );
  const { createSupabaseAdminClient } = await import(
    "../../../../lib/supabase/admin"
  );
  const admin = createSupabaseAdminClient();

  return handleDodoWebhook(request, {
    provider: getPaymentProvider(),
    rpc: async (fn, args) => {
      const { data, error } = await admin.rpc(fn, args);
      return { data, error: error ? { message: error.message } : null };
    },
  });
}
