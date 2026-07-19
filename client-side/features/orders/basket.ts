import { assertPaise } from "../../lib/money/paise";

import type {
  BasketLine,
  CounterOrderItemInput,
  SellableVariant,
} from "./contracts";

function assertPositiveIntegerQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError("Quantity must be a positive whole number.");
  }
  return quantity;
}

function assertWithinStock(line: BasketLine, quantity: number): void {
  if (quantity > line.availableStock) {
    throw new RangeError(
      `Only ${line.availableStock} of ${line.productName} (${line.sku}) available.`,
    );
  }
}

function lineFromVariant(variant: SellableVariant): BasketLine {
  return {
    variantId: variant.variantId,
    productName: variant.productName,
    sku: variant.sku,
    variantDescription: variant.variantDescription,
    unitPricePaise: assertPaise(variant.unitPricePaise),
    availableStock: variant.availableStock,
    quantity: 1,
    collected: false,
  };
}

/**
 * Adds a sellable variant to the basket, merging into an existing line and
 * incrementing its quantity. Never exceeds the displayed available stock.
 */
export function addBasketLine(
  lines: readonly BasketLine[],
  variant: SellableVariant,
): readonly BasketLine[] {
  const existing = lines.find((line) => line.variantId === variant.variantId);

  if (!existing) {
    if (variant.availableStock < 1) {
      throw new RangeError(
        `Only ${variant.availableStock} of ${variant.productName} (${variant.sku}) available.`,
      );
    }
    return [...lines, lineFromVariant(variant)];
  }

  const nextQuantity = existing.quantity + 1;
  assertWithinStock(existing, nextQuantity);
  return lines.map((line) =>
    line.variantId === variant.variantId
      ? { ...line, quantity: nextQuantity, collected: false }
      : line,
  );
}

/**
 * Sets a line quantity. Zero removes the line; changing quantity clears the
 * collected flag; quantities above available stock or non-positive integers
 * are rejected.
 */
export function setBasketQuantity(
  lines: readonly BasketLine[],
  variantId: string,
  quantity: number,
): readonly BasketLine[] {
  if (quantity === 0) {
    return removeBasketLine(lines, variantId);
  }

  assertPositiveIntegerQuantity(quantity);

  return lines.map((line) => {
    if (line.variantId !== variantId) {
      return line;
    }
    assertWithinStock(line, quantity);
    return { ...line, quantity, collected: false };
  });
}

export function toggleCollected(
  lines: readonly BasketLine[],
  variantId: string,
): readonly BasketLine[] {
  return lines.map((line) =>
    line.variantId === variantId
      ? { ...line, collected: !line.collected }
      : line,
  );
}

export function removeBasketLine(
  lines: readonly BasketLine[],
  variantId: string,
): readonly BasketLine[] {
  return lines.filter((line) => line.variantId !== variantId);
}

export function basketTotalPaise(lines: readonly BasketLine[]): number {
  return lines.reduce((total, line) => {
    const unit = assertPaise(line.unitPricePaise);
    const lineTotal = unit * assertPositiveIntegerQuantity(line.quantity);
    return assertPaise(total + assertPaise(lineTotal));
  }, 0);
}

export function collectedProgress(
  lines: readonly BasketLine[],
): { collected: number; total: number } {
  return {
    collected: lines.filter((line) => line.collected).length,
    total: lines.length,
  };
}

/**
 * Projects the basket into the only server-authoritative fields. Names, totals,
 * and stock values are intentionally excluded; the server recomputes them.
 */
export function toCounterOrderItems(
  lines: readonly BasketLine[],
): CounterOrderItemInput[] {
  return lines.map((line) => ({
    variantId: line.variantId,
    quantity: line.quantity,
    observedPricePaise: line.unitPricePaise,
  }));
}
