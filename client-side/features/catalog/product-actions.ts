"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireStoreOperator } from "../auth/authorization";
import {
  formText,
  parseNonNegativeInteger,
  rupeesToPaise,
} from "./catalog-input";

function productError(message: string): never {
  redirect(`/store-manager/products/new?error=${encodeURIComponent(message)}`);
}

function selectedVariantValues(formData: FormData): Record<string, string> {
  const selected: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("attribute:") && typeof value === "string" && value) {
      selected[key.slice("attribute:".length)] = value;
    }
  }

  return selected;
}

function productDetailError(productId: string, message: string): never {
  redirect(
    `/store-manager/products/${productId}?error=${encodeURIComponent(message)}`,
  );
}

export async function createProduct(formData: FormData) {
  const { supabase } = await requireStoreOperator();

  let pricePaise: number;
  let lowStockThreshold: number;
  let openingStock: number;
  try {
    pricePaise = rupeesToPaise(formText(formData, "price"));
    lowStockThreshold = parseNonNegativeInteger(
      formText(formData, "lowStockThreshold"),
      "Low-stock threshold",
    );
    openingStock = parseNonNegativeInteger(
      formText(formData, "openingStock"),
      "Opening stock",
    );
  } catch (error) {
    productError(error instanceof Error ? error.message : "Invalid price.");
  }

  const { data, error } = await supabase.rpc("create_product_with_variant", {
    category_id: formText(formData, "categoryId"),
    product_name: formText(formData, "name"),
    product_description: formText(formData, "description"),
    variant_sku: formText(formData, "sku"),
    variant_price_paise: pricePaise,
    variant_low_stock_threshold: lowStockThreshold,
    opening_stock: openingStock,
    selected_variant_values: selectedVariantValues(formData),
  });

  if (error) {
    productError(error.message);
  }

  redirect(`/store-manager/products/${data}`);
}

export async function updateProduct(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const { error } = await supabase.rpc("update_product", {
    product_id: productId,
    category_id: formText(formData, "categoryId"),
    product_name: formText(formData, "name"),
    product_description: formText(formData, "description"),
  });

  if (error) productDetailError(productId, error.message);
  revalidatePath(`/store-manager/products/${productId}`);
  revalidatePath("/store-manager/products");
  redirect(`/store-manager/products/${productId}?message=Product%20updated.`);
}

export async function addProductVariant(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  let pricePaise: number;
  let lowStockThreshold: number;
  let openingStock: number;

  try {
    pricePaise = rupeesToPaise(formText(formData, "price"));
    lowStockThreshold = parseNonNegativeInteger(
      formText(formData, "lowStockThreshold"),
      "Low-stock threshold",
    );
    openingStock = parseNonNegativeInteger(
      formText(formData, "openingStock"),
      "Opening stock",
    );
  } catch (error) {
    productDetailError(
      productId,
      error instanceof Error ? error.message : "Invalid price.",
    );
  }

  const { error } = await supabase.rpc("add_product_variant", {
    product_id: productId,
    variant_sku: formText(formData, "sku"),
    variant_price_paise: pricePaise,
    variant_low_stock_threshold: lowStockThreshold,
    opening_stock: openingStock,
    selected_variant_values: selectedVariantValues(formData),
  });

  if (error) productDetailError(productId, error.message);
  revalidatePath(`/store-manager/products/${productId}`);
  revalidatePath("/store-manager/inventory");
  redirect(`/store-manager/products/${productId}?message=Variant%20added.`);
}

export async function updateProductVariant(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  let pricePaise: number;
  let lowStockThreshold: number;

  try {
    pricePaise = rupeesToPaise(formText(formData, "price"));
    lowStockThreshold = parseNonNegativeInteger(
      formText(formData, "lowStockThreshold"),
      "Low-stock threshold",
    );
  } catch (error) {
    productDetailError(
      productId,
      error instanceof Error ? error.message : "Invalid price.",
    );
  }

  const { error } = await supabase.rpc("update_product_variant", {
    variant_id: formText(formData, "variantId"),
    variant_sku: formText(formData, "sku"),
    variant_price_paise: pricePaise,
    variant_low_stock_threshold: lowStockThreshold,
    selected_variant_values: selectedVariantValues(formData),
  });

  if (error) productDetailError(productId, error.message);
  revalidatePath(`/store-manager/products/${productId}`);
  revalidatePath("/store-manager/inventory");
  redirect(`/store-manager/products/${productId}?message=Variant%20updated.`);
}

export async function setProductActive(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const active = formText(formData, "active") === "true";
  const { error } = await supabase.rpc("set_product_active", {
    product_id: productId,
    active,
  });

  if (error) productDetailError(productId, error.message);
  revalidatePath(`/store-manager/products/${productId}`);
  revalidatePath("/store-manager/products");
  revalidatePath("/store-manager/inventory");
  redirect(
    `/store-manager/products/${productId}?message=${active ? "Product%20restored." : "Product%20archived."}`,
  );
}

export async function setVariantActive(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const active = formText(formData, "active") === "true";
  const { error } = await supabase.rpc("set_variant_active", {
    variant_id: formText(formData, "variantId"),
    active,
  });

  if (error) productDetailError(productId, error.message);
  revalidatePath(`/store-manager/products/${productId}`);
  revalidatePath("/store-manager/inventory");
  redirect(
    `/store-manager/products/${productId}?message=${active ? "Variant%20restored." : "Variant%20archived."}`,
  );
}
