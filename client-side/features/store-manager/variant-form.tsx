type AttributeType = {
  id: string;
  name: string;
};

type AttributeValue = {
  id: string;
  attribute_type_id: string;
  value: string;
};

type CategoryAttribute = {
  attribute_type_id: string;
  is_required: boolean;
  is_variant_axis: boolean;
};

type VariantFormProps = Readonly<{
  action?: (formData: FormData) => void | Promise<void>;
  productId: string;
  variantId?: string;
  submitLabel?: string;
  sku?: string;
  barcode?: string | null;
  price?: string;
  lowStockThreshold?: number;
  openingStock?: boolean;
  attributeTypes: readonly AttributeType[];
  attributeValues: readonly AttributeValue[];
  configuredAttributes: readonly CategoryAttribute[];
  selectedValues?: Readonly<Record<string, string>>;
}>;

export function VariantForm({
  action,
  productId,
  variantId,
  submitLabel = variantId ? "Save variant" : "Add variant",
  sku = "",
  barcode = "",
  price = "",
  lowStockThreshold = 0,
  openingStock = true,
  attributeTypes,
  attributeValues,
  configuredAttributes,
  selectedValues = {},
}: VariantFormProps) {
  return (
    <form action={action} className="form-grid variant-form">
      <input name="productId" type="hidden" value={productId} />
      {variantId ? (
        <input name="variantId" type="hidden" value={variantId} />
      ) : null}
      <label>
        SKU
        <input defaultValue={sku} name="sku" required />
      </label>
      <label>
        Barcode (optional)
        <input
          defaultValue={barcode ?? ""}
          inputMode="numeric"
          name="barcode"
        />
      </label>
      <label>
        Price (₹)
        <input
          defaultValue={price}
          inputMode="decimal"
          name="price"
          placeholder="0.00…"
          required
        />
      </label>
      {openingStock ? (
        <label>
          Opening stock
          <input defaultValue="0" min="0" name="openingStock" type="number" />
        </label>
      ) : null}
      <label>
        Low-stock threshold
        <input
          defaultValue={lowStockThreshold}
          min="0"
          name="lowStockThreshold"
          type="number"
        />
      </label>
      <label className="wide-field">
        Variant image (optional)
        <input
          accept="image/jpeg,image/png,image/webp"
          name="variantImage"
          type="file"
        />
        <small>Choose a file only when adding or replacing this image.</small>
      </label>
      {configuredAttributes
        .filter((config) => config.is_variant_axis)
        .map((config) => {
          const type = attributeTypes.find(
            (item) => item.id === config.attribute_type_id,
          );
          const values = attributeValues.filter(
            (item) => item.attribute_type_id === config.attribute_type_id,
          );

          return (
            <label key={config.attribute_type_id}>
              {type?.name ?? "Variant attribute"}
              <select
                defaultValue={selectedValues[config.attribute_type_id] ?? ""}
                name={`attribute:${config.attribute_type_id}`}
                required={config.is_required}
              >
                <option value="">Choose value</option>
                {values.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.value}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      <div className="form-actions wide-field">
        <button className="primary-button" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
