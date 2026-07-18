"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useState,
} from "react";

import {
  createCategoryInline,
  type InlineCategoryState,
} from "../catalog/actions";
import type {
  CatalogAttributeType,
  ProductCategory,
} from "../catalog/contracts";

type ParameterDraft = {
  key: string;
  existingTypeId: string;
  name: string;
  values: string;
  isRequired: boolean;
  isVariantAxis: boolean;
};

type CreatedCategoryState = InlineCategoryState & {
  category: ProductCategory;
};

type CategoryInlinePanelProps = Readonly<{
  categories: readonly ProductCategory[];
  attributeTypes: readonly CatalogAttributeType[];
  mode: "parent" | "subcategory";
  initialParentId?: string;
  onClose: () => void;
  onCreated: (state: CreatedCategoryState) => void;
  onIntermediateCreated?: (state: CreatedCategoryState) => void;
}>;

const INITIAL_STATE: InlineCategoryState = {};

function newDraft(): ParameterDraft {
  return {
    key: crypto.randomUUID(),
    existingTypeId: "",
    name: "",
    values: "",
    isRequired: false,
    isVariantAxis: false,
  };
}

function parameterConfigurations(parameters: readonly ParameterDraft[]) {
  return parameters.map((parameter, index) => ({
    attribute_type_id: parameter.existingTypeId || null,
    name: parameter.existingTypeId ? null : parameter.name,
    values: parameter.existingTypeId
      ? []
      : parameter.values
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
    is_required: parameter.isRequired,
    is_variant_axis: parameter.isVariantAxis,
    sort_order: index,
  }));
}

function ParameterEditor({
  attributeTypes,
  parameters,
  setParameters,
}: Readonly<{
  attributeTypes: readonly CatalogAttributeType[];
  parameters: readonly ParameterDraft[];
  setParameters: React.Dispatch<React.SetStateAction<ParameterDraft[]>>;
}>) {
  return (
    <section className="inline-parameters">
      <div className="section-heading">
        <div>
          <span>Product configuration</span>
          <h3>Parameters</h3>
        </div>
        <button
          className="secondary-button"
          onClick={() => setParameters((current) => [...current, newDraft()])}
          type="button"
        >
          + Add parameter
        </button>
      </div>

      {parameters.map((parameter) => (
        <fieldset key={parameter.key}>
          <legend>Parameter</legend>
          <label>
            Reuse an existing parameter
            <select
              onChange={(event) =>
                setParameters((current) =>
                  current.map((item) =>
                    item.key === parameter.key
                      ? { ...item, existingTypeId: event.target.value }
                      : item,
                  ),
                )
              }
              value={parameter.existingTypeId}
            >
              <option value="">Create a new parameter</option>
              {attributeTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          {!parameter.existingTypeId ? (
            <>
              <label>
                Parameter name
                <input
                  onChange={(event) =>
                    setParameters((current) =>
                      current.map((item) =>
                        item.key === parameter.key
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    )
                  }
                  required
                  value={parameter.name}
                />
              </label>
              <label>
                Allowed values
                <input
                  onChange={(event) =>
                    setParameters((current) =>
                      current.map((item) =>
                        item.key === parameter.key
                          ? { ...item, values: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="Blue, Black, Red…"
                  required
                  value={parameter.values}
                />
                <small>Separate values with commas.</small>
              </label>
            </>
          ) : null}
          <label className="checkbox-field">
            <input
              checked={parameter.isRequired}
              onChange={(event) =>
                setParameters((current) =>
                  current.map((item) =>
                    item.key === parameter.key
                      ? { ...item, isRequired: event.target.checked }
                      : item,
                  ),
                )
              }
              type="checkbox"
            />
            Required for new products
          </label>
          <label className="checkbox-field">
            <input
              checked={parameter.isVariantAxis}
              onChange={(event) =>
                setParameters((current) =>
                  current.map((item) =>
                    item.key === parameter.key
                      ? { ...item, isVariantAxis: event.target.checked }
                      : item,
                  ),
                )
              }
              type="checkbox"
            />
            Defines independently stocked variants
          </label>
          <button
            className="text-button"
            onClick={() =>
              setParameters((current) =>
                current.filter((item) => item.key !== parameter.key),
              )
            }
            type="button"
          >
            Remove parameter
          </button>
        </fieldset>
      ))}
    </section>
  );
}

export function CategoryInlinePanel({
  categories,
  attributeTypes,
  mode,
  initialParentId = "",
  onClose,
  onCreated,
  onIntermediateCreated,
}: CategoryInlinePanelProps) {
  const [categoryState, categoryAction, categoryPending] = useActionState(
    createCategoryInline,
    INITIAL_STATE,
  );
  const [parameters, setParameters] = useState<ParameterDraft[]>([]);
  const [parentParameters, setParentParameters] = useState<ParameterDraft[]>([]);
  const [availableParents, setAvailableParents] = useState(
    categories.filter((category) => !category.parent_id),
  );
  const [parentId, setParentId] = useState(initialParentId);
  const [creatingParent, setCreatingParent] = useState(false);
  const [parentState, parentAction, parentPending] = useActionState(
    createCategoryInline,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (!parentState.category) return;
    const created = { ...parentState, category: parentState.category };
    startTransition(() => {
      setAvailableParents((current) =>
        current.some((category) => category.id === created.category.id)
          ? current
          : [...current, created.category],
      );
      setParentId(created.category.id);
      setCreatingParent(false);
      onIntermediateCreated?.(created);
    });
  }, [onIntermediateCreated, parentState]);

  useEffect(() => {
    if (categoryState.category) {
      onCreated({ ...categoryState, category: categoryState.category });
    }
  }, [categoryState, onCreated]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const isSubcategory = mode === "subcategory";

  return (
    <div
      aria-labelledby="new-category-title"
      aria-modal="true"
      className="side-panel"
      role="dialog"
    >
      <button
        aria-label="Close category panel"
        className="side-panel-backdrop"
        onClick={onClose}
        type="button"
      />
      <div className="side-panel-content">
        <header>
          <div>
            <p className="eyebrow">Stay on this product</p>
            <h2 id="new-category-title">
              Add new {isSubcategory ? "subcategory" : "parent category"}
            </h2>
          </div>
          <button
            aria-label="Close category panel"
            className="text-button"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>

        {creatingParent ? (
          <form action={parentAction} autoComplete="off">
            <div className="nested-category-heading">
              <div>
                <p className="eyebrow">New hierarchy root</p>
                <h3>Create parent category</h3>
              </div>
              <button
                className="text-button"
                onClick={() => setCreatingParent(false)}
                type="button"
              >
                Back to subcategory
              </button>
            </div>
            {parentState.error ? (
              <p aria-live="polite" className="notice is-error">
                {parentState.error}
              </p>
            ) : null}
            <label>
              Parent category name
              <input autoComplete="off" name="name" required />
            </label>
            <label>
              Description (optional)
              <textarea name="description" rows={3} />
            </label>
            <input name="parentId" type="hidden" value="" />
            <ParameterEditor
              attributeTypes={attributeTypes}
              parameters={parentParameters}
              setParameters={setParentParameters}
            />
            <input
              name="parameterConfigurations"
              type="hidden"
              value={JSON.stringify(
                parameterConfigurations(parentParameters),
              )}
            />
            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={() => setCreatingParent(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={parentPending}
                type="submit"
              >
                {parentPending ? "Saving…" : "Save parent and continue"}
              </button>
            </div>
          </form>
        ) : null}

        <form
          action={categoryAction}
          autoComplete="off"
          hidden={creatingParent}
        >
          {categoryState.error ? (
            <p aria-live="polite" className="notice is-error">
              {categoryState.error}
            </p>
          ) : null}
          <label>
            {isSubcategory ? "Subcategory name" : "Parent category name"}
            <input autoComplete="off" name="name" required />
          </label>
          {isSubcategory ? (
            <label>
              Parent category
              <select
                name="parentId"
                onChange={(event) => {
                  if (event.target.value === "__new_parent__") {
                    setCreatingParent(true);
                    return;
                  }
                  setParentId(event.target.value);
                }}
                required
                value={parentId}
              >
                <option value="">Choose parent category</option>
                {availableParents.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value="__new_parent__">
                  + Create parent category
                </option>
              </select>
            </label>
          ) : (
            <input name="parentId" type="hidden" value="" />
          )}
          <label>
            Description (optional)
            <textarea name="description" rows={3} />
          </label>
          <ParameterEditor
            attributeTypes={attributeTypes}
            parameters={parameters}
            setParameters={setParameters}
          />
          <input
            name="parameterConfigurations"
            type="hidden"
            value={JSON.stringify(parameterConfigurations(parameters))}
          />
          <div className="form-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={categoryPending}
              type="submit"
            >
              {categoryPending
                ? "Saving…"
                : `Save and select ${
                    isSubcategory ? "subcategory" : "parent category"
                  }`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
