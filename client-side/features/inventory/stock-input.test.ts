import { describe, expect, it } from "vitest";

import {
  parseAddStockTarget,
  parseStockReduction,
  sliderMaximum,
} from "./stock-input";

describe("add-stock targets", () => {
  it("accepts only a count above current stock", () => {
    expect(parseAddStockTarget("18", 12)).toBe(18);
    expect(() => parseAddStockTarget("12", 12)).toThrow("greater");
    expect(() => parseAddStockTarget("11", 12)).toThrow("greater");
  });

  it("expands the slider without moving the entered count", () => {
    expect(sliderMaximum(12, 80, 40)).toBe(80);
  });
});

describe("stock reductions", () => {
  it("returns the resulting count", () => {
    expect(parseStockReduction("4", 12)).toEqual({
      quantityToRemove: 4,
      resultingStock: 8,
    });
  });

  it("rejects zero, fractional, and excessive reductions", () => {
    expect(() => parseStockReduction("0", 12)).toThrow("positive");
    expect(() => parseStockReduction("1.5", 12)).toThrow("positive");
    expect(() => parseStockReduction("13", 12)).toThrow("available");
  });
});
