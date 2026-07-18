"use client";

import { useMemo, useState } from "react";

import { bulkAssignVariantAttribute } from "../catalog/product-actions";

type GroupedVariant = Readonly<{
  id: string;
  sku: string;
  price: string;
  stock: number;
  state: string;
}>;

type AttributeType = Readonly<{ id: string; name: string }>;
type AttributeValue = Readonly<{
  id: string;
  attribute_type_id: string;
  value: string;
}>;

type GroupedVariantEditorProps = Readonly<{
  productId: string;
  variants: readonly GroupedVariant[];
  attributeTypes: readonly AttributeType[];
  attributeValues: readonly AttributeValue[];
}>;

export function GroupedVariantEditor({
  productId,
  variants,
  attributeTypes,
  attributeValues,
}: GroupedVariantEditorProps) {
  const [attributeTypeId, setAttributeTypeId] = useState(
    attributeTypes[0]?.id ?? "",
  );
  const availableValues = useMemo(
    () =>
      attributeValues.filter(
        (value) => value.attribute_type_id === attributeTypeId,
      ),
    [attributeTypeId, attributeValues],
  );

  return (
    <details className="workspace-card editor-panel">
      <summary>Edit variants as a group</summary>
      <form action={bulkAssignVariantAttribute} className="grouped-variant-editor">
        <input name="productId" type="hidden" value={productId} />
        <div className="grouped-variant-rows">
          {variants.map((variant) => (
            <label key={variant.id}>
              <input name="variantIds" type="checkbox" value={variant.id} />
              <span>
                <strong>{variant.sku}</strong>
                <small>
                  {variant.price} · {variant.stock} in stock · {variant.state}
                </small>
              </span>
            </label>
          ))}
        </div>
        <div className="form-grid">
          <label>
            Parameter
            <select
              name="attributeTypeId"
              onChange={(event) => setAttributeTypeId(event.target.value)}
              value={attributeTypeId}
            >
              {attributeTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Default value
            <select name="attributeValueId" required>
              <option value="">Choose value</option>
              {availableValues.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">
          This fills the selected option without creating new variants. The
          whole change is rejected if two variants would become duplicates.
        </p>
        <button className="secondary-button" type="submit">
          Assign to selected variants
        </button>
      </form>
    </details>
  );
}
