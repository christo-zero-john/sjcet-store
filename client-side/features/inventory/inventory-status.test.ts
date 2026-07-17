import { describe, expect, it } from "vitest";

import {
  inventoryStatus,
  matchesInventoryFilter,
  normalizeInventoryQuery,
} from "./inventory-status";

describe("inventory status", () => {
  it("distinguishes archived, out, low, and healthy variants", () => {
    expect(inventoryStatus({ isActive: false, stock: 4, threshold: 2 })).toBe(
      "archived",
    );
    expect(inventoryStatus({ isActive: true, stock: 0, threshold: 2 })).toBe(
      "out",
    );
    expect(inventoryStatus({ isActive: true, stock: 2, threshold: 2 })).toBe(
      "low",
    );
    expect(inventoryStatus({ isActive: true, stock: 3, threshold: 2 })).toBe(
      "healthy",
    );
  });

  it("applies stock-state filters without mixing archived variants into alerts", () => {
    expect(
      matchesInventoryFilter(
        { isActive: true, stock: 0, threshold: 2 },
        "attention",
      ),
    ).toBe(true);
    expect(
      matchesInventoryFilter(
        { isActive: false, stock: 0, threshold: 2 },
        "attention",
      ),
    ).toBe(false);
  });
});

describe("inventory query normalization", () => {
  it("trims search and accepts only supported filters and sorts", () => {
    expect(
      normalizeInventoryQuery({
        q: "  GEL pen ",
        status: "low",
        sort: "stock-asc",
      }),
    ).toEqual({ q: "GEL pen", status: "low", sort: "stock-asc" });
  });

  it("falls back safely for unknown query values", () => {
    expect(
      normalizeInventoryQuery({ q: "", status: "broken", sort: "random" }),
    ).toEqual({ q: "", status: "active", sort: "name-asc" });
  });
});
