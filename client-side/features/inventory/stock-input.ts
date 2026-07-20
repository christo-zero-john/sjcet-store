function positiveInteger(value: string): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Enter a positive whole number.");
  }

  return parsed;
}

export function parseAddStockTarget(value: string, currentStock: number): number {
  const target = positiveInteger(value);

  if (target <= currentStock) {
    throw new Error("New stock count must be greater than current stock.");
  }

  return target;
}

export function sliderMaximum(
  currentStock: number,
  enteredCount: number,
  defaultSpan = 50,
): number {
  return Math.max(currentStock + defaultSpan, enteredCount);
}

export function parseStockReduction(value: string, currentStock: number) {
  const quantityToRemove = positiveInteger(value);

  if (quantityToRemove > currentStock) {
    throw new Error("Quantity cannot exceed available stock.");
  }

  return {
    quantityToRemove,
    resultingStock: currentStock - quantityToRemove,
  };
}
