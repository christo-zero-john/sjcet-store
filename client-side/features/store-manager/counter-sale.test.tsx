import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  cashChangeDuePaise,
  canRotateHandoff,
  collectedAnnouncement,
  CounterSale,
  hasUncollectedLines,
  isVariantAddable,
  parseCashRupeesToPaise,
  type CounterSaleActions,
} from "./counter-sale";
import { OnlineOrderResultView } from "./online-order-result";
import type { BasketLine, OnlineOrderResult, SellableVariant } from "../orders/contracts";

const noopActions: CounterSaleActions = {
  search: async () => ({ ok: true, data: [] }),
  completeCash: async () => ({ ok: false, code: "UNEXPECTED", message: "no" }),
  createOnline: async () => ({ ok: false, code: "UNEXPECTED", message: "no" }),
  rotateHandoff: async () => ({ ok: false, code: "UNEXPECTED", message: "no" }),
};

function line(overrides: Partial<BasketLine> = {}): BasketLine {
  return {
    variantId: "v1",
    productName: "Gel Pen",
    sku: "PEN",
    variantDescription: "Blue",
    unitPricePaise: 1250,
    availableStock: 10,
    quantity: 1,
    collected: false,
    ...overrides,
  };
}

describe("counter-sale helpers", () => {
  it("blocks adding an out-of-stock variant", () => {
    const variant: SellableVariant = {
      variantId: "v1",
      productName: "Gel Pen",
      sku: "PEN",
      barcode: null,
      variantDescription: "Blue",
      unitPricePaise: 1250,
      physicalStock: 0,
      reservedStock: 0,
      availableStock: 0,
    };
    expect(isVariantAddable(variant)).toBe(false);
    expect(isVariantAddable({ ...variant, availableStock: 2 })).toBe(true);
  });

  it("parses rupees into safe integer paise", () => {
    expect(parseCashRupeesToPaise("30")).toBe(3000);
    expect(parseCashRupeesToPaise("30.50")).toBe(3050);
    expect(parseCashRupeesToPaise("abc")).toBeNull();
    expect(parseCashRupeesToPaise("-1")).toBeNull();
    expect(parseCashRupeesToPaise("1.234")).toBeNull();
  });

  it("computes change only when cash covers the total", () => {
    expect(cashChangeDuePaise("30", 2500)).toBe(500);
    expect(cashChangeDuePaise("20", 2500)).toBeNull();
  });

  it("announces collected progress", () => {
    expect(
      collectedAnnouncement([line({ collected: true }), line({ variantId: "v2" })]),
    ).toBe("1 of 2 items collected");
  });

  it("warns while lines remain uncollected", () => {
    expect(hasUncollectedLines([line({ collected: true })])).toBe(false);
    expect(hasUncollectedLines([line()])).toBe(true);
  });

  it("only rotates an awaiting-payment handoff", () => {
    expect(canRotateHandoff("awaiting_payment")).toBe(true);
    expect(canRotateHandoff("paid")).toBe(false);
    expect(canRotateHandoff("cancelled")).toBe(false);
  });
});

describe("CounterSale initial render", () => {
  const markup = renderToStaticMarkup(<CounterSale actions={noopActions} />);

  it("disables checkout while the basket is empty", () => {
    expect(markup).toContain("Take cash payment");
    expect(markup).toMatch(/disabled/);
  });

  it("offers cash and online as a radio group", () => {
    expect(markup).toContain('name="paymentMethod"');
    expect(markup).toContain('value="cash"');
    expect(markup).toContain('value="online"');
  });

  it("labels the total as an estimate confirmed by the server", () => {
    expect(markup).toContain("Estimated total (server confirms at checkout)");
  });

  it("announces collected progress with a live region", () => {
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("0 of 0 items collected");
  });
});

describe("OnlineOrderResultView", () => {
  const result: OnlineOrderResult = {
    order: {
      id: "order-1",
      orderNumber: 1042,
      status: "awaiting_payment",
      paymentMethod: "online",
      currency: "INR",
      subtotalPaise: 2500,
      totalPaise: 2500,
      expiresAt: "2026-07-19T10:30:00.000Z",
      lines: [
        {
          id: "l1",
          variantId: "v1",
          productName: "Gel Pen",
          sku: "PEN",
          variantDescription: "Blue",
          unitPricePaise: 1250,
          quantity: 2,
          lineTotalPaise: 2500,
        },
      ],
    },
    paymentAttemptId: "attempt-1",
    handoffUrl: "https://store.example/pay/raw-token",
    qrDataUrl: "data:image/png;base64,QR",
    expiresAt: "2026-07-19T10:30:00.000Z",
  };

  const markup = renderToStaticMarkup(
    <OnlineOrderResultView
      result={result}
      statusLabel="awaiting payment"
      canRotate
      pending={false}
      onRotate={() => {}}
      onRefresh={() => {}}
      onCancel={() => {}}
      onNewSale={() => {}}
    />,
  );

  it("shows the QR, copyable handoff URL, and status", () => {
    expect(markup).toContain("data:image/png;base64,QR");
    expect(markup).toContain("https://store.example/pay/raw-token");
    expect(markup).toContain("Payment status:");
  });

  it("never renders the provider checkout URL", () => {
    expect(markup).not.toContain("checkout.dodopayments.com");
    expect(markup).not.toContain("dodopayments");
  });
});
