import { describe, expect, it } from "vitest";

import {
  catalogSlug,
  parseNonNegativeInteger,
  parseStockDelta,
  rupeesToPaise,
} from "./catalog-input";

describe("catalog slugs", () => {
  it("normalizes manager-entered names", () => {
    expect(catalogSlug("  Gel Pens & Refills  ")).toBe("gel-pens-refills");
  });

  it("rejects a name without letters or numbers", () => {
    expect(() => catalogSlug("---")).toThrow("letters or numbers");
  });
});

describe("stock adjustments", () => {
  it.each([
    ["5", 5],
    ["-3", -3],
  ])("parses %s", (value, expected) => {
    expect(parseStockDelta(value)).toBe(expected);
  });

  it.each(["", "0", "1.5"])("rejects %s", (value) => {
    expect(() => parseStockDelta(value)).toThrow("non-zero whole number");
  });
});

describe("stock quantities", () => {
  it("accepts zero and whole numbers", () => {
    expect(parseNonNegativeInteger("0", "Opening stock")).toBe(0);
    expect(parseNonNegativeInteger("12", "Opening stock")).toBe(12);
  });

  it.each(["-1", "1.5", "invalid"])("rejects %s", (value) => {
    expect(() => parseNonNegativeInteger(value, "Opening stock")).toThrow(
      "non-negative whole number",
    );
  });
});

describe("catalog prices", () => {
  it("converts a rupee input to integer paise", () => {
    expect(rupeesToPaise("123.45")).toBe(12345);
  });

  it.each(["", "-1", "1.234", "not-money"])("rejects %s", (value) => {
    expect(() => rupeesToPaise(value)).toThrow("valid non-negative price");
  });
});
