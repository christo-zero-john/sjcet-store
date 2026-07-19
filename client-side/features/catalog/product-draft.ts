import { rupeesToPaise } from "./catalog-input";
import type { ProductOptionConfiguration } from "./contracts";
import { normalizeSku } from "./sku";

export type ProductVariantDraft = Readonly<{
  clientKey: string;
  sku: string;
  barcode: string | null;
  pricePaise: number;
  openingStock: number;
  lowStockThreshold: number;
  attributes: Readonly<Record<string, string>>;
}>;

export function addProductOption(
  current: readonly ProductOptionConfiguration[],
  option: ProductOptionConfiguration,
): ProductOptionConfiguration[] {
  return [
    ...current.filter(
      (item) => item.attribute_type_id !== option.attribute_type_id,
    ),
    option,
  ].toSorted((left, right) => left.sort_order - right.sort_order);
}

export function removeProductOption(
  current: readonly ProductOptionConfiguration[],
  attributeTypeId: string,
): ProductOptionConfiguration[] {
  return current.filter(
    (item) => item.attribute_type_id !== attributeTypeId,
  );
}

type MutableVariantDraft = {
  clientKey: string;
  sku: string;
  barcode: string;
  price: string;
  openingStock: string;
  lowStockThreshold: string;
  attributes: Record<string, string>;
};

function wholeNumber(value: string, label: string): number {
  const parsed = Number(value || "0");
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} must be a whole number.`);
  }
  if (parsed < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
  return parsed;
}

function optionSignature(attributes: Readonly<Record<string, string>>): string {
  return Object.entries(attributes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, value]) => `${type}=${value}`)
    .join(",");
}

export function selectedProductValues(
  formData: FormData,
): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (
      key.startsWith("productAttribute:") &&
      typeof value === "string" &&
      value
    ) {
      selected[key.slice("productAttribute:".length)] = value;
    }
  }
  return selected;
}

export function selectedProductOptions(
  formData: FormData,
): ProductOptionConfiguration[] {
  const rawValue = formData.get("selectedProductOptions");
  if (typeof rawValue !== "string" || !rawValue.trim()) return [];

  let payload: unknown;
  try {
    payload = JSON.parse(rawValue);
  } catch {
    throw new Error("Selected product options are invalid.");
  }
  if (!Array.isArray(payload)) {
    throw new Error("Selected product options are invalid.");
  }

  const options = payload.map((item, index) => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof Reflect.get(item, "attribute_type_id") !== "string" ||
      !Reflect.get(item, "attribute_type_id") ||
      typeof Reflect.get(item, "is_required") !== "boolean" ||
      typeof Reflect.get(item, "is_variant_axis") !== "boolean"
    ) {
      throw new Error("Selected product options are invalid.");
    }
    const sortOrder = Reflect.get(item, "sort_order");
    if (
      !Number.isSafeInteger(sortOrder) ||
      (sortOrder as number) < 0
    ) {
      throw new Error("Selected product option order is invalid.");
    }
    return {
      attribute_type_id: Reflect.get(item, "attribute_type_id") as string,
      is_required: Reflect.get(item, "is_required") as boolean,
      is_variant_axis: Reflect.get(item, "is_variant_axis") as boolean,
      sort_order: sortOrder as number,
      _index: index,
    };
  });

  if (
    new Set(options.map((option) => option.attribute_type_id)).size !==
    options.length
  ) {
    throw new Error("Each product option can be selected only once.");
  }

  return options
    .toSorted(
      (left, right) =>
        left.sort_order - right.sort_order || left._index - right._index,
    )
    .map((option) => ({
      attribute_type_id: option.attribute_type_id,
      is_required: option.is_required,
      is_variant_axis: option.is_variant_axis,
      sort_order: option.sort_order,
    }));
}

export function parseProductVariants(formData: FormData): ProductVariantDraft[] {
  const drafts = new Map<string, MutableVariantDraft>();

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || !key.startsWith("variant:")) continue;
    const [, clientKey, field, nestedField] = key.split(":");
    if (!clientKey || !field) continue;

    const draft = drafts.get(clientKey) ?? {
      clientKey,
      sku: "",
      barcode: "",
      price: "",
      openingStock: "0",
      lowStockThreshold: "0",
      attributes: {},
    };

    if (field === "attribute" && nestedField && value) {
      draft.attributes[nestedField] = value;
    } else if (
      field === "sku" ||
      field === "barcode" ||
      field === "price" ||
      field === "openingStock" ||
      field === "lowStockThreshold"
    ) {
      draft[field] = value.trim();
    }
    drafts.set(clientKey, draft);
  }

  if (drafts.size === 0) {
    throw new Error("Add at least one sellable variant.");
  }

  const variants = [...drafts.values()].map((draft) => ({
    clientKey: draft.clientKey,
    sku: normalizeSku(draft.sku),
    barcode: draft.barcode || null,
    pricePaise: rupeesToPaise(draft.price),
    openingStock: wholeNumber(draft.openingStock, "Opening stock"),
    lowStockThreshold: wholeNumber(
      draft.lowStockThreshold,
      "Low-stock threshold",
    ),
    attributes: draft.attributes,
  }));

  const skuSet = new Set(variants.map((variant) => variant.sku));
  if (skuSet.size !== variants.length) {
    throw new Error("Each sellable variant needs a unique SKU.");
  }

  const barcodes = variants
    .map((variant) => variant.barcode)
    .filter((barcode): barcode is string => barcode !== null);
  if (new Set(barcodes).size !== barcodes.length) {
    throw new Error("Each sellable variant needs a unique barcode.");
  }

  const signatures = variants.map((variant) =>
    optionSignature(variant.attributes),
  );
  if (new Set(signatures).size !== signatures.length) {
    throw new Error(
      "Each sellable variant needs a different option combination.",
    );
  }

  return variants;
}
