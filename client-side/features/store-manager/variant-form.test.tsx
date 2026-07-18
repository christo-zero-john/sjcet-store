import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VariantForm } from "./variant-form";

describe("variant form", () => {
  it("renders editable variant fields and dynamic variant axes", () => {
    const markup = renderToStaticMarkup(
      <VariantForm
        attributeTypes={[{ id: "size", name: "Size" }]}
        attributeValues={[
          { id: "medium", attribute_type_id: "size", value: "Medium" },
        ]}
        configuredAttributes={[
          {
            attribute_type_id: "size",
            is_required: true,
            is_variant_axis: true,
          },
        ]}
        productId="product-1"
      />,
    );

    expect(markup).toContain("SKU");
    expect(markup).toContain("Barcode");
    expect(markup).toContain("Price");
    expect(markup).toContain("Opening stock");
    expect(markup).toContain("Low-stock threshold");
    expect(markup).toContain("Size");
    expect(markup).toContain("Medium");
  });
});
