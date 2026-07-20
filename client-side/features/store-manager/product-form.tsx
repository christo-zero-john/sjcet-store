"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";

import type {
  InlineCategoryState,
  InlineProductOptionState,
} from "../catalog/actions";
import { loadProductOptionInlineEditor } from "../catalog/actions";
import {
  addProductOption,
  removeProductOption,
} from "../catalog/product-draft";
import type {
  CatalogOptionEditorResult,
  CategoryAttributeConfiguration,
  ProductOptionConfiguration,
  ProductCategory,
} from "../catalog/contracts";
import { CategoryInlinePanel } from "./category-inline-panel";
import { ProductOptionInlinePanel } from "./product-option-inline-panel";
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
    description?: string | null;
  }[];
  attributeTypes: readonly AttributeType[];
  attributeValues: readonly AttributeValue[];
  categoryAttributes: readonly CategoryAttributeConfiguration[];
}>;

type CategoryPanelTarget =
  | { intent: "create"; mode: "parent" | "subcategory" }
  | {
      intent: "edit";
      mode: "parent" | "subcategory";
      categoryId: string;
    };

type OptionPanelTarget =
  | {
      intent: "create";
      context: "category" | "product";
      categoryId: string;
    }
  | {
      intent: "edit";
      context: "category" | "product";
      categoryId: string;
      attributeTypeId: string;
    };

type CreatedCategoryResult = InlineCategoryState & {
  category: ProductCategory;
};

export function effectiveCategoryAttributeTypeIds(
  categories: readonly ProductCategory[],
  configurations: readonly CategoryAttributeConfiguration[],
  categoryId: string,
) {
  const category = categories.find((item) => item.id === categoryId);
  const scope = new Set(
    [category?.parent_id, categoryId].filter(
      (id): id is string => Boolean(id),
    ),
  );
  return [
    ...new Set(
      configurations
        .filter((configuration) => scope.has(configuration.category_id))
        .map((configuration) => configuration.attribute_type_id),
    ),
  ];
}

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
  const [categoryPanelTarget, setCategoryPanelTarget] =
    useState<CategoryPanelTarget | null>(null);
  const [optionPanelTarget, setOptionPanelTarget] =
    useState<OptionPanelTarget | null>(null);
  const [optionEditor, setOptionEditor] =
    useState<CatalogOptionEditorResult | null>(null);
  const [optionLoadError, setOptionLoadError] = useState("");
  const [failedOptionConfiguration, setFailedOptionConfiguration] =
    useState<CategoryAttributeConfiguration | null>(null);
  const [optionLoading, startOptionTransition] = useTransition();
  const [productName, setProductName] = useState("");
  const [selectedProductOptions, setSelectedProductOptions] = useState<
    ProductOptionConfiguration[]
  >([]);

  const rootCategories = availableCategories.filter(
    (category) => !category.parent_id,
  );
  const subcategories = availableCategories.filter(
    (category) => category.parent_id === parentId,
  );
  const finalCategoryId = subcategoryId || parentId;

  const configuredAttributes = selectedProductOptions.map(
    (configuration) => ({
      ...configuration,
      category_id: finalCategoryId,
    }),
  );

  const sharedAttributes = configuredAttributes.filter(
    (configuration) => !configuration.is_variant_axis,
  );
  const variantAttributes = configuredAttributes.filter(
    (configuration) => configuration.is_variant_axis,
  );
  const optionTargetConfiguredAttributeTypeIds = useMemo(
    () =>
      optionPanelTarget?.context === "product"
        ? selectedProductOptions.map(
            (configuration) => configuration.attribute_type_id,
          )
        : optionPanelTarget
        ? effectiveCategoryAttributeTypeIds(
            availableCategories,
            availableCategoryAttributes,
            optionPanelTarget.categoryId,
          )
        : [],
    [
      availableCategories,
      availableCategoryAttributes,
      optionPanelTarget,
      selectedProductOptions,
    ],
  );

  const mergeCreatedCategory = useCallback(
    (result: CreatedCategoryResult) => {
      setAvailableCategories((current) =>
        [
          ...current.filter(
            (category) => category.id !== result.category.id,
          ),
          result.category,
        ],
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
      setCategoryPanelTarget(null);
    },
    [mergeCreatedCategory],
  );

  const handleCreatedOption = useCallback(
    (result: InlineProductOptionState) => {
      setAvailableAttributeTypes((current) => [
        ...current.filter(
          (item) =>
            !(result.attributeTypes ?? []).some(
              (type) => type.id === item.id,
            ),
        ),
        ...(result.attributeTypes ?? []).filter(
          (type) => Boolean(type.id),
        ),
      ]);
      setAvailableAttributeValues((current) => [
        ...current.filter(
          (item) =>
            !(result.attributeTypes ?? []).some(
              (type) => type.id === item.attribute_type_id,
            ),
        ),
        ...(result.attributeValues ?? []),
      ]);
      setAvailableCategoryAttributes((current) => [
        ...current.filter(
          (item) =>
            !(result.categoryAttributes ?? []).some(
              (configuration) =>
                item.category_id === configuration.category_id &&
                item.attribute_type_id ===
                  configuration.attribute_type_id,
            ),
        ),
        ...(result.categoryAttributes ?? []),
      ]);
      if (result.productOption) {
        const productOption = result.productOption;
        setSelectedProductOptions((current) =>
          addProductOption(current, productOption),
        );
      }
      setOptionEditor(null);
      setOptionPanelTarget(null);
    },
    [],
  );

  const handleDetachedOption = useCallback(
    (result: InlineProductOptionState) => {
      setAvailableCategoryAttributes((current) =>
        current.filter(
          (item) =>
            !(
              item.category_id === result.detachedCategoryId &&
              item.attribute_type_id ===
                result.detachedAttributeTypeId
            ),
        ),
      );
      setOptionEditor(null);
      setOptionPanelTarget(null);
    },
    [],
  );

  const openOptionEditor = useCallback(
    (configuration: CategoryAttributeConfiguration) => {
      setOptionLoadError("");
      setFailedOptionConfiguration(null);
      startOptionTransition(async () => {
        const result = await loadProductOptionInlineEditor(
          configuration.category_id,
          configuration.attribute_type_id,
        );
        if (!result.editor) {
          setOptionLoadError(
            result.error ?? "The product option could not be loaded.",
          );
          setFailedOptionConfiguration(configuration);
          return;
        }
        setOptionEditor(result.editor);
        setOptionPanelTarget({
          intent: "edit",
          context: "category",
          categoryId: configuration.category_id,
          attributeTypeId: configuration.attribute_type_id,
        });
      });
    },
    [],
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
                    setCategoryPanelTarget({
                      intent: "create",
                      mode: "parent",
                    });
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
            <button
              aria-label="Edit selected parent category"
              className="text-button category-edit-button"
              disabled={!parentId}
              onClick={() => {
                setCategoryPanelTarget({
                  intent: "edit",
                  mode: "parent",
                  categoryId: parentId,
                });
              }}
              type="button"
            >
              Edit selected parent category
            </button>
            <label>
              Subcategory
              <select
                disabled={!parentId}
                onChange={(event) => {
                  if (event.target.value === "__new_subcategory__") {
                    setCategoryPanelTarget({
                      intent: "create",
                      mode: "subcategory",
                    });
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
            <button
              aria-label="Edit selected subcategory"
              className="text-button category-edit-button"
              disabled={!subcategoryId}
              onClick={() => {
                setCategoryPanelTarget({
                  intent: "edit",
                  mode: "subcategory",
                  categoryId: subcategoryId,
                });
              }}
              type="button"
            >
              Edit selected subcategory
            </button>
            <input name="categoryId" type="hidden" value={finalCategoryId} />
            <input
              name="selectedProductOptions"
              type="hidden"
              value={JSON.stringify(selectedProductOptions)}
            />
            <label className="wide-field">
              Description
              <textarea name="description" rows={3} />
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

        <section className="workspace-card product-options-card">
          <div className="section-heading">
            <div>
              <span>Variants</span>
              <h2>Product options</h2>
              <p>
                Add Colour, Size, or another option when each value needs its
                own stock.
              </p>
            </div>
            <button
              className="secondary-button"
              disabled={!finalCategoryId}
              onClick={() => {
                setOptionEditor(null);
                setOptionPanelTarget({
                  intent: "create",
                  context: "product",
                  categoryId: finalCategoryId,
                });
              }}
              type="button"
            >
              + Add product option
            </button>
          </div>
          {variantAttributes.length > 0 ? (
            <ul className="product-option-list">
              {variantAttributes.map((configuration) => (
                <li key={configuration.attribute_type_id}>
                  <button
                    aria-label={`Edit ${
                      availableAttributeTypes.find(
                        (type) =>
                          type.id === configuration.attribute_type_id,
                      )?.name ?? "product option"
                    }`}
                    className="product-option-chip"
                    disabled={optionLoading}
                    onClick={() => {
                      const attributeType = availableAttributeTypes.find(
                        (type) =>
                          type.id === configuration.attribute_type_id,
                      );
                      if (!attributeType) return;
                      setOptionEditor({
                        attributeType,
                        attributeValues: availableAttributeValues.filter(
                          (value) =>
                            value.attribute_type_id ===
                            configuration.attribute_type_id,
                        ),
                        categoryAttribute: configuration,
                        categoryCount: 0,
                        usage: {
                          product_count: 0,
                          variant_count: 0,
                          product_ids: [],
                        },
                        valueUsage: {},
                      });
                      setOptionPanelTarget({
                        intent: "edit",
                        context: "product",
                        categoryId: finalCategoryId,
                        attributeTypeId:
                          configuration.attribute_type_id,
                      });
                    }}
                    type="button"
                  >
                    {availableAttributeTypes.find(
                      (type) =>
                        type.id === configuration.attribute_type_id,
                    )?.name ?? "Product option"}
                    <span aria-hidden="true">Edit</span>
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      setSelectedProductOptions((current) =>
                        removeProductOption(
                          current,
                          configuration.attribute_type_id,
                        ),
                      )
                    }
                    type="button"
                  >
                    Remove from product
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-inline-state">
              No options yet. Add Colour for pens with separately stocked
              colours.
            </p>
          )}
          {optionLoadError ? (
            <div aria-live="polite" className="notice is-error">
              <p>{optionLoadError}</p>
              {failedOptionConfiguration ? (
                <button
                  className="text-button"
                  disabled={optionLoading}
                  onClick={() =>
                    openOptionEditor(failedOptionConfiguration)
                  }
                  type="button"
                >
                  Retry loading option
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

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

      {categoryPanelTarget ? (
        <CategoryInlinePanel
          attributeTypes={availableAttributeTypes}
          categories={availableCategories}
          categoryAttributes={availableCategoryAttributes}
          category={availableCategories.find(
            (category) =>
              categoryPanelTarget.intent === "edit" &&
              category.id === categoryPanelTarget.categoryId,
          )}
          initialParentId={parentId}
          intent={categoryPanelTarget.intent}
          mode={categoryPanelTarget.mode}
          onClose={() => setCategoryPanelTarget(null)}
          onCreated={handleCreatedCategory}
          onIntermediateCreated={handleIntermediateParent}
          onAddParameter={(categoryId) => {
            setCategoryPanelTarget(null);
            setOptionEditor(null);
            setOptionPanelTarget({
              intent: "create",
              context: "category",
              categoryId,
            });
          }}
          onEditOption={(configuration) => {
            setCategoryPanelTarget(null);
            openOptionEditor(configuration);
          }}
        />
      ) : null}
      {optionPanelTarget ? (
        <ProductOptionInlinePanel
          attributeType={optionEditor?.attributeType}
          attributeTypes={availableAttributeTypes}
          attributeValues={optionEditor?.attributeValues}
          categoryAttribute={optionEditor?.categoryAttribute}
          categoryCount={optionEditor?.categoryCount}
          categoryId={optionPanelTarget.categoryId}
          context={optionPanelTarget.context}
          configuredAttributeTypeIds={
            optionTargetConfiguredAttributeTypeIds
          }
          intent={optionPanelTarget.intent}
          onClose={() => {
            setOptionPanelTarget(null);
            setOptionEditor(null);
          }}
          onCreated={handleCreatedOption}
          onDetached={handleDetachedOption}
          usage={optionEditor?.usage}
          valueUsage={optionEditor?.valueUsage}
        />
      ) : null}
    </>
  );
}
