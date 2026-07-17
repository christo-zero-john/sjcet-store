"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStoreOperator } from "../auth/authorization";
import { catalogSlug, formText } from "./catalog-input";

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
