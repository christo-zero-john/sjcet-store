import { createHash } from "node:crypto";

import type { CounterOrderItemInput, PaymentMethod } from "./contracts";

/**
 * Canonical server-side request fingerprint. Two submissions with the same
 * method, items (order-independent), and cash received hash to the same value,
 * so the database can distinguish an idempotent retry from a conflicting reuse
 * of an idempotency key. The raw payload never appears in the returned hash.
 */
export function fingerprintCounterOrder(
  method: PaymentMethod,
  items: readonly CounterOrderItemInput[],
  cashReceivedPaise?: number,
): string {
  const canonical = JSON.stringify({
    method,
    items: [...items]
      .sort((left, right) => left.variantId.localeCompare(right.variantId))
      .map(({ variantId, quantity, observedPricePaise }) => [
        variantId,
        quantity,
        observedPricePaise,
      ]),
    cashReceivedPaise: cashReceivedPaise ?? null,
  });

  return createHash("sha256").update(canonical).digest("hex");
}
