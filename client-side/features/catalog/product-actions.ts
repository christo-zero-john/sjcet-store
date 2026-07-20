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

type StoreOperatorContext = Awaited<ReturnType<typeof requireStoreOperator>>;

async function persistVariantImage(
  supabase: StoreOperatorContext["supabase"],
  userId: string,
  productId: string,
  variantId: string,
  image: File,
  altText: string | null,
) {
  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("id", variantId)
    .eq("product_id", productId)
    .single();
  if (variantError || !variant) {
    throw new Error(
      variantError?.message ?? "The selected variant does not belong to this product.",
    );
  }

  const { data: existingImage, error: existingImageError } = await supabase
    .from("product_images")
    .select("id,storage_path")
    .eq("product_id", productId)
    .eq("variant_id", variantId)
    .maybeSingle();
  if (existingImageError) {
    throw new Error(existingImageError.message);
  }

  const imageId = existingImage?.id ?? randomUUID();
  const storagePath = productImageObjectPath(productId, randomUUID(), image.name);
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(storagePath, image, {
      contentType: image.type,
      upsert: false,
    });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const imagePayload = {
    product_id: productId,
    variant_id: variantId,
    storage_path: storagePath,
    alt_text: altText,
    is_primary: false,
  };
  const { error: metadataError } = existingImage
    ? await supabase
        .from("product_images")
        .update(imagePayload)
        .eq("id", imageId)
        .eq("product_id", productId)
        .eq("variant_id", variantId)
    : await supabase
        .from("product_images")
        .insert({ id: imageId, ...imagePayload, created_by: userId });

  if (metadataError) {
    await supabase.storage.from("product-images").remove([storagePath]);
    throw new Error(metadataError.message);
  }

  if (
    existingImage?.storage_path &&
    existingImage.storage_path !== storagePath
  ) {
    await supabase.storage
      .from("product-images")
      .remove([existingImage.storage_path]);
  }
}

export async function createProduct(formData: FormData) {
  const { supabase, user } = await requireStoreOperator();

  let variants: ReturnType<typeof parseProductVariants>;
  let productOptions: ReturnType<typeof selectedProductOptions>;
  const variantImages = new Map<string, File>();
  try {
    variants = parseProductVariants(formData);
    productOptions = selectedProductOptions(formData);
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

    try {
      await persistVariantImage(
        supabase,
        user.id,
        productId,
        createdVariant.variant_id,
        image,
        `${formText(formData, "name")} variant`,
      );
    } catch (error) {
      productDetailError(
        productId,
        `Product created, but a variant image could not be saved: ${
          error instanceof Error ? error.message : "Unknown image error."
        }`,
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
  const { supabase, user } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const imageValue = formData.get("variantImage");
  let variantImage: File | null = null;
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
    if (imageValue instanceof File && imageValue.size > 0) {
      variantImage = validateProductImage(imageValue);
    }
  } catch (error) {
    productDetailError(
      productId,
      error instanceof Error ? error.message : "Invalid price.",
    );
  }

  const { data: variantId, error } = await supabase.rpc("add_product_variant", {
    product_id: productId,
    variant_sku: formText(formData, "sku"),
    variant_barcode: formText(formData, "barcode"),
    variant_price_paise: pricePaise,
    variant_low_stock_threshold: lowStockThreshold,
    opening_stock: openingStock,
    selected_variant_values: selectedVariantValues(formData),
  });

  if (error) productDetailError(productId, error.message);
  if (variantImage) {
    try {
      await persistVariantImage(
        supabase,
        user.id,
        productId,
        variantId as string,
        variantImage,
        `${formText(formData, "sku")} variant`,
      );
    } catch (imageError) {
      productDetailError(
        productId,
        `Variant added, but its image could not be saved: ${
          imageError instanceof Error ? imageError.message : "Unknown image error."
        }`,
      );
    }
  }
  revalidatePath(`/store-manager/products/${productId}`);
  revalidatePath("/store-manager/inventory");
  redirect(`/store-manager/products/${productId}?message=Variant%20added.`);
}

export async function updateProductVariant(formData: FormData) {
  const { supabase, user } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const variantId = formText(formData, "variantId");
  const imageValue = formData.get("variantImage");
  let variantImage: File | null = null;
  let pricePaise: number;
  let lowStockThreshold: number;

  try {
    pricePaise = rupeesToPaise(formText(formData, "price"));
    lowStockThreshold = parseNonNegativeInteger(
      formText(formData, "lowStockThreshold"),
      "Low-stock threshold",
    );
    if (imageValue instanceof File && imageValue.size > 0) {
      variantImage = validateProductImage(imageValue);
    }
  } catch (error) {
    productDetailError(
      productId,
      error instanceof Error ? error.message : "Invalid price.",
    );
  }

  const { error } = await supabase.rpc("update_product_variant", {
    variant_id: variantId,
    variant_sku: formText(formData, "sku"),
    variant_barcode: formText(formData, "barcode"),
    variant_price_paise: pricePaise,
    variant_low_stock_threshold: lowStockThreshold,
    selected_variant_values: selectedVariantValues(formData),
  });

  if (error) productDetailError(productId, error.message);
  if (variantImage) {
    try {
      await persistVariantImage(
        supabase,
        user.id,
        productId,
        variantId,
        variantImage,
        `${formText(formData, "sku")} variant`,
      );
    } catch (imageError) {
      productDetailError(
        productId,
        `Variant updated, but its image could not be saved: ${
          imageError instanceof Error ? imageError.message : "Unknown image error."
        }`,
      );
    }
  }
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
  const variantId = formText(formData, "variantId");
  const fileValue = formData.get("image");

  if (!variantId) {
    productDetailError(productId, "Choose a variant for this image.");
  }

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

  try {
    await persistVariantImage(
      supabase,
      user.id,
      productId,
      variantId,
      image,
      formText(formData, "altText") || null,
    );
  } catch (error) {
    productDetailError(
      productId,
      error instanceof Error ? error.message : "Image could not be saved.",
    );
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
    .select("storage_path,variant_id")
    .eq("id", imageId)
    .eq("product_id", productId)
    .single();
  if (lookupError || !imageRecord) {
    productDetailError(
      productId,
      lookupError?.message ?? "Product image not found.",
    );
  }
  if (!imageRecord.variant_id) {
    productDetailError(productId, "Only variant images can be removed here.");
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
