"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";

import {
  addProductOptionInline,
  detachProductOptionInline,
  type InlineProductOptionState,
  updateProductOptionInline,
} from "../catalog/actions";
import type {
  CatalogAttributeType,
  CatalogAttributeValue,
  CatalogOptionUsage,
  CategoryAttributeConfiguration,
  CategoryOptionUsage,
} from "../catalog/contracts";

type OptionValueDraft = {
  key: string;
  id: string | null;
  value: string;
};

type ProductOptionInlinePanelProps = Readonly<{
  intent?: "create" | "edit";
  categoryId: string;
  attributeType?: CatalogAttributeType;
  attributeValues?: readonly CatalogAttributeValue[];
  categoryAttribute?: CategoryAttributeConfiguration;
  categoryCount?: number;
  usage?: CategoryOptionUsage;
  valueUsage?: Readonly<Record<string, CatalogOptionUsage>>;
  attributeTypes: readonly CatalogAttributeType[];
  configuredAttributeTypeIds: readonly string[];
  usableAttributeTypeIds: readonly string[];
  onClose: () => void;
  onCreated: (state: InlineProductOptionState) => void;
  onDetached?: (state: InlineProductOptionState) => void;
}>;

const INITIAL_STATE: InlineProductOptionState = {};

function countLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ProductOptionInlinePanel({
  intent = "create",
  categoryId,
  attributeType,
  attributeValues = [],
  categoryAttribute,
  categoryCount = 0,
  usage = { product_count: 0, variant_count: 0, product_ids: [] },
  valueUsage = {},
  attributeTypes,
  configuredAttributeTypeIds,
  usableAttributeTypeIds,
  onClose,
  onCreated,
  onDetached,
}: ProductOptionInlinePanelProps) {
  const editing = intent === "edit";
  const [createState, createAction, createPending] = useActionState(
    addProductOptionInline,
    INITIAL_STATE,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateProductOptionInline,
    INITIAL_STATE,
  );
  const [detachState, detachAction, detachPending] = useActionState(
    detachProductOptionInline,
    INITIAL_STATE,
  );
  const [existingAttributeTypeId, setExistingAttributeTypeId] = useState("");
  const [optionName, setOptionName] = useState(attributeType?.name ?? "");
  const [isRequired, setIsRequired] = useState(
    categoryAttribute?.is_required ?? true,
  );
  const [isVariantAxis, setIsVariantAxis] = useState(
    categoryAttribute?.is_variant_axis ?? true,
  );
  const [sortOrder, setSortOrder] = useState(
    categoryAttribute?.sort_order ?? configuredAttributeTypeIds.length,
  );
  const [values, setValues] = useState<OptionValueDraft[]>(() =>
    attributeValues.map((value) => ({
      key: value.id,
      id: value.id,
      value: value.value,
    })),
  );
  const state = editing ? updateState : createState;
  const pending = editing ? updatePending : createPending;
  const action = editing ? updateAction : createAction;
  const availableTypes = useMemo(() => {
    const configured = new Set(configuredAttributeTypeIds);
    const usable = new Set(usableAttributeTypeIds);
    return attributeTypes.filter(
      (type) => usable.has(type.id) && !configured.has(type.id),
    );
  }, [
    attributeTypes,
    configuredAttributeTypeIds,
    usableAttributeTypeIds,
  ]);

  useEffect(() => {
    if (state.categoryAttributes?.length || state.editor) onCreated(state);
  }, [onCreated, state]);

  useEffect(() => {
    if (detachState.detachedAttributeTypeId) onDetached?.(detachState);
  }, [detachState, onDetached]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const creatingNew = !existingAttributeTypeId;
  const referenced = usage.product_count > 0 || usage.variant_count > 0;

  return (
    <div
      aria-labelledby="product-option-panel-title"
      aria-modal="true"
      className="side-panel"
      role="dialog"
    >
      <button
        aria-label="Close product option panel"
        className="side-panel-backdrop"
        onClick={onClose}
        type="button"
      />
      <div className="side-panel-content">
        <header>
          <div>
            <p className="eyebrow">Category configuration</p>
            <h2 id="product-option-panel-title">
              {editing ? "Edit product option" : "Add product option"}
            </h2>
          </div>
          <button
            aria-label="Close product option panel"
            className="text-button"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>

        {editing ? (
          <p className="notice">
            <strong>
              Used by {countLabel(categoryCount, "category", "categories")}.
            </strong>{" "}
            Changing the option name or value labels updates every category
            using it.
          </p>
        ) : (
          <p>
            Add Colour, Size, or another parameter, then choose whether it
            describes the product or its separately stocked variants.
          </p>
        )}

        <form action={action} autoComplete="off" className="product-option-inline-form">
          {state.error ? (
            <p aria-live="polite" className="notice is-error">
              {state.error}
            </p>
          ) : null}
          <input name="categoryId" type="hidden" value={categoryId} />
          {editing ? (
            <>
              <input
                name="attributeTypeId"
                type="hidden"
                value={attributeType?.id ?? ""}
              />
              <section className="option-editor-section">
                <h3>Reusable option</h3>
                <label>
                  Option name
                  <input
                    autoComplete="off"
                    name="optionName"
                    onChange={(event) => setOptionName(event.target.value)}
                    required
                    value={optionName}
                  />
                </label>
                <div className="option-value-list">
                  {values.map((value, index) => (
                    <div className="option-value-row" key={value.key}>
                      <label>
                        Value {index + 1}
                        <input
                          onChange={(event) =>
                            setValues((current) =>
                              current.map((item) =>
                                item.key === value.key
                                  ? { ...item, value: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          required
                          value={value.value}
                        />
                      </label>
                      <button
                        className="text-button"
                        disabled={
                          values.length === 1 ||
                          (value.id
                            ? (valueUsage[value.id]?.product_count ?? 0) > 0 ||
                              (valueUsage[value.id]?.variant_count ?? 0) > 0
                            : false)
                        }
                        onClick={() =>
                          setValues((current) =>
                            current.filter((item) => item.key !== value.key),
                          )
                        }
                        type="button"
                      >
                        Remove value
                      </button>
                      {value.id &&
                      ((valueUsage[value.id]?.product_count ?? 0) > 0 ||
                        (valueUsage[value.id]?.variant_count ?? 0) > 0) ? (
                        <>
                          <small>
                            Used by{" "}
                            {countLabel(
                              valueUsage[value.id]?.product_count ?? 0,
                              "product",
                            )}
                            {" · "}
                            {countLabel(
                              valueUsage[value.id]?.variant_count ?? 0,
                              "variant",
                            )}
                          </small>
                          {(valueUsage[value.id]?.product_ids.length ?? 0) >
                          0 ? (
                            <Link
                              className="text-button"
                              href={`/store-manager/products?ids=${valueUsage[
                                value.id
                              ]?.product_ids.join(",")}&state=all`}
                            >
                              View products using {value.value}
                            </Link>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
                <button
                  className="secondary-button"
                  onClick={() =>
                    setValues((current) => [
                      ...current,
                      {
                        key: `new-${current.length}-${Date.now()}`,
                        id: null,
                        value: "",
                      },
                    ])
                  }
                  type="button"
                >
                  + Add value
                </button>
                <input
                  name="allowedValuesJson"
                  type="hidden"
                  value={JSON.stringify(
                    values.map((value, sortOrder) => ({
                      id: value.id,
                      value: value.value.trim(),
                      sort_order: sortOrder,
                    })),
                  )}
                />
              </section>
              <section className="option-editor-section">
                <h3>This category</h3>
                <label className="checkbox-field">
                  <input
                    checked={isRequired}
                    name="isRequired"
                    onChange={(event) => setIsRequired(event.target.checked)}
                    type="checkbox"
                  />
                  Required for new products or variants
                </label>
                <label className="checkbox-field">
                  <input
                    checked={isVariantAxis}
                    name="isVariantAxis"
                    onChange={(event) => setIsVariantAxis(event.target.checked)}
                    type="checkbox"
                  />
                  Defines independently stocked variants
                </label>
                <label>
                  Display order
                  <input
                    min="0"
                    name="sortOrder"
                    onChange={(event) =>
                      setSortOrder(Number(event.target.value))
                    }
                    type="number"
                    value={sortOrder}
                  />
                </label>
              </section>
            </>
          ) : (
            <>
              <label>
                Reuse an existing option
                <select
                  name="existingAttributeTypeId"
                  onChange={(event) =>
                    setExistingAttributeTypeId(event.target.value)
                  }
                  value={existingAttributeTypeId}
                >
                  <option value="">Create a new option</option>
                  {availableTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              {creatingNew ? (
                <>
                  <label>
                    Option name
                    <input
                      autoComplete="off"
                      name="parameterName"
                      placeholder="Colour"
                      required
                    />
                  </label>
                  <label>
                    Allowed values
                    <input
                      autoComplete="off"
                      name="allowedValues"
                      placeholder="Blue, Black, Red"
                      required
                    />
                    <small>Separate values with commas.</small>
                  </label>
                </>
              ) : null}
              <section className="option-editor-section">
                <h3>This category</h3>
                <label className="checkbox-field">
                  <input
                    checked={isRequired}
                    name="isRequired"
                    onChange={(event) => setIsRequired(event.target.checked)}
                    type="checkbox"
                  />
                  Required for new products or variants
                </label>
                <label className="checkbox-field">
                  <input
                    checked={isVariantAxis}
                    name="isVariantAxis"
                    onChange={(event) =>
                      setIsVariantAxis(event.target.checked)
                    }
                    type="checkbox"
                  />
                  Defines independently stocked variants
                </label>
                <label>
                  Display order
                  <input
                    min="0"
                    name="sortOrder"
                    onChange={(event) =>
                      setSortOrder(Number(event.target.value))
                    }
                    type="number"
                    value={sortOrder}
                  />
                </label>
              </section>
            </>
          )}
          <div className="form-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" disabled={pending} type="submit">
              {pending
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Add option"}
            </button>
          </div>
        </form>

        {editing ? (
          <section className="option-detach-section">
            <h3>Remove attachment</h3>
            {referenced ? (
              <p className="field-help">
                {countLabel(usage.product_count, "product")} use this option
                in this category across{" "}
                {countLabel(usage.variant_count, "variant")}. Remove it only
                after those products stop using it.
              </p>
            ) : (
              <p className="field-help">
                This removes the option from this category only. The reusable
                option remains available elsewhere.
              </p>
            )}
            {usage.product_ids.length > 0 ? (
              <Link
                className="text-button"
                href={`/store-manager/products?ids=${usage.product_ids.join(",")}&state=all`}
              >
                View products
              </Link>
            ) : null}
            <form
              action={detachAction}
              onSubmit={(event) => {
                if (
                  !window.confirm(
                    "Remove this product option from the category?",
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input name="categoryId" type="hidden" value={categoryId} />
              <input
                name="attributeTypeId"
                type="hidden"
                value={attributeType?.id ?? ""}
              />
              {detachState.error ? (
                <p aria-live="polite" className="notice is-error">
                  {detachState.error}
                </p>
              ) : null}
              <button
                className="danger-button"
                disabled={referenced || detachPending}
                type="submit"
              >
                Remove from this category
              </button>
            </form>
          </section>
        ) : null}
      </div>
    </div>
  );
}
