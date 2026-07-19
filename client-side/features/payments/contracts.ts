export type CreateCheckoutInput = Readonly<{
  idempotencyKey: string;
  orderId: string;
  orderNumber: number;
  amountPaise: number;
  currency: "INR";
  returnUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata: Readonly<Record<string, string>>;
}>;

export type CreatedCheckout = Readonly<{
  provider: string;
  checkoutId: string;
  checkoutUrl: string;
}>;

export type NormalizedPaymentEvent = Readonly<{
  provider: string;
  eventId: string;
  type: "processing" | "succeeded" | "failed" | "cancelled";
  checkoutId: string;
  paymentId?: string;
  amountPaise: number;
  currency: string;
  orderId?: string;
  payloadSha256: string;
  occurredAt: string;
}>;

export interface PaymentProvider {
  readonly id: string;
  createCheckout(input: CreateCheckoutInput): Promise<CreatedCheckout>;
  verifyAndNormalizeWebhook(
    rawBody: string,
    headers: Readonly<Record<string, string>>,
  ): Promise<NormalizedPaymentEvent>;
}

export type ProviderCheckoutOutcome = "rejected" | "uncertain";

/**
 * Separates a definitive provider rejection (safe to release reservations)
 * from an ambiguous network/server result (retain reservations and retry with
 * the same idempotency key).
 */
export class ProviderCheckoutError extends Error {
  constructor(
    readonly outcome: ProviderCheckoutOutcome,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProviderCheckoutError";
  }
}
