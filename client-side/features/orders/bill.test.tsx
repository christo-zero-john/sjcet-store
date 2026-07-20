import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Bill, isBillPrintable } from "./bill";
import type { FrozenOrder } from "./contracts";

function order(overrides: Partial<FrozenOrder> = {}): FrozenOrder {
  return {
    id: "order-1",
    orderNumber: 1042,
    status: "paid",
    paymentMethod: "cash",
    currency: "INR",
    subtotalPaise: 2500,
    totalPaise: 2500,
    expiresAt: null,
    lines: [
      {
        id: "l1",
        variantId: "v1",
        productName: "Gel Pen",
        sku: "PEN-BLUE",
        variantDescription: "Blue",
        unitPricePaise: 1250,
        quantity: 2,
        lineTotalPaise: 2500,
      },
    ],
    ...overrides,
  };
}

describe("isBillPrintable", () => {
  it("is true for paid and fulfilled orders", () => {
    expect(isBillPrintable(order({ status: "paid" }))).toBe(true);
    expect(isBillPrintable(order({ status: "fulfilled" }))).toBe(true);
  });

  it("is false for unpaid and cancelled orders", () => {
    expect(isBillPrintable(order({ status: "awaiting_payment" }))).toBe(false);
    expect(isBillPrintable(order({ status: "cancelled" }))).toBe(false);
  });
});

describe("Bill", () => {
  it("renders frozen snapshots for a paid order", () => {
    const markup = renderToStaticMarkup(
      <Bill order={order({ status: "fulfilled" })} paidAt="2026-07-19T10:00:00.000Z" />,
    );
    expect(markup).toContain("order #1042");
    expect(markup).toContain("Gel Pen");
    expect(markup).toContain("PEN-BLUE");
    expect(markup).toContain("Paid");
  });

  it("refuses to render an unpaid order as a paid bill", () => {
    const markup = renderToStaticMarkup(
      <Bill order={order({ status: "cancelled" })} paidAt={null} />,
    );
    expect(markup).toContain("cannot be printed");
    expect(markup).not.toContain(">Paid<");
  });
});
