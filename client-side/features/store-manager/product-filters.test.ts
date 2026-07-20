import { describe, expect, it } from "vitest";

import { parseProductIds } from "./product-filters";

describe("product filters", () => {
  it("normalizes the affected-product query", () => {
    expect(parseProductIds(" one,two,one, ,three ")).toEqual(
      new Set(["one", "two", "three"]),
    );
  });

  it("returns an empty filter when no ids were requested", () => {
    expect(parseProductIds(undefined)).toEqual(new Set());
  });
});
