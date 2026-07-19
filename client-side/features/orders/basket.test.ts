import { describe, expect, it } from "vitest";

import {
  addBasketLine,
  basketTotalPaise,
  collectedProgress,
  removeBasketLine,
  setBasketQuantity,
  toCounterOrderItems,
  toggleCollected,
} from "./basket";
import type { BasketLine, SellableVariant } from "./contracts";

function bluePenVariant(): SellableVariant {
  return {
    variantId: "11111111-1111-1111-1111-111111111111",
    productName: "Gel Pen",
    sku: "PEN-BLUE",
    barcode: "890123456789",
    variantDescription: "Blue",
    unitPricePaise: 1250,
    physicalStock: 10,
    reservedStock: 0,
    availableStock: 10,
  };
}

function bluePenLine(overrides: Partial<BasketLine> = {}): BasketLine {
  const variant = bluePenVariant();
  return {
    variantId: variant.variantId,
    productName: variant.productName,
    sku: variant.sku,
    variantDescription: variant.variantDescription,
    unitPricePaise: variant.unitPricePaise,
    availableStock: variant.availableStock,
    quantity: 1,
    collected: false,
    ...overrides,
  };
}

describe("basket reducer", () => {
  it("adds a new variant with quantity one", () => {
    expect(addBasketLine([], bluePenVariant()).at(0)?.quantity).toBe(1);
  });

  it("merges a duplicate variant into one line", () => {
    const withOne = addBasketLine([], bluePenVariant());
    const merged = addBasketLine(withOne, bluePenVariant());
    expect(merged).toHaveLength(1);
    expect(merged.at(0)?.quantity).toBe(2);
  });

  it("does not mutate the input array", () => {
    const lines = [bluePenLine()];
    const next = addBasketLine(lines, bluePenVariant());
    expect(lines.at(0)?.quantity).toBe(1);
    expect(next).not.toBe(lines);
  });

  it("resets collection when quantity changes", () => {
    const result = setBasketQuantity(
      [bluePenLine({ collected: true })],
      bluePenLine().variantId,
      2,
    );
    expect(result.at(0)?.quantity).toBe(2);
    expect(result.at(0)?.collected).toBe(false);
  });

  it("removes a line when quantity reaches zero", () => {
    const result = setBasketQuantity([bluePenLine()], bluePenLine().variantId, 0);
    expect(result).toHaveLength(0);
  });

  it("rejects quantities above available stock", () => {
    expect(() =>
      setBasketQuantity(
        [bluePenLine()],
        bluePenLine().variantId,
        bluePenLine().availableStock + 1,
      ),
    ).toThrow(/Only/);
  });

  it.each([-1, 0.5, Number.NaN])("rejects invalid quantity %s", (quantity) => {
    expect(() =>
      setBasketQuantity([bluePenLine()], bluePenLine().variantId, quantity),
    ).toThrow();
  });

  it("rejects an addition that would exceed available stock", () => {
    const line = bluePenLine({ quantity: 10, availableStock: 10 });
    expect(() => addBasketLine([line], bluePenVariant())).toThrow(/Only/);
  });

  it("toggles collection for one line only", () => {
    const other = bluePenLine({
      variantId: "22222222-2222-2222-2222-222222222222",
    });
    const result = toggleCollected([bluePenLine(), other], bluePenLine().variantId);
    expect(result.at(0)?.collected).toBe(true);
    expect(result.at(1)?.collected).toBe(false);
  });

  it("removes a line and its collected state", () => {
    const result = removeBasketLine(
      [bluePenLine({ collected: true })],
      bluePenLine().variantId,
    );
    expect(result).toHaveLength(0);
  });

  it("sums the basket total in safe integer paise", () => {
    expect(basketTotalPaise([bluePenLine({ quantity: 3 })])).toBe(1250 * 3);
  });

  it("rejects a total that overflows the safe integer range", () => {
    const line = bluePenLine({
      unitPricePaise: Number.MAX_SAFE_INTEGER,
      quantity: 2,
      availableStock: 5,
    });
    expect(() => basketTotalPaise([line])).toThrow();
  });

  it("reports collected progress", () => {
    const collected = bluePenLine({ collected: true });
    const pending = bluePenLine({
      variantId: "22222222-2222-2222-2222-222222222222",
    });
    expect(collectedProgress([collected, pending])).toEqual({
      collected: 1,
      total: 2,
    });
  });

  it("projects only server-authoritative counter items", () => {
    expect(toCounterOrderItems([bluePenLine()])).toEqual([
      {
        variantId: bluePenLine().variantId,
        quantity: 1,
        observedPricePaise: 1250,
      },
    ]);
  });
});
