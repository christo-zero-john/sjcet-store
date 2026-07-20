import { describe, expect, it } from "vitest";

import { fingerprintCounterOrder } from "./fingerprint";
import type { CounterOrderItemInput } from "./contracts";

const penFirst: readonly CounterOrderItemInput[] = [
  {
    variantId: "11111111-1111-1111-1111-111111111111",
    quantity: 2,
    observedPricePaise: 1250,
  },
  {
    variantId: "22222222-2222-2222-2222-222222222222",
    quantity: 1,
    observedPricePaise: 500,
  },
];

const penSecond: readonly CounterOrderItemInput[] = [penFirst[1], penFirst[0]];

describe("fingerprintCounterOrder", () => {
  it("produces a lowercase 64-character SHA-256 hash", () => {
    const fingerprint = fingerprintCounterOrder("online", penFirst);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ignores input item order", () => {
    expect(fingerprintCounterOrder("online", penFirst)).toBe(
      fingerprintCounterOrder("online", penSecond),
    );
  });

  it("changes when the payment method changes", () => {
    expect(fingerprintCounterOrder("online", penFirst)).not.toBe(
      fingerprintCounterOrder("cash", penFirst),
    );
  });

  it("changes when a quantity changes", () => {
    const bumped = [{ ...penFirst[0], quantity: 3 }, penFirst[1]];
    expect(fingerprintCounterOrder("online", penFirst)).not.toBe(
      fingerprintCounterOrder("online", bumped),
    );
  });

  it("changes when an observed price changes", () => {
    const repriced = [{ ...penFirst[0], observedPricePaise: 1300 }, penFirst[1]];
    expect(fingerprintCounterOrder("online", penFirst)).not.toBe(
      fingerprintCounterOrder("online", repriced),
    );
  });

  it("changes when cash received changes", () => {
    expect(fingerprintCounterOrder("cash", penFirst, 5000)).not.toBe(
      fingerprintCounterOrder("cash", penFirst, 6000),
    );
  });

  it("never contains the raw JSON payload", () => {
    const fingerprint = fingerprintCounterOrder("online", penFirst);
    expect(fingerprint).not.toContain("variantId");
    expect(fingerprint).not.toContain("11111111");
  });
});
