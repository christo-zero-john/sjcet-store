import { describe, expect, it } from "vitest";

import type {
  CreateCheckoutInput,
  CreatedCheckout,
  NormalizedPaymentEvent,
  PaymentProvider,
} from "./contracts";

/**
 * Neutral checkout input used by both the fake provider here and the Dodo
 * adapter contract test. It intentionally references no provider-specific type.
 */
export function sampleCheckoutInput(
  overrides: Partial<CreateCheckoutInput> = {},
): CreateCheckoutInput {
  return {
    idempotencyKey: "attempt-id",
    orderId: "order-id",
    orderNumber: 1042,
    amountPaise: 12500,
    currency: "INR",
    returnUrl: "https://store.example/pay/return/attempt-id",
    cancelUrl: "https://store.example/pay/return/attempt-id?cancelled=1",
    metadata: {
      order_id: "order-id",
      order_number: "1042",
      module: "store_counter_sale",
    },
    ...overrides,
  };
}

/**
 * A provider double that records the neutral checkout input and returns one
 * normalized event, proving orchestration depends only on `PaymentProvider`.
 */
export function createFakeProvider(): PaymentProvider & {
  readonly recordedInputs: readonly CreateCheckoutInput[];
} {
  const recordedInputs: CreateCheckoutInput[] = [];

  return {
    id: "fake",
    recordedInputs,
    async createCheckout(input): Promise<CreatedCheckout> {
      recordedInputs.push(input);
      return {
        provider: "fake",
        checkoutId: `checkout_${input.idempotencyKey}`,
        checkoutUrl: `https://provider.example/checkout/${input.idempotencyKey}`,
      };
    },
    async verifyAndNormalizeWebhook(
      rawBody,
    ): Promise<NormalizedPaymentEvent> {
      const parsed = JSON.parse(rawBody) as {
        eventId: string;
        checkoutId: string;
      };
      return {
        provider: "fake",
        eventId: parsed.eventId,
        type: "succeeded",
        checkoutId: parsed.checkoutId,
        amountPaise: 12500,
        currency: "INR",
        orderId: "order-id",
        payloadSha256: "0".repeat(64),
        occurredAt: "2026-07-19T10:00:00.000Z",
      };
    },
  };
}

/**
 * Reusable conformance suite. Task 6 runs the same assertions against the Dodo
 * adapter with a fake SDK, proving provider replaceability without changing
 * orchestration code.
 */
export function describePaymentProviderContract(
  name: string,
  createProvider: () => PaymentProvider,
  makeWebhook: () => { rawBody: string; headers: Record<string, string> },
): void {
  describe(`${name} satisfies the payment provider contract`, () => {
    it("creates a checkout from neutral input", async () => {
      const provider = createProvider();
      const checkout = await provider.createCheckout(sampleCheckoutInput());
      expect(checkout.provider).toBe(provider.id);
      expect(checkout.checkoutId).toBeTruthy();
      expect(checkout.checkoutUrl).toMatch(/^https:\/\//u);
    });

    it("normalizes a verified webhook", async () => {
      const provider = createProvider();
      const { rawBody, headers } = makeWebhook();
      const event = await provider.verifyAndNormalizeWebhook(rawBody, headers);
      expect(event.provider).toBe(provider.id);
      expect(event.eventId).toBeTruthy();
      expect(event.checkoutId).toBeTruthy();
      expect(["processing", "succeeded", "failed", "cancelled"]).toContain(
        event.type,
      );
      expect(event.payloadSha256).toMatch(/^[a-f0-9]{64}$/u);
    });
  });
}

describePaymentProviderContract(
  "fake provider",
  createFakeProvider,
  () => ({
    rawBody: JSON.stringify({ eventId: "evt_1", checkoutId: "checkout_x" }),
    headers: { "webhook-id": "evt_1" },
  }),
);

describe("fake provider orchestration", () => {
  it("records exactly one neutral checkout input", async () => {
    const provider = createFakeProvider();
    await provider.createCheckout(sampleCheckoutInput());
    expect(provider.recordedInputs).toHaveLength(1);
    expect(provider.recordedInputs[0]?.amountPaise).toBe(12500);
  });
});
