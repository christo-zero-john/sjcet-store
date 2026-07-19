import { describe, expect, it, vi } from "vitest";

import {
  cancelOnlineOrder,
  completeCashCounterSale,
  mapDatabaseError,
  searchSellableVariants,
} from "./actions";
import type { OrderActionContext } from "./actions";

const validItem = {
  variantId: "11111111-1111-4111-8111-111111111111",
  quantity: 2,
  observedPricePaise: 1250,
};

function fakeContext(result: {
  data?: unknown;
  error?: { code?: string; message: string } | null;
}): OrderActionContext {
  return {
    rpc: vi.fn(async () => ({
      data: result.data ?? null,
      error: result.error ?? null,
    })),
  };
}

describe("completeCashCounterSale input validation", () => {
  it("rejects an empty basket before calling the database", async () => {
    const context = fakeContext({});
    const result = await completeCashCounterSale(
      { items: [], cashReceivedPaise: 100, operationId: crypto.randomUUID() },
      context,
    );
    expect(result).toMatchObject({ ok: false, code: "EMPTY_BASKET" });
    expect(context.rpc).not.toHaveBeenCalled();
  });

  it("rejects a malformed variant id", async () => {
    const result = await completeCashCounterSale(
      {
        items: [{ ...validItem, variantId: "not-a-uuid" }],
        cashReceivedPaise: 3000,
        operationId: crypto.randomUUID(),
      },
      fakeContext({}),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate variants", async () => {
    const result = await completeCashCounterSale(
      {
        items: [validItem, validItem],
        cashReceivedPaise: 5000,
        operationId: crypto.randomUUID(),
      },
      fakeContext({}),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer quantity", async () => {
    const result = await completeCashCounterSale(
      {
        items: [{ ...validItem, quantity: 1.5 }],
        cashReceivedPaise: 3000,
        operationId: crypto.randomUUID(),
      },
      fakeContext({}),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an unsafe observed price", async () => {
    const result = await completeCashCounterSale(
      {
        items: [{ ...validItem, observedPricePaise: Number.MAX_SAFE_INTEGER + 2 }],
        cashReceivedPaise: 3000,
        operationId: crypto.randomUUID(),
      },
      fakeContext({}),
    );
    expect(result.ok).toBe(false);
  });

  it("maps a database price change to a stable code", async () => {
    const context = fakeContext({
      error: { code: "22023", message: "PRICE_CHANGED: A product price changed." },
    });
    const result = await completeCashCounterSale(
      { items: [validItem], cashReceivedPaise: 5000, operationId: crypto.randomUUID() },
      context,
    );
    expect(result).toMatchObject({ ok: false, code: "PRICE_CHANGED" });
    expect(context.rpc).toHaveBeenCalledWith(
      "complete_cash_counter_sale",
      expect.objectContaining({ cash_received_paise: 5000 }),
    );
  });

  it("returns a cash receipt on success", async () => {
    const context = fakeContext({
      data: {
        order: {
          id: "order-1",
          orderNumber: 5,
          status: "fulfilled",
          paymentMethod: "cash",
          currency: "INR",
          subtotalPaise: 2500,
          totalPaise: 2500,
          expiresAt: null,
          lines: [],
        },
        cashReceivedPaise: 3000,
        changeDuePaise: 500,
      },
    });
    const result = await completeCashCounterSale(
      { items: [validItem], cashReceivedPaise: 3000, operationId: crypto.randomUUID() },
      context,
    );
    expect(result).toMatchObject({
      ok: true,
      data: { changeDuePaise: 500, cashReceivedPaise: 3000 },
    });
  });
});

describe("searchSellableVariants", () => {
  it("rejects an overlong query", async () => {
    const result = await searchSellableVariants("x".repeat(200), fakeContext({}));
    expect(result.ok).toBe(false);
  });

  it("returns sellable variants on success", async () => {
    const context = fakeContext({
      data: [
        {
          variantId: "v1",
          productName: "Gel Pen",
          sku: "PEN",
          barcode: null,
          variantDescription: "Blue",
          unitPricePaise: 1250,
          physicalStock: 10,
          reservedStock: 3,
          availableStock: 7,
        },
      ],
    });
    const result = await searchSellableVariants("pen", context);
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.availableStock).toBe(7);
    }
  });
});

describe("cancelOnlineOrder", () => {
  it("rejects a malformed order id", async () => {
    const result = await cancelOnlineOrder("not-a-uuid", fakeContext({}));
    expect(result.ok).toBe(false);
  });

  it("maps an unauthorized database error", async () => {
    const result = await cancelOnlineOrder(
      "11111111-1111-4111-8111-111111111111",
      fakeContext({ error: { code: "42501", message: "UNAUTHORIZED: nope" } }),
    );
    expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
  });
});

describe("mapDatabaseError", () => {
  it("extracts a known code prefix from the message", () => {
    expect(
      mapDatabaseError({ code: "22023", message: "INSUFFICIENT_STOCK: too few" }),
    ).toMatchObject({ ok: false, code: "INSUFFICIENT_STOCK" });
  });

  it("maps SQLSTATE 42501 to UNAUTHORIZED", () => {
    expect(mapDatabaseError({ code: "42501", message: "denied" })).toMatchObject({
      ok: false,
      code: "UNAUTHORIZED",
    });
  });

  it("falls back to UNEXPECTED", () => {
    expect(mapDatabaseError({ message: "weird" })).toMatchObject({
      ok: false,
      code: "UNEXPECTED",
    });
  });
});
