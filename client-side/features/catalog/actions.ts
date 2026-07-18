"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStoreOperator } from "../auth/authorization";
import { catalogSlug, formText } from "./catalog-input";
import type {
  CatalogAttributeType,
  CatalogAttributeValue,
  CategoryAttributeConfiguration,
  ProductCategory,
} from "./contracts";

export type InlineCategoryState = Readonly<{
  category?: ProductCategory;
  attributeTypes?: readonly CatalogAttributeType[];
  attributeValues?: readonly CatalogAttributeValue[];
  categoryAttributes?: readonly CategoryAttributeConfiguration[];
  error?: string;
}>;

function catalogError(message: string): never {
  redirect(`/store-manager/categories?error=${encodeURIComponent(message)}`);
}

export async function createCategory(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const name = formText(formData, "name");
  const parentId = formText(formData, "parentId") || null;

  if (!name) {
    catalogError("Category name is required.");
  }

  const { error } = await supabase.from("product_categories").insert({
    name,
    slug: catalogSlug(name),
    parent_id: parentId,
    description: formText(formData, "description") || null,
  });

  if (error) {
    catalogError(error.message);
  }

  revalidatePath("/store-manager/categories");
}

export async function createCategoryInline(
  _previousState: InlineCategoryState,
  formData: FormData,
): Promise<InlineCategoryState> {
  const { supabase } = await requireStoreOperator();
  const name = formText(formData, "name");
  let parameters: unknown = [];

  try {
    parameters = JSON.parse(formText(formData, "parameterConfigurations") || "[]");
  } catch {
    return { error: "Category parameters could not be read." };
  }

  const { data, error } = await supabase.rpc("create_category_with_parameters", {
    category_name: name,
    parent_category_id: formText(formData, "parentId") || null,
    category_description: formText(formData, "description"),
    parameter_configurations: parameters,
  });

  if (error) return { error: error.message };

  const category = data as ProductCategory;
  const { data: configurationData, error: configurationError } = await supabase
    .from("category_attributes")
    .select("category_id,attribute_type_id,is_required,is_variant_axis,required_from")
    .eq("category_id", category.id)
    .order("sort_order");
  if (configurationError) return { error: configurationError.message };

  const configurations =
    (configurationData ?? []) as CategoryAttributeConfiguration[];
  const typeIds = configurations.map(
    (configuration) => configuration.attribute_type_id,
  );
  const [{ data: typeData }, { data: valueData }] = typeIds.length
    ? await Promise.all([
        supabase.from("attribute_types").select("id,name").in("id", typeIds),
        supabase
          .from("attribute_values")
          .select("id,attribute_type_id,value")
          .in("attribute_type_id", typeIds)
          .order("sort_order"),
      ])
    : [{ data: [] }, { data: [] }];

  revalidatePath("/store-manager/categories");
  revalidatePath("/store-manager/products/new");
  return {
    category,
    attributeTypes: (typeData ?? []) as CatalogAttributeType[],
    attributeValues: (valueData ?? []) as CatalogAttributeValue[],
    categoryAttributes: configurations,
  };
}

export async function createAttributeType(formData: FormData) {
  const { supabase, user } = await requireStoreOperator();
  const name = formText(formData, "name");

  if (!name) {
    catalogError("Attribute name is required.");
  }

  const { error } = await supabase.from("attribute_types").insert({
    name,
    slug: catalogSlug(name),
    created_by: user.id,
  });

  if (error) {
    catalogError(error.message);
  }

  revalidatePath("/store-manager/categories");
}

export async function createAttributeValue(formData: FormData) {
  const { supabase, user } = await requireStoreOperator();
  const attributeTypeId = formText(formData, "attributeTypeId");
  const value = formText(formData, "value");

  if (!attributeTypeId || !value) {
    catalogError("Choose an attribute and enter its value.");
  }

  const { error } = await supabase.from("attribute_values").insert({
    attribute_type_id: attributeTypeId,
    value,
    created_by: user.id,
  });

  if (error) {
    catalogError(error.message);
  }

  revalidatePath("/store-manager/categories");
}

export async function assignCategoryAttribute(formData: FormData) {
  const { supabase, user } = await requireStoreOperator();
  const categoryId = formText(formData, "categoryId");
  const attributeTypeId = formText(formData, "attributeTypeId");

  if (!categoryId || !attributeTypeId) {
    catalogError("Choose both a category and an attribute.");
  }

  const { error } = await supabase.from("category_attributes").upsert(
    {
      category_id: categoryId,
      attribute_type_id: attributeTypeId,
      is_required: formData.get("isRequired") === "on",
      is_variant_axis: formData.get("isVariantAxis") === "on",
      created_by: user.id,
    },
    { onConflict: "category_id,attribute_type_id" },
  );

  if (error) {
    catalogError(error.message);
  }

  revalidatePath("/store-manager/categories");
}

export async function removeAttributeValue(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const { error } = await supabase.rpc("remove_attribute_value", {
    target_attribute_value_id: formText(formData, "attributeValueId"),
  });
  if (error) catalogError(error.message);
  revalidatePath("/store-manager/categories");
}

export async function removeAttributeType(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const { error } = await supabase.rpc("remove_attribute_type", {
    target_attribute_type_id: formText(formData, "attributeTypeId"),
  });
  if (error) catalogError(error.message);
  revalidatePath("/store-manager/categories");
}

export async function removeCategoryAttribute(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const { error } = await supabase.rpc("remove_category_attribute", {
    target_category_id: formText(formData, "categoryId"),
    target_attribute_type_id: formText(formData, "attributeTypeId"),
  });
  if (error) catalogError(error.message);
  revalidatePath("/store-manager/categories");
}
