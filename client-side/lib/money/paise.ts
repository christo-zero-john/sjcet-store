const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function assertPaise(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new TypeError("Money must be stored as whole non-negative paise.");
  }

  return value;
}

export function formatPaise(value: number): string {
  return RUPEES.format(assertPaise(value) / 100);
}
