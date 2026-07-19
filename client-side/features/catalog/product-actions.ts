"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { requireStoreOperator } from "../auth/authorization";
import {
  formText,
  parseNonNegativeInteger,
  rupeesToPaise,
} from "./catalog-input";
import {
  productImageObjectPath,
  validateProductImage,
} from "./product-images";
import {
  parseProductVariants,
  selectedProductOptions,
  selectedProductValues,
} from "./product-draft";

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
  const { supabase, user } = await requireStoreOperator();

  let variants: ReturnType<typeof parseProductVariants>;
  let productOptions: ReturnType<typeof selectedProductOptions>;
  let primaryImage: File | null = null;
  const variantImages = new Map<string, File>();
  try {
    variants = parseProductVariants(formData);
    productOptions = selectedProductOptions(formData);
    const imageValue = formData.get("primaryImage");
    if (imageValue instanceof File && imageValue.size > 0) {
      primaryImage = validateProductImage(imageValue);
    }
    for (const variant of variants) {
      const imageValue = formData.get(`variantImage:${variant.clientKey}`);
      if (imageValue instanceof File && imageValue.size > 0) {
        variantImages.set(
          variant.clientKey,
          validateProductImage(imageValue),
        );
      }
    }
  } catch (error) {
    productError(
      error instanceof Error ? error.message : "Invalid product details.",
    );
  }

  const { data, error } = await supabase.rpc("create_product_with_variants", {
    target_category_id: formText(formData, "categoryId"),
    product_name: formText(formData, "name"),
    product_brand: formText(formData, "brand") || null,
    product_description: formText(formData, "description"),
    selected_product_values: selectedProductValues(formData),
    selected_product_options: productOptions,
    target_variants: variants.map((variant) => ({
      client_key: variant.clientKey,
      sku: variant.sku,
      barcode: variant.barcode,
      price_paise: variant.pricePaise,
      opening_stock: variant.openingStock,
      low_stock_threshold: variant.lowStockThreshold,
      attributes: variant.attributes,
    })),
  });

  if (error) {
    productError(error.message);
  }

  const result = data as {
    product_id: string;
    variants: Array<{ client_key: string; variant_id: string }>;
  };
  const productId = result.product_id;
  if (primaryImage) {
    const imageId = randomUUID();
    const storagePath = productImageObjectPath(
      productId,
      imageId,
      primaryImage.name,
    );
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(storagePath, primaryImage, {
        contentType: primaryImage.type,
        upsert: false,
      });

    if (uploadError) {
      productDetailError(productId, `Product created, but image upload failed: ${uploadError.message}`);
    }

    const { error: metadataError } = await supabase.from("product_images").insert({
      id: imageId,
      product_id: productId,
      storage_path: storagePath,
      alt_text: formText(formData, "name"),
      is_primary: true,
      created_by: user.id,
    });

    if (metadataError) {
      await supabase.storage.from("product-images").remove([storagePath]);
      productDetailError(
        productId,
        `Product created, but image details could not be saved: ${metadataError.message}`,
      );
    }
  }

  for (const [clientKey, image] of variantImages) {
    const createdVariant = result.variants.find(
      (variant) => variant.client_key === clientKey,
    );
    if (!createdVariant) {
      productDetailError(
        productId,
        `Product created, but the image for variant ${clientKey} could not be matched.`,
      );
    }

    const imageId = randomUUID();
    const storagePath = productImageObjectPath(
      productId,
      imageId,
      image.name,
    );
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(storagePath, image, {
        contentType: image.type,
        upsert: false,
      });
    if (uploadError) {
      productDetailError(
        productId,
        `Product created, but a variant image upload failed: ${uploadError.message}`,
      );
    }

    const { error: metadataError } = await supabase
      .from("product_images")
      .insert({
        id: imageId,
        product_id: productId,
        variant_id: createdVariant.variant_id,
        storage_path: storagePath,
        alt_text: `${formText(formData, "name")} variant`,
        is_primary: false,
        created_by: user.id,
      });
    if (metadataError) {
      await supabase.storage.from("product-images").remove([storagePath]);
      productDetailError(
        productId,
        `Product created, but variant image details could not be saved: ${metadataError.message}`,
      );
    }
  }

  redirect(`/store-manager/products/${productId}`);
}

export async function updateProduct(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const { error } = await supabase.rpc("update_product", {
    product_id: productId,
    category_id: formText(formData, "categoryId"),
    product_name: formText(formData, "name"),
    product_brand: formText(formData, "brand"),
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
    variant_barcode: formText(formData, "barcode"),
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
    variant_barcode: formText(formData, "barcode"),
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

export async function uploadProductImage(formData: FormData) {
  const { supabase, user } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const variantId = formText(formData, "variantId") || null;
  const fileValue = formData.get("image");

  if (!(fileValue instanceof File) || fileValue.size === 0) {
    productDetailError(productId, "Choose an image to upload.");
  }

  let image: File;
  try {
    image = validateProductImage(fileValue);
  } catch (error) {
    productDetailError(
      productId,
      error instanceof Error ? error.message : "Invalid product image.",
    );
  }

  const imageId = randomUUID();
  const storagePath = productImageObjectPath(productId, imageId, image.name);
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(storagePath, image, {
      contentType: image.type,
      upsert: false,
    });
  if (uploadError) productDetailError(productId, uploadError.message);

  const { error } = await supabase.from("product_images").insert({
    id: imageId,
    product_id: productId,
    variant_id: variantId,
    storage_path: storagePath,
    alt_text: formText(formData, "altText") || null,
    is_primary: false,
    created_by: user.id,
  });

  if (error) {
    await supabase.storage.from("product-images").remove([storagePath]);
    productDetailError(productId, error.message);
  }

  revalidatePath(`/store-manager/products/${productId}`);
  redirect(`/store-manager/products/${productId}?message=Image%20uploaded.`);
}

export async function removeProductImage(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const imageId = formText(formData, "imageId");
  const { data: imageRecord, error: lookupError } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("id", imageId)
    .eq("product_id", productId)
    .single();
  if (lookupError || !imageRecord) {
    productDetailError(
      productId,
      lookupError?.message ?? "Product image not found.",
    );
  }
  const storagePath = imageRecord.storage_path;

  const { error: storageError } = await supabase.storage
    .from("product-images")
    .remove([storagePath]);
  if (storageError) productDetailError(productId, storageError.message);

  const { error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .eq("product_id", productId);
  if (error) productDetailError(productId, error.message);

  revalidatePath(`/store-manager/products/${productId}`);
  redirect(`/store-manager/products/${productId}?message=Image%20removed.`);
}

export async function bulkAssignVariantAttribute(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const variantIds = formData
    .getAll("variantIds")
    .filter((value): value is string => typeof value === "string");

  if (variantIds.length === 0) {
    productDetailError(productId, "Choose at least one variant.");
  }

  const { error } = await supabase.rpc("bulk_assign_variant_attribute", {
    target_product_id: productId,
    target_attribute_type_id: formText(formData, "attributeTypeId"),
    target_attribute_value_id: formText(formData, "attributeValueId"),
    target_variant_ids: variantIds,
  });

  if (error) productDetailError(productId, error.message);
  revalidatePath(`/store-manager/products/${productId}`);
  revalidatePath("/store-manager/inventory");
  redirect(
    `/store-manager/products/${productId}?message=Variant%20option%20assigned.`,
  );
}

export async function setPrimaryProductImage(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const { error } = await supabase.rpc("set_primary_product_image", {
    target_product_id: productId,
    target_image_id: formText(formData, "imageId"),
  });
  if (error) productDetailError(productId, error.message);
  revalidatePath(`/store-manager/products/${productId}`);
  redirect(`/store-manager/products/${productId}?message=Primary%20image%20updated.`);
}

export async function reorderProductImage(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  let sortOrder: number;
  try {
    sortOrder = parseNonNegativeInteger(
      formText(formData, "sortOrder"),
      "Image order",
    );
  } catch (error) {
    productDetailError(
      productId,
      error instanceof Error ? error.message : "Invalid image order.",
    );
  }
  const { error } = await supabase
    .from("product_images")
    .update({ sort_order: sortOrder })
    .eq("id", formText(formData, "imageId"))
    .eq("product_id", productId);
  if (error) productDetailError(productId, error.message);
  revalidatePath(`/store-manager/products/${productId}`);
  redirect(`/store-manager/products/${productId}?message=Image%20order%20updated.`);
}
