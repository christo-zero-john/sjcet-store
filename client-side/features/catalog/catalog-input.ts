export function catalogSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("A catalog name must contain letters or numbers.");
  }

  return slug;
}

export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function rupeesToPaise(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) {
    throw new Error("Enter a valid non-negative price with up to two decimals.");
  }

  const [rupees, paise = ""] = value.trim().split(".");
  const result = Number(rupees) * 100 + Number(paise.padEnd(2, "0"));

  if (!Number.isSafeInteger(result)) {
    throw new Error("Enter a valid non-negative price with up to two decimals.");
  }

  return result;
}

export function parseStockDelta(value: string): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed === 0) {
    throw new Error("Stock change must be a non-zero whole number.");
  }

  return parsed;
}

export function parseNonNegativeInteger(value: string, label: string): number {
  const parsed = Number(value || "0");

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }

  return parsed;
}
