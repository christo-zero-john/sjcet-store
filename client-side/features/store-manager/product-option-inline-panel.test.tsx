import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductOptionInlinePanel } from "./product-option-inline-panel";

describe("inline product option editor", () => {
  it("lets category parameters choose required and variant behavior", () => {
    const markup = renderToStaticMarkup(
      <ProductOptionInlinePanel
        attributeTypes={[]}
        categoryId="pens"
        configuredAttributeTypeIds={[]}
        onClose={() => undefined}
        onCreated={() => undefined}
        usableAttributeTypeIds={[]}
      />,
    );

    expect(markup).toContain("Required for new products or variants");
    expect(markup).toContain("Defines independently stocked variants");
    expect(markup).toContain("Display order");
  });

  it("prefills global option data and explains its impact", () => {
    const markup = renderToStaticMarkup(
      <ProductOptionInlinePanel
        attributeType={{ id: "colour", name: "Colour" }}
        attributeTypes={[{ id: "colour", name: "Colour" }]}
        attributeValues={[
          {
            id: "blue",
            attribute_type_id: "colour",
            value: "Blue",
            sort_order: 0,
          },
          {
            id: "black",
            attribute_type_id: "colour",
            value: "Black",
            sort_order: 1,
          },
        ]}
        categoryAttribute={{
          category_id: "pens",
          attribute_type_id: "colour",
          is_required: true,
          is_variant_axis: true,
          sort_order: 0,
        }}
        categoryCount={3}
        categoryId="pens"
        configuredAttributeTypeIds={["colour"]}
        intent="edit"
        onClose={() => undefined}
        onCreated={() => undefined}
        onDetached={() => undefined}
        usage={{ product_count: 0, variant_count: 0, product_ids: [] }}
        usableAttributeTypeIds={["colour"]}
      />,
    );

    expect(markup).toContain("Edit product option");
    expect(markup).toContain("Used by 3 categories");
    expect(markup).toContain("updates every category using it");
    expect(markup).toContain('value="Blue"');
    expect(markup).toContain('value="Black"');
    expect(markup).toContain("+ Add value");
    expect(markup).toContain("Remove from this category");
  });

  it("disables detachment when scoped products use the option", () => {
    const markup = renderToStaticMarkup(
      <ProductOptionInlinePanel
        attributeType={{ id: "colour", name: "Colour" }}
        attributeTypes={[{ id: "colour", name: "Colour" }]}
        attributeValues={[
          {
            id: "blue",
            attribute_type_id: "colour",
            value: "Blue",
            sort_order: 0,
          },
          {
            id: "black",
            attribute_type_id: "colour",
            value: "Black",
            sort_order: 1,
          },
        ]}
        categoryAttribute={{
          category_id: "pens",
          attribute_type_id: "colour",
          is_required: true,
          is_variant_axis: true,
          sort_order: 0,
        }}
        categoryCount={1}
        categoryId="pens"
        configuredAttributeTypeIds={["colour"]}
        intent="edit"
        onClose={() => undefined}
        onCreated={() => undefined}
        onDetached={() => undefined}
        usage={{
          product_count: 2,
          variant_count: 3,
          product_ids: ["one", "two"],
        }}
        valueUsage={{
          blue: {
            product_count: 2,
            variant_count: 3,
            category_count: 0,
            total_count: 5,
            product_ids: ["one", "two"],
          },
        }}
        usableAttributeTypeIds={["colour"]}
      />,
    );

    expect(markup).toContain("2 products use this option");
    expect(markup).toContain("View products");
    expect(markup).toMatch(
      /<button[^>]*disabled[^>]*>Remove from this category<\/button>/,
    );
    expect(markup).toMatch(
      /<button[^>]*disabled[^>]*>Remove value<\/button>/,
    );
    expect(markup).toContain("Used by 2 products");
    expect(markup).toContain("3 variants");
    expect(markup).toContain("View products using Blue");
  });
});
