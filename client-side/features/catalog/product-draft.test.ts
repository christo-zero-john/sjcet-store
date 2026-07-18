import { describe, expect, it } from "vitest";

import {
  parseProductVariants,
  selectedProductValues,
} from "./product-draft";

function multiColourForm(): FormData {
  const form = new FormData();
  form.set("productAttribute:ink-type", "ballpoint");
  form.set("variant:blue:sku", " pin-blue ");
  form.set("variant:blue:barcode", "890000000001");
  form.set("variant:blue:price", "10.50");
  form.set("variant:blue:openingStock", "20");
  form.set("variant:blue:lowStockThreshold", "5");
  form.set("variant:blue:attribute:colour", "blue-value");
  form.set("variant:black:sku", "pin-black");
  form.set("variant:black:barcode", "");
  form.set("variant:black:price", "10.50");
  form.set("variant:black:openingStock", "12");
  form.set("variant:black:lowStockThreshold", "3");
  form.set("variant:black:attribute:colour", "black-value");
  return form;
}

describe("e-commerce product drafts", () => {
  it("parses independently stocked sellable variants", () => {
    expect(parseProductVariants(multiColourForm())).toEqual([
      {
        clientKey: "blue",
        sku: "PIN-BLUE",
        barcode: "890000000001",
        pricePaise: 1050,
        openingStock: 20,
        lowStockThreshold: 5,
        attributes: { colour: "blue-value" },
      },
      {
        clientKey: "black",
        sku: "PIN-BLACK",
        barcode: null,
        pricePaise: 1050,
        openingStock: 12,
        lowStockThreshold: 3,
        attributes: { colour: "black-value" },
      },
    ]);
  });

  it("separates shared product specifications from variant options", () => {
    expect(selectedProductValues(multiColourForm())).toEqual({
      "ink-type": "ballpoint",
    });
  });

  it("rejects duplicate option combinations", () => {
    const form = multiColourForm();
    form.set("variant:black:attribute:colour", "blue-value");
    expect(() => parseProductVariants(form)).toThrow(
      "Each sellable variant needs a different option combination.",
    );
  });

  it("rejects duplicate SKUs and invalid stock", () => {
    const duplicateSku = multiColourForm();
    duplicateSku.set("variant:black:sku", "PIN-BLUE");
    expect(() => parseProductVariants(duplicateSku)).toThrow(
      "Each sellable variant needs a unique SKU.",
    );

    const invalidStock = multiColourForm();
    invalidStock.set("variant:black:openingStock", "-1");
    expect(() => parseProductVariants(invalidStock)).toThrow(
      "Opening stock cannot be negative.",
    );
  });
});
