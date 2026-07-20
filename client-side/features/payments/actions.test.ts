import { describe, expect, it, vi } from "vitest";

import type { PaymentProvider } from "./contracts";
import { ProviderCheckoutError } from "./contracts";
import { runOnlineCheckoutSaga, type OnlineCheckoutDeps } from "./actions";

const items = [
  {
    variantId: "11111111-1111-4111-8111-111111111111",
    quantity: 2,
    observedPricePaise: 1250,
  },
];

function createdOrder() {
  return {
    order: {
      id: "order-1",
      orderNumber: 1042,
      status: "awaiting_payment",
      paymentMethod: "online",
      currency: "INR",
      subtotalPaise: 2500,
      totalPaise: 2500,
      expiresAt: "2026-07-19T10:30:00.000Z",
      lines: [],
    },
    paymentAttemptId: "attempt-1",
    expiresAt: "2026-07-19T10:30:00.000Z",
  };
}

function fakeProvider(overrides: Partial<PaymentProvider> = {}): PaymentProvider {
  return {
    id: "dodo",
    createCheckout: vi.fn(async () => ({
      provider: "dodo",
      checkoutId: "sess_1",
      checkoutUrl: "https://checkout.dodopayments.com/sess_1",
    })),
    verifyAndNormalizeWebhook: vi.fn(),
    ...overrides,
  };
}

function deps(
  rpcImpl: OnlineCheckoutDeps["rpc"],
  provider = fakeProvider(),
): OnlineCheckoutDeps {
  return {
    rpc: rpcImpl,
    provider,
    siteUrl: "https://store.example",
    ttlMinutes: 30,
    generateHandoff: () => ({ rawToken: "raw-token", sha256: "a".repeat(64) }),
    renderQr: async () => "data:image/png;base64,QR",
  };
}

describe("runOnlineCheckoutSaga", () => {
  it("creates, attaches, and returns an application handoff", async () => {
    const rpc = vi.fn(async (fn: string) => {
      if (fn === "create_online_counter_order") {
        return { data: createdOrder(), error: null };
      }
      return { data: { order: createdOrder().order }, error: null };
    });
    const provider = fakeProvider();

    const result = await runOnlineCheckoutSaga(items, crypto.randomUUID(), deps(rpc, provider));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.handoffUrl).toBe("https://store.example/pay/raw-token");
      expect(result.data.qrDataUrl).toContain("data:image/png");
      expect(result.data.handoffUrl).not.toContain("checkout");
    }
    expect(provider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "attempt-1",
        amountPaise: 2500,
        metadata: expect.objectContaining({ module: "store_counter_sale" }),
      }),
    );
  });

  it("fails and releases on a definitive provider rejection", async () => {
    const calls: string[] = [];
    const rpc = vi.fn(async (fn: string) => {
      calls.push(fn);
      if (fn === "create_online_counter_order") {
        return { data: createdOrder(), error: null };
      }
      return { data: null, error: null };
    });
    const provider = fakeProvider({
      createCheckout: vi.fn(async () => {
        throw new ProviderCheckoutError("rejected", "BadRequestError", "bad");
      }),
    });

    const result = await runOnlineCheckoutSaga(items, crypto.randomUUID(), deps(rpc, provider));

    expect(result).toMatchObject({ ok: false, code: "CHECKOUT_CREATE_FAILED" });
    expect(calls).toContain("fail_provider_checkout_creation");
  });

  it("retains the reservation on an ambiguous provider result", async () => {
    const calls: string[] = [];
    const rpc = vi.fn(async (fn: string) => {
      calls.push(fn);
      if (fn === "create_online_counter_order") {
        return { data: createdOrder(), error: null };
      }
      return { data: null, error: null };
    });
    const provider = fakeProvider({
      createCheckout: vi.fn(async () => {
        throw new ProviderCheckoutError("uncertain", "InternalServerError", "timeout");
      }),
    });

    const result = await runOnlineCheckoutSaga(items, crypto.randomUUID(), deps(rpc, provider));

    expect(result).toMatchObject({ ok: false, code: "CHECKOUT_CREATE_FAILED" });
    expect(calls).toContain("record_provider_checkout_uncertain");
    expect(calls).not.toContain("fail_provider_checkout_creation");
  });

  it("maps a database error from order creation", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "23505", message: "IDEMPOTENCY_CONFLICT: reused key" },
    }));

    const result = await runOnlineCheckoutSaga(items, crypto.randomUUID(), deps(rpc));

    expect(result).toMatchObject({ ok: false, code: "IDEMPOTENCY_CONFLICT" });
  });

  it("records reconciliation when attachment fails", async () => {
    const calls: string[] = [];
    const rpc = vi.fn(async (fn: string) => {
      calls.push(fn);
      if (fn === "create_online_counter_order") {
        return { data: createdOrder(), error: null };
      }
      if (fn === "attach_provider_checkout") {
        return { data: null, error: { code: "23505", message: "conflict" } };
      }
      return { data: null, error: null };
    });

    const result = await runOnlineCheckoutSaga(items, crypto.randomUUID(), deps(rpc));

    expect(result).toMatchObject({ ok: false, code: "CHECKOUT_CREATE_FAILED" });
    expect(calls).toContain("record_provider_checkout_uncertain");
  });
});
