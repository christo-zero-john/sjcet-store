import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductForm } from "./product-form";

describe("product form", () => {
  it("lets a manager add a variant option when the category has none", () => {
    const markup = renderToStaticMarkup(
      <ProductForm
        attributeTypes={[]}
        attributeValues={[]}
        categories={[{ id: "stationery", name: "Stationery" }]}
        categoryAttributes={[]}
      />,
    );

    expect(markup).toContain("Product options");
    expect(markup).toContain("Add product option");
    expect(markup).toContain(
      "Add Colour, Size, or another option when each value needs its own stock.",
    );
  });

  it("separates hierarchy, shared specifications, and sellable variants", () => {
    const markup = renderToStaticMarkup(
      <ProductForm
        attributeTypes={[
          { id: "ink", name: "Ink type" },
          { id: "colour", name: "Colour" },
        ]}
        attributeValues={[
          { id: "ballpoint", attribute_type_id: "ink", value: "Ballpoint" },
          { id: "blue", attribute_type_id: "colour", value: "Blue" },
        ]}
        categories={[
          { id: "stationery", name: "Stationery" },
          { id: "pens", name: "Pens", parent_id: "stationery" },
        ]}
        categoryAttributes={[
          {
            category_id: "stationery",
            attribute_type_id: "ink",
            is_required: true,
            is_variant_axis: false,
          },
          {
            category_id: "pens",
            attribute_type_id: "colour",
            is_required: true,
            is_variant_axis: true,
          },
        ]}
      />,
    );

    expect(markup).toContain("Parent category");
    expect(markup).toContain("Subcategory");
    expect(markup).toContain("Brand");
    expect(markup).toContain("Product specifications");
    expect(markup).toContain("Ink type");
    expect(markup).toContain("Ballpoint");
    expect(markup).toContain("Sellable variants");
    expect(markup).toContain("Colour");
    expect(markup).toContain("Blue");
    expect(markup).toContain("Add variant");
    expect(markup).toContain("Barcode");
    expect(markup).toContain("SKU");
    expect(markup).toContain("Price");
    expect(markup).toContain("Opening stock");
    expect(markup).toContain("+ Create parent category");
    expect(markup).toContain("+ Create subcategory");
  });
});
