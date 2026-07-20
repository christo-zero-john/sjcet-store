"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStoreOperator } from "../auth/authorization";
import { formText } from "../catalog/catalog-input";
import { parseAddStockTarget, parseStockReduction } from "./stock-input";

function stockRedirect(
  productId: string,
  returnTo: string,
  kind: "error" | "message",
  value: string,
): never {
  const destination = returnTo.startsWith("/store-manager/")
    ? returnTo
    : `/store-manager/products/${productId}`;
  redirect(
    `${destination}?${kind}=${encodeURIComponent(value)}`,
  );
}

export async function addStockToCount(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const variantId = formText(formData, "variantId");
  const reason = formText(formData, "reason");
  const idempotencyKey = formText(formData, "idempotencyKey");
  const returnTo = formText(formData, "returnTo");
  let targetCount: number;

  try {
    targetCount = parseAddStockTarget(formText(formData, "targetCount"), -1);
  } catch (error) {
    stockRedirect(
      productId,
      returnTo,
      "error",
      error instanceof Error ? error.message : "Invalid stock count.",
    );
  }

  const { error } = await supabase.rpc("add_stock_to_count", {
    variant_id: variantId,
    target_count: targetCount,
    reason,
    idempotency_key: idempotencyKey,
  });

  if (error) stockRedirect(productId, returnTo, "error", error.message);
  revalidatePath(`/store-manager/products/${productId}`);
  revalidatePath("/store-manager/inventory");
  stockRedirect(productId, returnTo, "message", "Stock added.");
}

export async function recordStockReduction(formData: FormData) {
  const { supabase } = await requireStoreOperator();
  const productId = formText(formData, "productId");
  const variantId = formText(formData, "variantId");
  const reason = formText(formData, "reason");
  const idempotencyKey = formText(formData, "idempotencyKey");
  const returnTo = formText(formData, "returnTo");

  if (formData.get("confirmed") !== "on") {
    stockRedirect(
      productId,
      returnTo,
      "error",
      "Confirm the stock reduction.",
    );
  }

  let quantityToRemove: number;
  try {
    quantityToRemove = parseStockReduction(
      formText(formData, "quantityToRemove"),
      Number.MAX_SAFE_INTEGER,
    ).quantityToRemove;
  } catch (error) {
    stockRedirect(
      productId,
      returnTo,
      "error",
      error instanceof Error ? error.message : "Invalid stock reduction.",
    );
  }

  const { error } = await supabase.rpc("record_stock_reduction", {
    variant_id: variantId,
    quantity_to_remove: quantityToRemove,
    reason,
    idempotency_key: idempotencyKey,
  });

  if (error) stockRedirect(productId, returnTo, "error", error.message);
  revalidatePath(`/store-manager/products/${productId}`);
  revalidatePath("/store-manager/inventory");
  stockRedirect(productId, returnTo, "message", "Stock reduction recorded.");
}
