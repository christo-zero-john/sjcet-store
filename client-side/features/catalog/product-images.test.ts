import { describe, expect, it } from "vitest";

import { productImageObjectPath, validateProductImage } from "./product-images";

describe("product image validation", () => {
  it("accepts JPEG, PNG, and WebP up to 5 MB", () => {
    const file = new File(["image"], "shirt.webp", { type: "image/webp" });
    expect(validateProductImage(file)).toBe(file);
  });

  it("rejects unsupported or oversized files", () => {
    expect(() =>
      validateProductImage(
        new File(["image"], "shirt.gif", { type: "image/gif" }),
      ),
    ).toThrow("JPEG, PNG, or WebP");
    expect(() =>
      validateProductImage(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
          type: "image/png",
        }),
      ),
    ).toThrow("5 MB");
  });

  it("builds a product-owned object path without trusting the filename", () => {
    expect(
      productImageObjectPath("product-id", "image-id", "unsafe name.webp"),
    ).toBe("products/product-id/image-id.webp");
  });
});
