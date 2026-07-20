import { createHash } from "node:crypto";

import { BadRequestError, InternalServerError } from "dodopayments";
import { describe, expect, it, vi } from "vitest";

import type { PaymentEnvironment } from "../environment";
import { ProviderCheckoutError } from "../contracts";
import {
  describePaymentProviderContract,
  sampleCheckoutInput,
} from "../provider-contract.test";
import { createDodoProvider, type DodoClientLike } from "./dodo";

function environment(): PaymentEnvironment {
  return {
    provider: "dodo",
    siteUrl: "https://store.example",
    handoffTtlMinutes: 30,
    dodo: {
      apiKey: "secret_key",
      webhookSecret: "secret_webhook",
      environment: "test_mode",
      dynamicProductId: "pwyw_product",
    },
  };
}

function succeededEvent() {
  return {
    type: "payment.succeeded",
    timestamp: "2026-07-19T10:00:00.000Z",
    data: {
      checkout_session_id: "sess_1",
      payment_id: "pay_1",
      total_amount: 12500,
      currency: "INR",
      metadata: { order_id: "order-id" },
    },
  };
}

function fakeClient(overrides: Partial<DodoClientLike> = {}): DodoClientLike {
  return {
    checkoutSessions: {
      create: vi.fn(async () => ({
        session_id: "sess_1",
        checkout_url: "https://checkout.dodopayments.com/sess_1",
      })),
    },
    webhooks: {
      unwrap: vi.fn(() => succeededEvent()),
    },
    ...overrides,
  };
}

describe("Dodo checkout creation", () => {
  it("maps neutral input to one Pay-What-You-Want cart item", async () => {
    const client = fakeClient();
    const provider = createDodoProvider(environment(), client);

    const checkout = await provider.createCheckout(
      sampleCheckoutInput({ customerEmail: "buyer@cs.sjcetpalai.ac.in" }),
    );

    expect(client.checkoutSessions.create).toHaveBeenCalledWith(
      {
        product_cart: [
          { product_id: "pwyw_product", quantity: 1, amount: 12500 },
        ],
        return_url: "https://store.example/pay/return/attempt-id",
        cancel_url: "https://store.example/pay/return/attempt-id?cancelled=1",
        metadata: {
          order_id: "order-id",
          order_number: "1042",
          module: "store_counter_sale",
        },
        customer: { email: "buyer@cs.sjcetpalai.ac.in" },
      },
      { idempotencyKey: "attempt-id" },
    );
    expect(checkout).toEqual({
      provider: "dodo",
      checkoutId: "sess_1",
      checkoutUrl: "https://checkout.dodopayments.com/sess_1",
    });
  });

  it("omits the customer when no email is available", async () => {
    const client = fakeClient();
    const provider = createDodoProvider(environment(), client);

    await provider.createCheckout(sampleCheckoutInput());

    const body = (client.checkoutSessions.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(body).not.toHaveProperty("customer");
  });

  it("maps a definitive provider rejection", async () => {
    const client = fakeClient({
      checkoutSessions: {
        create: vi.fn(async () => {
          throw Object.create(BadRequestError.prototype);
        }),
      },
    });
    const provider = createDodoProvider(environment(), client);

    await expect(provider.createCheckout(sampleCheckoutInput())).rejects.toMatchObject(
      { outcome: "rejected" },
    );
  });

  it("maps an ambiguous provider failure", async () => {
    const client = fakeClient({
      checkoutSessions: {
        create: vi.fn(async () => {
          throw Object.create(InternalServerError.prototype);
        }),
      },
    });
    const provider = createDodoProvider(environment(), client);

    await expect(provider.createCheckout(sampleCheckoutInput())).rejects.toMatchObject(
      { outcome: "uncertain" },
    );
  });
});

describe("Dodo webhook normalization", () => {
  const headers = { "webhook-id": "evt_1" };

  it("normalizes a verified success event", async () => {
    const provider = createDodoProvider(environment(), fakeClient());
    const rawBody = JSON.stringify(succeededEvent());

    const event = await provider.verifyAndNormalizeWebhook(rawBody, headers);

    expect(event).toEqual({
      provider: "dodo",
      eventId: "evt_1",
      type: "succeeded",
      checkoutId: "sess_1",
      paymentId: "pay_1",
      amountPaise: 12500,
      currency: "INR",
      orderId: "order-id",
      payloadSha256: createHash("sha256").update(rawBody, "utf8").digest("hex"),
      occurredAt: "2026-07-19T10:00:00.000Z",
    });
  });

  it.each([
    ["payment.processing", "processing"],
    ["payment.failed", "failed"],
    ["payment.cancelled", "cancelled"],
  ])("normalizes %s", async (dodoType, normalized) => {
    const event = { ...succeededEvent(), type: dodoType };
    const provider = createDodoProvider(
      environment(),
      fakeClient({ webhooks: { unwrap: vi.fn(() => event) } }),
    );
    const result = await provider.verifyAndNormalizeWebhook("{}", headers);
    expect(result.type).toBe(normalized);
  });

  it("rejects a missing event id", async () => {
    const provider = createDodoProvider(environment(), fakeClient());
    await expect(
      provider.verifyAndNormalizeWebhook("{}", {}),
    ).rejects.toBeInstanceOf(ProviderCheckoutError);
  });

  it("rejects an unsupported event type", async () => {
    const provider = createDodoProvider(
      environment(),
      fakeClient({ webhooks: { unwrap: vi.fn(() => ({ type: "subscription.active", data: {} })) } }),
    );
    await expect(
      provider.verifyAndNormalizeWebhook("{}", headers),
    ).rejects.toBeInstanceOf(ProviderCheckoutError);
  });

  it("rejects an invalid amount", async () => {
    const event = { ...succeededEvent(), data: { ...succeededEvent().data, total_amount: -5 } };
    const provider = createDodoProvider(
      environment(),
      fakeClient({ webhooks: { unwrap: vi.fn(() => event) } }),
    );
    await expect(
      provider.verifyAndNormalizeWebhook("{}", headers),
    ).rejects.toBeInstanceOf(ProviderCheckoutError);
  });

  it("rejects a signature failure", async () => {
    const provider = createDodoProvider(
      environment(),
      fakeClient({
        webhooks: {
          unwrap: vi.fn(() => {
            throw new Error("bad signature");
          }),
        },
      }),
    );
    await expect(
      provider.verifyAndNormalizeWebhook("{}", headers),
    ).rejects.toMatchObject({ outcome: "rejected", code: "signature_invalid" });
  });
});

describePaymentProviderContract(
  "dodo adapter",
  () => createDodoProvider(environment(), fakeClient()),
  () => ({
    rawBody: JSON.stringify(succeededEvent()),
    headers: { "webhook-id": "evt_1" },
  }),
);
