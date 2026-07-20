import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductVariantCard } from "./product-variant-card";

describe("product variant card", () => {
  it("renders one image-aware editor card without a delete action", () => {
    const markup = renderToStaticMarkup(
      <ProductVariantCard
        barcode="890123"
        image={{
          altText: "Blue pen",
          id: "image-blue",
          publicUrl: "https://example.test/blue-pen.webp",
        }}
        isActive
        lowStockThreshold={5}
        optionLabels={["Colour: Blue"]}
        price="₹20.00"
        sku="PEN-BLUE"
        status="healthy"
        stock={50}
      >
        <p>Variant editor</p>
      </ProductVariantCard>,
    );

    expect(markup).toContain("blue-pen.webp");
    expect(markup).toContain("Colour: Blue");
    expect(markup).toContain("PEN-BLUE");
    expect(markup).toContain("₹20.00");
    expect(markup).toContain("50 in stock");
    expect(markup).toContain("Edit variant");
    expect(markup).toContain("Variant editor");
    expect(markup).not.toContain("Delete variant");
  });
});
