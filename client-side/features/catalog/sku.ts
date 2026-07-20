type SkuSuggestion = Readonly<{
  productName: string;
  optionValues?: readonly string[];
  suffix?: string;
}>;

function skuFragment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeSku(value: string): string {
  const normalized = skuFragment(value);

  if (!normalized) {
    throw new Error("SKU is required.");
  }

  return normalized;
}

export function suggestSku({
  productName,
  optionValues = [],
  suffix = crypto.randomUUID().slice(0, 4),
}: SkuSuggestion): string {
  const fragments = [productName, ...optionValues, suffix]
    .map(skuFragment)
    .filter(Boolean);

  return normalizeSku(fragments.join("-"));
}
