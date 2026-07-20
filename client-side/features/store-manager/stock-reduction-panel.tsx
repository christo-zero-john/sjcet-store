"use client";

import { useState } from "react";

import { recordStockReduction } from "../inventory/actions";

type StockReductionPanelProps = Readonly<{
  currentStock: number;
  productId: string;
  variantId: string;
  idempotencyKey: string;
  returnTo?: string;
}>;

export function StockReductionPanel({
  currentStock,
  productId,
  variantId,
  idempotencyKey,
  returnTo,
}: StockReductionPanelProps) {
  const [quantity, setQuantity] = useState(1);

  return (
    <form
      action={recordStockReduction}
      autoComplete="off"
      className="stock-operation-panel"
    >
      <input name="productId" type="hidden" value={productId} />
      <input name="variantId" type="hidden" value={variantId} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
      <p>
        Current stock <strong>{currentStock}</strong>
      </p>
      <label>
        Quantity to remove
        <input
          max={currentStock}
          min="1"
          name="quantityToRemove"
          onChange={(event) => setQuantity(Number(event.target.value))}
          required
          type="number"
          value={quantity}
        />
      </label>
      <p aria-live="polite">
        Resulting stock{" "}
        <strong>{Math.max(0, currentStock - quantity)}</strong>
      </p>
      <label>
        Reason
        <textarea name="reason" required rows={2} />
      </label>
      <label className="checkbox-field">
        <input name="confirmed" required type="checkbox" />
        I confirm this stock reduction
      </label>
      <button className="danger-button" type="submit">
        Record stock reduction
      </button>
    </form>
  );
}
