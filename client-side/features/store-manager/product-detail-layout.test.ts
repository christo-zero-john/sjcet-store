import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "app/store-manager/products/[id]/page.tsx"),
  "utf8",
);

describe("product details layout", () => {
  it("renders variant cards before add-variant and edit-product actions", () => {
    const cards = source.indexOf("<ProductVariantCard");
    const addVariant = source.indexOf("Add variant");
    const editProduct = source.indexOf("Edit product");

    expect(cards).toBeGreaterThan(-1);
    expect(addVariant).toBeGreaterThan(cards);
    expect(editProduct).toBeGreaterThan(addVariant);
    expect(source).not.toContain("ProductMediaEditor");
    expect(source).not.toContain("Product gallery");
  });
});
