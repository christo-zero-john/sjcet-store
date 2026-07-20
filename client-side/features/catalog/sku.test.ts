import { describe, expect, it } from "vitest";

import { normalizeSku, suggestSku } from "./sku";

describe("SKU normalization", () => {
  it("produces an editable uppercase SKU", () => {
    expect(normalizeSku("  shirt / blue - xl  ")).toBe("SHIRT-BLUE-XL");
  });

  it("rejects a blank SKU", () => {
    expect(() => normalizeSku("---")).toThrow("SKU is required");
  });
});

describe("SKU suggestions", () => {
  it("uses product and option fragments with the supplied suffix", () => {
    expect(
      suggestSku({
        productName: "College Shirt",
        optionValues: ["Blue", "Large"],
        suffix: "7F2A",
      }),
    ).toBe("COLLEGE-SHIRT-BLUE-LARGE-7F2A");
  });
});
