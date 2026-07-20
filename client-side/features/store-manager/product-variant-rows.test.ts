import { describe, expect, it } from "vitest";

import { retainSelectedAttributes } from "./product-variant-rows";

describe("product variant option cleanup", () => {
  it("removes values belonging to an option removed from the product", () => {
    expect(
      retainSelectedAttributes(
        { colour: "red", size: "medium" },
        ["size"],
      ),
    ).toEqual({ size: "medium" });
  });
});
