export type CatalogMutationCode =
  | "VALIDATION_ERROR"
  | "DUPLICATE_SKU"
  | "REFERENCE_IN_USE"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "UNEXPECTED";

export type CatalogMutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: CatalogMutationCode; message: string; field?: string };

export type CatalogOptionUsage = Readonly<{
  product_count: number;
  variant_count: number;
  category_count: number;
  total_count: number;
  product_ids: readonly string[];
}>;

export type ProductCategory = Readonly<{
  id: string;
  name: string;
  parent_id: string | null;
  description?: string | null;
}>;

export type CatalogAttributeType = Readonly<{
  id: string;
  name: string;
}>;

export type CatalogAttributeValue = Readonly<{
  id: string;
  attribute_type_id: string;
  value: string;
  sort_order?: number;
}>;

export type CategoryAttributeConfiguration = Readonly<{
  category_id: string;
  attribute_type_id: string;
  is_required: boolean;
  is_variant_axis: boolean;
  sort_order?: number;
  required_from?: string | null;
}>;

export type CategoryOptionUsage = Readonly<{
  product_count: number;
  variant_count: number;
  product_ids: readonly string[];
}>;

export type CatalogOptionEditorResult = Readonly<{
  attributeType: CatalogAttributeType;
  attributeValues: readonly CatalogAttributeValue[];
  categoryAttribute: CategoryAttributeConfiguration;
  categoryCount: number;
  usage: CategoryOptionUsage;
  valueUsage: Readonly<Record<string, CatalogOptionUsage>>;
}>;
