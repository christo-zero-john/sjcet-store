"use client";

import { useEffect, useState } from "react";

import { suggestSku } from "../catalog/sku";

type AttributeType = {
  id: string;
  name: string;
};

type AttributeValue = {
  id: string;
  attribute_type_id: string;
  value: string;
};

type CategoryAttribute = {
  category_id: string;
  attribute_type_id: string;
  is_required: boolean;
  is_variant_axis: boolean;
};

type VariantRow = {
  key: string;
  sku: string;
  barcode: string;
  price: string;
  openingStock: string;
  lowStockThreshold: string;
  attributes: Record<string, string>;
};

type ProductVariantRowsProps = Readonly<{
  productName: string;
  attributeTypes: readonly AttributeType[];
  attributeValues: readonly AttributeValue[];
  variantAttributes: readonly CategoryAttribute[];
}>;

export function retainSelectedAttributes(
  attributes: Readonly<Record<string, string>>,
  selectedAttributeTypeIds: readonly string[],
): Record<string, string> {
  const selected = new Set(selectedAttributeTypeIds);
  return Object.fromEntries(
    Object.entries(attributes).filter(([attributeTypeId]) =>
      selected.has(attributeTypeId),
    ),
  );
}

function newRow(key = crypto.randomUUID()): VariantRow {
  return {
    key,
    sku: "",
    barcode: "",
    price: "",
    openingStock: "0",
    lowStockThreshold: "0",
    attributes: {},
  };
}

export function ProductVariantRows({
  productName,
  attributeTypes,
  attributeValues,
  variantAttributes,
}: ProductVariantRowsProps) {
  const [rows, setRows] = useState<VariantRow[]>([newRow("initial")]);
  const hasVariantOptions = variantAttributes.length > 0;
  const selectedAttributeTypeIds = variantAttributes.map(
    (configuration) => configuration.attribute_type_id,
  );
  const selectedAttributeSignature =
    selectedAttributeTypeIds.toSorted().join(",");

  useEffect(() => {
    // Removing an option is an explicit destructive draft action: clear only
    // that option's nested values while preserving SKU, price, and stock.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows((current) =>
      current.map((row) => {
        const attributes = retainSelectedAttributes(
          row.attributes,
          selectedAttributeTypeIds,
        );
        return Object.keys(attributes).length ===
          Object.keys(row.attributes).length
          ? row
          : { ...row, attributes };
      }),
    );
    // The signature changes only when product-option membership changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAttributeSignature]);

  function updateRow(key: string, change: Partial<VariantRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  }

  function generateRowSku(row: VariantRow) {
    const optionValues = Object.values(row.attributes)
      .map(
        (valueId) =>
          attributeValues.find((value) => value.id === valueId)?.value,
      )
      .filter((value): value is string => Boolean(value));
    updateRow(row.key, {
      sku: suggestSku({ productName, optionValues }),
    });
  }

  return (
    <section className="workspace-card">
      <div className="section-heading">
        <div>
          <span>Selling details</span>
          <h2>{hasVariantOptions ? "Sellable variants" : "Price and stock"}</h2>
          {hasVariantOptions ? (
            <p>Each row has its own SKU, price, and inventory.</p>
          ) : null}
        </div>
        {hasVariantOptions ? (
          <button
            className="secondary-button"
            onClick={() =>
              setRows((current) => [...current, newRow()])
            }
            type="button"
          >
            + Add variant
          </button>
        ) : null}
      </div>

      <div className="product-variant-entry-list">
        {rows.map((row, index) => (
          <fieldset className="product-variant-entry" key={row.key}>
            <legend>
              {hasVariantOptions ? `Variant ${index + 1}` : "Selling details"}
            </legend>
            <div className="form-grid">
              {variantAttributes.map((config) => {
                const type = attributeTypes.find(
                  (item) => item.id === config.attribute_type_id,
                );
                const values = attributeValues.filter(
                  (item) =>
                    item.attribute_type_id === config.attribute_type_id,
                );
                return (
                  <label key={config.attribute_type_id}>
                    {type?.name ?? "Option"}
                    <select
                      name={`variant:${row.key}:attribute:${config.attribute_type_id}`}
                      onChange={(event) =>
                        updateRow(row.key, {
                          attributes: {
                            ...row.attributes,
                            [config.attribute_type_id]: event.target.value,
                          },
                        })
                      }
                      required={config.is_required}
                      value={
                        row.attributes[config.attribute_type_id] ?? ""
                      }
                    >
                      <option value="">Choose value</option>
                      {values.map((value) => (
                        <option key={value.id} value={value.id}>
                          {value.value}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
              <label>
                SKU
                <span className="input-with-action">
                  <input
                    name={`variant:${row.key}:sku`}
                    onChange={(event) =>
                      updateRow(row.key, { sku: event.target.value })
                    }
                    required
                    value={row.sku}
                  />
                  <button
                    className="text-button"
                    disabled={!productName.trim()}
                    onClick={() => generateRowSku(row)}
                    type="button"
                  >
                    Generate SKU
                  </button>
                </span>
              </label>
              <label>
                Barcode (optional)
                <input
                  inputMode="numeric"
                  name={`variant:${row.key}:barcode`}
                  onChange={(event) =>
                    updateRow(row.key, { barcode: event.target.value })
                  }
                  value={row.barcode}
                />
              </label>
              <label>
                Price (₹)
                <input
                  inputMode="decimal"
                  name={`variant:${row.key}:price`}
                  onChange={(event) =>
                    updateRow(row.key, { price: event.target.value })
                  }
                  placeholder="0.00"
                  required
                  value={row.price}
                />
              </label>
              <label>
                Opening stock
                <input
                  min="0"
                  name={`variant:${row.key}:openingStock`}
                  onChange={(event) =>
                    updateRow(row.key, { openingStock: event.target.value })
                  }
                  type="number"
                  value={row.openingStock}
                />
              </label>
              <label>
                Low-stock alert
                <input
                  min="0"
                  name={`variant:${row.key}:lowStockThreshold`}
                  onChange={(event) =>
                    updateRow(row.key, {
                      lowStockThreshold: event.target.value,
                    })
                  }
                  type="number"
                  value={row.lowStockThreshold}
                />
              </label>
              <label className="wide-field">
                Variant image (optional)
                <input
                  accept="image/jpeg,image/png,image/webp"
                  name={`variantImage:${row.key}`}
                  type="file"
                />
              </label>
            </div>
            {hasVariantOptions && rows.length > 1 ? (
              <button
                className="danger-button"
                onClick={() =>
                  setRows((current) =>
                    current.filter((item) => item.key !== row.key),
                  )
                }
                type="button"
              >
                Remove variant
              </button>
            ) : null}
          </fieldset>
        ))}
      </div>
    </section>
  );
}
