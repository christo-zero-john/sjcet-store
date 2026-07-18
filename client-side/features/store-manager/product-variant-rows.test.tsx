import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductVariantRows } from "./product-variant-rows";

describe("sellable variant rows", () => {
  it("renders independently stocked commerce fields and configured options", () => {
    const markup = renderToStaticMarkup(
      <ProductVariantRows
        attributeTypes={[{ id: "colour", name: "Colour" }]}
        attributeValues={[
          { id: "blue", attribute_type_id: "colour", value: "Blue" },
        ]}
        productName="Pinpoint Pen"
        variantAttributes={[
          {
            category_id: "pens",
            attribute_type_id: "colour",
            is_required: true,
            is_variant_axis: true,
          },
        ]}
      />,
    );

    expect(markup).toContain("Sellable variants");
    expect(markup).toContain("Colour");
    expect(markup).toContain("Barcode");
    expect(markup).toContain("Opening stock");
    expect(markup).toContain("Low-stock alert");
    expect(markup).toContain("Variant image");
    expect(markup).toContain("Add variant");
  });
});
