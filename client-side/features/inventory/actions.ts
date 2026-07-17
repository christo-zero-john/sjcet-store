"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStoreOperator } from "../auth/authorization";
import { formText, parseStockDelta } from "../catalog/catalog-input";

export async function adjustVariantStock(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const variantId = formText(formData, "variantId");
  const reason = formText(formData, "reason");
  let quantityDelta: number;

  try {
    quantityDelta = parseStockDelta(formText(formData, "quantityDelta"));
  } catch (error) {
    redirect(
      `/store-manager/products/${productId}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Invalid stock change.",
      )}`,
    );
  }

  if (!reason) {
    redirect(
      `/store-manager/products/${productId}?error=${encodeURIComponent(
        "A stock-adjustment reason is required.",
      )}`,
    );
  }

  const { error } = await supabase.rpc("adjust_stock", {
    variant_id: variantId,
    quantity_delta: quantityDelta,
    reason,
    movement_type: quantityDelta > 0 ? "restock" : "correction",
  });

  if (error) {
    redirect(
      `/store-manager/products/${productId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/store-manager/products/${productId}`);
  revalidatePath("/store-manager/inventory");
  redirect(`/store-manager/products/${productId}?message=Stock%20updated.`);
}
