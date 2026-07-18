"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import type { InlineCategoryState } from "../catalog/actions";
import type {
  CategoryAttributeConfiguration,
  ProductCategory,
} from "../catalog/contracts";
import { CategoryInlinePanel } from "./category-inline-panel";
import { ProductVariantRows } from "./product-variant-rows";

type AttributeType = {
  id: string;
  name: string;
};

type AttributeValue = {
  id: string;
  attribute_type_id: string;
  value: string;
};

type ProductFormProps = Readonly<{
  action?: (formData: FormData) => void | Promise<void>;
  categories: readonly {
    id: string;
    name: string;
    parent_id?: string | null;
  }[];
  attributeTypes: readonly AttributeType[];
  attributeValues: readonly AttributeValue[];
  categoryAttributes: readonly CategoryAttributeConfiguration[];
}>;

type CreatedCategoryResult = InlineCategoryState & {
  category: ProductCategory;
};

export function ProductForm({
  action,
  categories,
  attributeTypes,
  attributeValues,
  categoryAttributes,
}: ProductFormProps) {
  const normalizedCategories = categories.map((category) => ({
    ...category,
    parent_id: category.parent_id ?? null,
  }));
  const initialParent =
    normalizedCategories.find((category) => !category.parent_id)?.id ?? "";
  const initialSubcategory =
    normalizedCategories.find(
      (category) => category.parent_id === initialParent,
    )?.id ?? "";

  const [availableCategories, setAvailableCategories] =
    useState<ProductCategory[]>(normalizedCategories);
  const [availableAttributeTypes, setAvailableAttributeTypes] = useState([
    ...attributeTypes,
  ]);
  const [availableAttributeValues, setAvailableAttributeValues] = useState([
    ...attributeValues,
  ]);
  const [availableCategoryAttributes, setAvailableCategoryAttributes] =
    useState([...categoryAttributes]);
  const [parentId, setParentId] = useState(initialParent);
  const [subcategoryId, setSubcategoryId] = useState(initialSubcategory);
  const [categoryPanelMode, setCategoryPanelMode] = useState<
    "parent" | "subcategory" | null
  >(null);
  const [productName, setProductName] = useState("");

  const rootCategories = availableCategories.filter(
    (category) => !category.parent_id,
  );
  const subcategories = availableCategories.filter(
    (category) => category.parent_id === parentId,
  );
  const finalCategoryId = subcategoryId || parentId;

  const configuredAttributes = useMemo(() => {
    const resolved = new Map<string, CategoryAttributeConfiguration>();
    for (const categoryId of [parentId, finalCategoryId]) {
      if (!categoryId) continue;
      for (const configuration of availableCategoryAttributes) {
        if (configuration.category_id === categoryId) {
          resolved.set(configuration.attribute_type_id, configuration);
        }
      }
    }
    return [...resolved.values()];
  }, [
    availableCategoryAttributes,
    finalCategoryId,
    parentId,
  ]);

  const sharedAttributes = configuredAttributes.filter(
    (configuration) => !configuration.is_variant_axis,
  );
  const variantAttributes = configuredAttributes.filter(
    (configuration) => configuration.is_variant_axis,
  );

  const mergeCreatedCategory = useCallback(
    (result: CreatedCategoryResult) => {
      setAvailableCategories((current) =>
        current.some((category) => category.id === result.category.id)
          ? current
          : [...current, result.category],
      );
      setAvailableAttributeTypes((current) => [
        ...current,
        ...(result.attributeTypes ?? []).filter(
          (type) => !current.some((item) => item.id === type.id),
        ),
      ]);
      setAvailableAttributeValues((current) => [
        ...current,
        ...(result.attributeValues ?? []).filter(
          (value) => !current.some((item) => item.id === value.id),
        ),
      ]);
      setAvailableCategoryAttributes((current) => [
        ...current.filter(
          (configuration) =>
            !(
              configuration.category_id === result.category.id &&
              (result.categoryAttributes ?? []).some(
                (created) =>
                  created.attribute_type_id ===
                  configuration.attribute_type_id,
              )
            ),
        ),
        ...(result.categoryAttributes ?? []),
      ]);
    },
    [],
  );

  const handleIntermediateParent = useCallback(
    (result: CreatedCategoryResult) => {
      mergeCreatedCategory(result);
      setParentId(result.category.id);
      setSubcategoryId("");
    },
    [mergeCreatedCategory],
  );

  const handleCreatedCategory = useCallback(
    (result: CreatedCategoryResult) => {
      mergeCreatedCategory(result);
      if (result.category.parent_id) {
        setParentId(result.category.parent_id);
        setSubcategoryId(result.category.id);
      } else {
        setParentId(result.category.id);
        setSubcategoryId("");
      }
      setCategoryPanelMode(null);
    },
    [mergeCreatedCategory],
  );

  return (
    <>
      <form action={action} autoComplete="off" className="product-form">
        <section className="workspace-card">
          <div className="section-heading">
            <div>
              <span>Product family</span>
              <h2>What are you adding?</h2>
              <p>Shared details apply to every sellable variant.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Product name
              <input
                name="name"
                onChange={(event) => setProductName(event.target.value)}
                required
                value={productName}
              />
            </label>
            <label>
              Brand (optional)
              <input name="brand" />
            </label>
            <label>
              Parent category
              <select
                onChange={(event) => {
                  if (event.target.value === "__new_parent__") {
                    setCategoryPanelMode("parent");
                    return;
                  }
                  const nextParent = event.target.value;
                  setParentId(nextParent);
                  setSubcategoryId(
                    availableCategories.find(
                      (category) => category.parent_id === nextParent,
                    )?.id ?? "",
                  );
                }}
                required
                value={parentId}
              >
                <option value="">Choose parent category</option>
                {rootCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value="__new_parent__">
                  + Create parent category
                </option>
              </select>
            </label>
            <label>
              Subcategory
              <select
                disabled={!parentId}
                onChange={(event) => {
                  if (event.target.value === "__new_subcategory__") {
                    setCategoryPanelMode("subcategory");
                    return;
                  }
                  setSubcategoryId(event.target.value);
                }}
                value={subcategoryId}
              >
                <option value="">Use parent category</option>
                {subcategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value="__new_subcategory__">
                  + Create subcategory
                </option>
              </select>
            </label>
            <input name="categoryId" type="hidden" value={finalCategoryId} />
            <label className="wide-field">
              Description
              <textarea name="description" rows={3} />
            </label>
            <label className="wide-field">
              Primary image (optional)
              <input
                accept="image/jpeg,image/png,image/webp"
                name="primaryImage"
                type="file"
              />
              <small>JPEG, PNG, or WebP up to 5 MB.</small>
            </label>
          </div>
        </section>

        {sharedAttributes.length > 0 ? (
          <section className="workspace-card">
            <div className="section-heading">
              <div>
                <span>Product details</span>
                <h2>Product specifications</h2>
                <p>These details are shared by every sellable variant.</p>
              </div>
            </div>
            <div className="form-grid">
              {sharedAttributes.map((configuration) => {
                const type = availableAttributeTypes.find(
                  (item) =>
                    item.id === configuration.attribute_type_id,
                );
                const values = availableAttributeValues.filter(
                  (item) =>
                    item.attribute_type_id ===
                    configuration.attribute_type_id,
                );
                return (
                  <label key={configuration.attribute_type_id}>
                    {type?.name ?? "Product specification"}
                    <select
                      name={`productAttribute:${configuration.attribute_type_id}`}
                      required={configuration.is_required}
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
        ) : null}

        <ProductVariantRows
          attributeTypes={availableAttributeTypes}
          attributeValues={availableAttributeValues}
          productName={productName}
          variantAttributes={variantAttributes}
        />

        <div className="form-actions">
          <Link className="secondary-button" href="/store-manager/products">
            Cancel
          </Link>
          <button
            className="primary-button"
            disabled={!finalCategoryId}
            type="submit"
          >
            Create product
          </button>
        </div>
      </form>

      {categoryPanelMode ? (
        <CategoryInlinePanel
          attributeTypes={availableAttributeTypes}
          categories={availableCategories}
          initialParentId={parentId}
          mode={categoryPanelMode}
          onClose={() => setCategoryPanelMode(null)}
          onCreated={handleCreatedCategory}
          onIntermediateCreated={handleIntermediateParent}
        />
      ) : null}
    </>
  );
}
