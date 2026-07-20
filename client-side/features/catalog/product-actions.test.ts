import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "features/catalog/product-actions.ts"),
  "utf8",
);

describe("product creation action composition", () => {
  it("submits the complete family and all explicit variants", () => {
    expect(source).toContain("parseProductVariants");
    expect(source).toContain("selectedProductValues");
    expect(source).toContain("selectedProductOptions");
    expect(source).toContain('rpc("create_product_with_variants"');
    expect(source).toContain("product_brand");
    expect(source).toContain("selected_product_options");
    expect(source).toContain("target_variants");
    expect(source).not.toContain('rpc("create_product_with_variant"');
  });

  it("accepts images only for explicit variants", () => {
    expect(source).not.toContain('formData.get("primaryImage")');
    expect(source).toContain("variantImage:${variant.clientKey}");
    expect(source).toContain(
      'const variantId = formText(formData, "variantId");',
    );
    expect(source).toContain(
      'productDetailError(productId, "Choose a variant for this image.")',
    );
  });
});
