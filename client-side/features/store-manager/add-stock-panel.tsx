"use client";

import { useState } from "react";

import { addStockToCount } from "../inventory/actions";
import { sliderMaximum } from "../inventory/stock-input";

type AddStockPanelProps = Readonly<{
  currentStock: number;
  productId: string;
  variantId: string;
  idempotencyKey: string;
  returnTo?: string;
}>;

export function AddStockPanel({
  currentStock,
  productId,
  variantId,
  idempotencyKey,
  returnTo,
}: AddStockPanelProps) {
  const minimum = currentStock + 1;
  const [targetCount, setTargetCount] = useState(minimum);
  const maximum = sliderMaximum(currentStock, targetCount);

  return (
    <form
      action={addStockToCount}
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
        New stock count
        <input
          min={minimum}
          name="targetCount"
          onChange={(event) => setTargetCount(Number(event.target.value))}
          required
          type="number"
          value={targetCount}
        />
      </label>
      <label>
        Adjust new stock count
        <input
          aria-label="New stock count slider"
          max={maximum}
          min={minimum}
          onChange={(event) => setTargetCount(Number(event.target.value))}
          type="range"
          value={targetCount}
        />
      </label>
      <p aria-live="polite">
        Units to add <strong>{Math.max(0, targetCount - currentStock)}</strong>
      </p>
      <label>
        Reason
        <textarea name="reason" required rows={2} />
      </label>
      <button className="primary-button" type="submit">
        Add stock
      </button>
    </form>
  );
}
