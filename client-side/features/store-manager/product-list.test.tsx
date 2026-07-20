import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductList } from "./product-list";

describe("product-first product list", () => {
  it("renders one row per product family and summarizes its variants", () => {
    const markup = renderToStaticMarkup(
      <ProductList
        products={[
          {
            id: "product-1",
            name: "College Shirt",
            categoryName: "Uniforms",
            isActive: true,
            variants: [
              {
                id: "small",
                currentStock: 2,
                lowStockThreshold: 3,
                isActive: true,
              },
              {
                id: "large",
                currentStock: 0,
                lowStockThreshold: 3,
                isActive: true,
              },
            ],
          },
        ]}
      />,
    );

    expect(markup.match(/College Shirt/g)).toHaveLength(1);
    expect(markup).toContain("2 variants");
    expect(markup).toContain("2 total");
    expect(markup).toContain("1 low");
    expect(markup).toContain("1 out");
  });

  it("uses a plain-language empty attention state", () => {
    const markup = renderToStaticMarkup(
      <ProductList
        products={[
          {
            id: "product-1",
            name: "Pen",
            categoryName: "Stationery",
            isActive: true,
            variants: [
              {
                id: "blue",
                currentStock: 50,
                lowStockThreshold: 5,
                isActive: true,
              },
            ],
          },
        ]}
      />,
    );

    expect(markup).toContain("None");
    expect(markup).not.toContain("0 low");
    expect(markup).not.toContain("0 out");
  });
});
