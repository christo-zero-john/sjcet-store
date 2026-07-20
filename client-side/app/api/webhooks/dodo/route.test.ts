import { describe, expect, it, vi } from "vitest";

import { ProviderCheckoutError, type PaymentProvider } from "../../../../features/payments/contracts";
import { handleDodoWebhook, type WebhookRpc } from "./route";

function normalizedEvent() {
  return {
    provider: "dodo",
    eventId: "evt_1",
    type: "succeeded" as const,
    checkoutId: "sess_1",
    paymentId: "pay_1",
    amountPaise: 12500,
    currency: "INR",
    orderId: "order-1",
    payloadSha256: "a".repeat(64),
    occurredAt: "2026-07-19T10:00:00.000Z",
  };
}

function provider(overrides: Partial<PaymentProvider> = {}): PaymentProvider {
  return {
    id: "dodo",
    createCheckout: vi.fn(),
    verifyAndNormalizeWebhook: vi.fn(async () => normalizedEvent()),
    ...overrides,
  };
}

function request(body = "{}"): Request {
  return new Request("https://store.example/api/webhooks/dodo", {
    method: "POST",
    body,
    headers: { "webhook-id": "evt_1" },
  });
}

describe("handleDodoWebhook", () => {
  it("verifies the raw body before touching the database", async () => {
    const rpc = vi.fn<WebhookRpc>(async () => ({ data: null, error: null }));
    const p = provider();

    await handleDodoWebhook(request("raw-body"), { provider: p, rpc });

    const verify = p.verifyAndNormalizeWebhook as ReturnType<typeof vi.fn>;
    expect(verify).toHaveBeenCalledWith("raw-body", expect.objectContaining({ "webhook-id": "evt_1" }));
    expect(rpc).toHaveBeenCalledWith(
      "process_online_payment_event",
      expect.objectContaining({ provider_event_id: "evt_1", event_type: "succeeded" }),
    );
  });

  it("returns 401 for a signature failure and never calls the database", async () => {
    const rpc = vi.fn<WebhookRpc>(async () => ({ data: null, error: null }));
    const p = provider({
      verifyAndNormalizeWebhook: vi.fn(async () => {
        throw new ProviderCheckoutError("rejected", "signature_invalid", "bad");
      }),
    });

    const response = await handleDodoWebhook(request(), { provider: p, rpc });

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid payload", async () => {
    const p = provider({
      verifyAndNormalizeWebhook: vi.fn(async () => {
        throw new ProviderCheckoutError("rejected", "invalid_amount", "bad");
      }),
    });

    const response = await handleDodoWebhook(request(), {
      provider: p,
      rpc: vi.fn<WebhookRpc>(async () => ({ data: null, error: null })),
    });

    expect(response.status).toBe(400);
  });

  it("returns a retryable 500 when processing errors", async () => {
    const response = await handleDodoWebhook(request(), {
      provider: provider(),
      rpc: vi.fn<WebhookRpc>(async () => ({ data: null, error: { message: "boom" } })),
    });

    expect(response.status).toBe(500);
  });

  it("returns 200 for a processed event", async () => {
    const response = await handleDodoWebhook(request(), {
      provider: provider(),
      rpc: vi.fn<WebhookRpc>(async () => ({ data: { status: "processed" }, error: null })),
    });

    expect(response.status).toBe(200);
  });

  it("returns 200 for a duplicate event", async () => {
    const response = await handleDodoWebhook(request(), {
      provider: provider(),
      rpc: vi.fn<WebhookRpc>(async () => ({ data: { status: "duplicate" }, error: null })),
    });

    expect(response.status).toBe(200);
  });
});
