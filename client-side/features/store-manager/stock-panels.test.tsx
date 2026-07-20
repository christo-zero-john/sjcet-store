import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AddStockPanel } from "./add-stock-panel";
import { StockReductionPanel } from "./stock-reduction-panel";

describe("manual stock panels", () => {
  it("keeps add stock increase-only with synchronized controls", () => {
    const markup = renderToStaticMarkup(
      <AddStockPanel
        currentStock={12}
        idempotencyKey="00000000-0000-0000-0000-000000000001"
        productId="product"
        variantId="variant"
      />,
    );

    expect(markup).toContain("New stock count");
    expect(markup).toContain('min="13"');
    expect(markup).toContain('type="range"');
    expect(markup).toContain("Units to add");
  });

  it("keeps reductions separate and requires confirmation", () => {
    const markup = renderToStaticMarkup(
      <StockReductionPanel
        currentStock={12}
        idempotencyKey="00000000-0000-0000-0000-000000000002"
        productId="product"
        variantId="variant"
      />,
    );

    expect(markup).toContain("Quantity to remove");
    expect(markup).toContain("Resulting stock");
    expect(markup).toContain("I confirm this stock reduction");
    expect(markup).not.toContain('type="range"');
  });
});
