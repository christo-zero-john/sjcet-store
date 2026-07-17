import { describe, expect, it } from "vitest";

import { assertPaise, formatPaise } from "./paise";

describe("paise helpers", () => {
  it("formats integer paise as Indian rupees", () => {
    expect(formatPaise(12345)).toBe("₹123.45");
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid paise value %s",
    (value) => {
      expect(() => assertPaise(value)).toThrow("whole non-negative paise");
    },
  );
});
