import { createHash } from "node:crypto";

import DodoPayments, {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "dodopayments";

import type { PaymentEnvironment } from "../environment";
import {
  ProviderCheckoutError,
  type CreateCheckoutInput,
  type CreatedCheckout,
  type NormalizedPaymentEvent,
  type PaymentProvider,
} from "../contracts";

const PROVIDER_ID = "dodo";

const EVENT_TYPES: Readonly<Record<string, NormalizedPaymentEvent["type"]>> = {
  "payment.processing": "processing",
  "payment.succeeded": "succeeded",
  "payment.failed": "failed",
  "payment.cancelled": "cancelled",
};

/**
 * Minimal structural view of the Dodo SDK client. Tests inject a fake matching
 * this shape so no live SDK call is made.
 */
export type DodoClientLike = {
  checkoutSessions: {
    create(
      body: Record<string, unknown>,
      options: { idempotencyKey: string },
    ): Promise<{ session_id: string; checkout_url?: string | null }>;
  };
  webhooks: {
    unwrap(
      body: string,
      options: { headers: Record<string, string>; key?: string },
    ): unknown;
  };
};

function mapProviderError(error: unknown): ProviderCheckoutError {
  if (
    error instanceof BadRequestError ||
    error instanceof AuthenticationError ||
    error instanceof PermissionDeniedError ||
    error instanceof NotFoundError ||
    error instanceof UnprocessableEntityError
  ) {
    return new ProviderCheckoutError(
      "rejected",
      error.constructor.name,
      "The payment provider rejected the checkout request.",
    );
  }
  if (
    error instanceof APIConnectionError ||
    error instanceof APIConnectionTimeoutError ||
    error instanceof ConflictError ||
    error instanceof RateLimitError ||
    error instanceof InternalServerError
  ) {
    return new ProviderCheckoutError(
      "uncertain",
      error.constructor.name,
      "The payment provider could not confirm the checkout request.",
    );
  }
  return new ProviderCheckoutError(
    "uncertain",
    "unexpected_provider_error",
    "The payment provider request did not complete.",
  );
}

function requireString(value: unknown, code: string, message: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ProviderCheckoutError("rejected", code, message);
  }
  return value;
}

function normalizeEvent(
  event: unknown,
  rawBody: string,
  headers: Readonly<Record<string, string>>,
): NormalizedPaymentEvent {
  const typed = event as {
    type?: string;
    timestamp?: string;
    data?: {
      checkout_session_id?: string | null;
      payment_id?: string | null;
      total_amount?: number | null;
      currency?: string | null;
      metadata?: Record<string, string> | null;
    };
  };

  const type = typed.type ? EVENT_TYPES[typed.type] : undefined;
  if (!type) {
    throw new ProviderCheckoutError(
      "rejected",
      "unsupported_event",
      "Unsupported provider event type.",
    );
  }

  const eventId = requireString(
    headers["webhook-id"],
    "missing_event_id",
    "The provider event is missing an identifier.",
  );
  const checkoutId = requireString(
    typed.data?.checkout_session_id,
    "missing_checkout_id",
    "The provider event is missing a checkout reference.",
  );
  const amountPaise = typed.data?.total_amount;
  if (
    typeof amountPaise !== "number" ||
    !Number.isInteger(amountPaise) ||
    amountPaise < 0
  ) {
    throw new ProviderCheckoutError(
      "rejected",
      "invalid_amount",
      "The provider event carried an invalid amount.",
    );
  }
  const occurredAt = typed.timestamp;
  if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) {
    throw new ProviderCheckoutError(
      "rejected",
      "invalid_timestamp",
      "The provider event carried an invalid timestamp.",
    );
  }

  return {
    provider: PROVIDER_ID,
    eventId,
    type,
    checkoutId,
    paymentId: typed.data?.payment_id ?? undefined,
    amountPaise,
    currency: typed.data?.currency ?? "",
    orderId: typed.data?.metadata?.order_id,
    payloadSha256: createHash("sha256").update(rawBody, "utf8").digest("hex"),
    occurredAt: new Date(occurredAt).toISOString(),
  };
}

export function createDodoProvider(
  environment: PaymentEnvironment,
  client?: DodoClientLike,
): PaymentProvider {
  const dodo: DodoClientLike =
    client ??
    (new DodoPayments({
      bearerToken: environment.dodo.apiKey,
      environment: environment.dodo.environment,
      webhookKey: environment.dodo.webhookSecret,
    }) as unknown as DodoClientLike);

  return {
    id: PROVIDER_ID,
    async createCheckout(input: CreateCheckoutInput): Promise<CreatedCheckout> {
      const body: Record<string, unknown> = {
        product_cart: [
          {
            product_id: environment.dodo.dynamicProductId,
            quantity: 1,
            amount: input.amountPaise,
          },
        ],
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
      };
      if (input.customerEmail) {
        body.customer = { email: input.customerEmail };
      }

      let response: { session_id: string; checkout_url?: string | null };
      try {
        response = await dodo.checkoutSessions.create(body, {
          idempotencyKey: input.idempotencyKey,
        });
      } catch (error) {
        throw mapProviderError(error);
      }

      if (!response.checkout_url) {
        throw new ProviderCheckoutError(
          "uncertain",
          "missing_checkout_url",
          "The payment provider returned no checkout URL.",
        );
      }

      return {
        provider: PROVIDER_ID,
        checkoutId: response.session_id,
        checkoutUrl: response.checkout_url,
      };
    },
    async verifyAndNormalizeWebhook(
      rawBody: string,
      headers: Readonly<Record<string, string>>,
    ): Promise<NormalizedPaymentEvent> {
      let event: unknown;
      try {
        event = dodo.webhooks.unwrap(rawBody, {
          headers: headers as Record<string, string>,
          key: environment.dodo.webhookSecret,
        });
      } catch {
        throw new ProviderCheckoutError(
          "rejected",
          "signature_invalid",
          "The provider webhook signature could not be verified.",
        );
      }
      return normalizeEvent(event, rawBody, headers);
    },
  };
}
