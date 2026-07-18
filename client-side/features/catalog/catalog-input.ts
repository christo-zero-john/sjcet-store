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

export type InlineOptionValueInput = Readonly<{
  id: string | null;
  value: string;
  sort_order: number;
}>;

export function parseInlineOptionValues(
  input: string,
): InlineOptionValueInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Option values could not be read.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Option values could not be read.");
  }
  if (parsed.length === 0) {
    throw new Error("Add at least one option value.");
  }

  const values = parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error("Option values could not be read.");
    }
    const candidate = item as Record<string, unknown>;
    const value =
      typeof candidate.value === "string" ? candidate.value.trim() : "";
    const id =
      typeof candidate.id === "string" && candidate.id
        ? candidate.id
        : null;
    const sortOrder =
      typeof candidate.sort_order === "number"
        ? candidate.sort_order
        : index;

    if (!value) {
      throw new Error("Every option value needs a label.");
    }
    if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) {
      throw new Error("Every option value needs a valid display order.");
    }
    return { id, value, sort_order: sortOrder };
  });

  const normalized = new Set(values.map((item) => item.value.toLowerCase()));
  if (normalized.size !== values.length) {
    throw new Error("Option values must be unique.");
  }
  return values;
}
