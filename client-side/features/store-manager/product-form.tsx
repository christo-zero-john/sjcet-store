"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Category = {
  id: string;
  name: string;
  parent_id?: string | null;
};

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

type ProductFormProps = Readonly<{
  action?: (formData: FormData) => void | Promise<void>;
  categories: readonly Category[];
  attributeTypes: readonly AttributeType[];
  attributeValues: readonly AttributeValue[];
  categoryAttributes: readonly CategoryAttribute[];
}>;

export function ProductForm({
  action,
  categories,
  attributeTypes,
  attributeValues,
  categoryAttributes,
}: ProductFormProps) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");

  const configuredAttributes = useMemo(() => {
    const category = categories.find((item) => item.id === categoryId);
    const applicableCategoryIds = new Set(
      [category?.parent_id, category?.id].filter(Boolean),
    );
    const resolved = new Map<string, CategoryAttribute>();

    for (const config of categoryAttributes) {
      if (applicableCategoryIds.has(config.category_id)) {
        resolved.set(config.attribute_type_id, config);
      }
    }

    return [...resolved.values()].filter((config) => config.is_variant_axis);
  }, [categories, categoryAttributes, categoryId]);

  return (
    <form action={action} className="product-form">
      <section className="workspace-card">
        <div className="section-heading">
          <div>
            <span>Product family</span>
            <h2>Shared information</h2>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Category
            <select
              name="categoryId"
              onChange={(event) => setCategoryId(event.target.value)}
              required
              value={categoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.parent_id ? "↳ " : ""}
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Product name
            <input name="name" required />
          </label>
          <label className="wide-field">
            Description
            <textarea name="description" rows={3} />
          </label>
        </div>
      </section>

      <section className="workspace-card">
        <div className="section-heading">
          <div>
            <span>First sellable variant</span>
            <h2>SKU, price & stock</h2>
          </div>
        </div>
        <div className="form-grid">
          <label>
            SKU
            <input name="sku" required />
          </label>
          <label>
            Price (₹)
            <input inputMode="decimal" name="price" placeholder="0.00" required />
          </label>
          <label>
            Opening stock
            <input min="0" name="openingStock" type="number" defaultValue="0" />
          </label>
          <label>
            Low-stock threshold
            <input
              min="0"
              name="lowStockThreshold"
              type="number"
              defaultValue="0"
            />
          </label>
          {configuredAttributes.map((config) => {
            const type = attributeTypes.find(
              (item) => item.id === config.attribute_type_id,
            );
            const values = attributeValues.filter(
              (item) => item.attribute_type_id === config.attribute_type_id,
            );

            return (
              <label key={config.attribute_type_id}>
                {type?.name ?? "Variant attribute"}
                <select
                  name={`attribute:${config.attribute_type_id}`}
                  required={config.is_required}
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
        </div>
      </section>

      <div className="form-actions">
        <Link className="secondary-button" href="/store-manager/products">
          Cancel
        </Link>
        <button className="primary-button" type="submit">
          Create product
        </button>
      </div>
    </form>
  );
}
