"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import {
  addProductOptionInline,
  type InlineProductOptionState,
} from "../catalog/actions";
import type { CatalogAttributeType } from "../catalog/contracts";

type ProductOptionInlinePanelProps = Readonly<{
  categoryId: string;
  attributeTypes: readonly CatalogAttributeType[];
  configuredAttributeTypeIds: readonly string[];
  usableAttributeTypeIds: readonly string[];
  onClose: () => void;
  onCreated: (state: InlineProductOptionState) => void;
}>;

const INITIAL_STATE: InlineProductOptionState = {};

export function ProductOptionInlinePanel({
  categoryId,
  attributeTypes,
  configuredAttributeTypeIds,
  usableAttributeTypeIds,
  onClose,
  onCreated,
}: ProductOptionInlinePanelProps) {
  const [state, action, pending] = useActionState(
    addProductOptionInline,
    INITIAL_STATE,
  );
  const [existingAttributeTypeId, setExistingAttributeTypeId] = useState("");
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
    if (state.categoryAttributes?.length) onCreated(state);
  }, [onCreated, state]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const creatingNew = !existingAttributeTypeId;

  return (
    <div
      aria-labelledby="new-product-option-title"
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
            <p className="eyebrow">Product variants</p>
            <h2 id="new-product-option-title">Add product option</h2>
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

        <p>
          Add Colour, Size, or another option when each value needs its own
          SKU and stock.
        </p>

        <form
          action={action}
          autoComplete="off"
          className="product-option-inline-form"
        >
          {state.error ? (
            <p aria-live="polite" className="notice is-error">
              {state.error}
            </p>
          ) : null}
          <input name="categoryId" type="hidden" value={categoryId} />
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
          <p className="field-help">
            This option is required for new variants. You will add each
            sellable variant explicitly.
          </p>
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={pending}
              type="submit"
            >
              {pending ? "Adding…" : "Add option"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
