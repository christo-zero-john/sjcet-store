import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductForm } from "./product-form";

describe("product form", () => {
  it("renders variant price, SKU, stock, and dynamic category fields", () => {
    const markup = renderToStaticMarkup(
      <ProductForm
        attributeTypes={[{ id: "size", name: "Size" }]}
        attributeValues={[
          { id: "medium", attribute_type_id: "size", value: "Medium" },
        ]}
        categories={[{ id: "uniforms", name: "Uniforms" }]}
        categoryAttributes={[
          {
            category_id: "uniforms",
            attribute_type_id: "size",
            is_required: true,
            is_variant_axis: true,
          },
        ]}
      />,
    );

    expect(markup).toContain("SKU");
    expect(markup).toContain("Price");
    expect(markup).toContain("Opening stock");
    expect(markup).toContain("Size");
    expect(markup).toContain("Medium");
  });
});
