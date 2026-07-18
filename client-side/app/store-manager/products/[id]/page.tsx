import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";

import { requireStoreOperator } from "../../../../features/auth/authorization";
import {
  addProductVariant,
  setProductActive,
  setVariantActive,
  updateProduct,
  updateProductVariant,
} from "../../../../features/catalog/product-actions";
import { inventoryStatus } from "../../../../features/inventory/inventory-status";
import { AddStockPanel } from "../../../../features/store-manager/add-stock-panel";
import { ConfirmSubmitButton } from "../../../../features/store-manager/confirm-submit-button";
import { GroupedVariantEditor } from "../../../../features/store-manager/grouped-variant-editor";
import { ProductMediaEditor } from "../../../../features/store-manager/product-media-editor";
import { StockReductionPanel } from "../../../../features/store-manager/stock-reduction-panel";
import { VariantForm } from "../../../../features/store-manager/variant-form";
import { formatPaise } from "../../../../lib/money/paise";

type ProductDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}>;

type AttributeType = { id: string; name: string };
type AttributeValue = {
  id: string;
  attribute_type_id: string;
  value: string;
};
type CategoryAttribute = {
  category_id: string;
  attribute_type_id: string;
  is_required: boolean;
  is_variant_axis: boolean;
};
type Variant = {
  id: string;
  sku: string;
  barcode: string | null;
  price_paise: number;
  current_stock: number;
  low_stock_threshold: number;
  is_active: boolean;
  variant_attribute_values: Array<{
    attribute_type_id: string;
    attribute_value_id: string;
  }>;
};
type ProductRow = {
  id: string;
  category_id: string;
  name: string;
  brand: string | null;
  description: string | null;
  is_active: boolean;
  product_categories: {
    name: string;
    parent_id: string | null;
  } | null;
  product_attribute_values: Array<{
    attribute_type_id: string;
    attribute_value_id: string;
  }>;
  product_variants: Variant[];
};
type Movement = {
  id: string;
  variant_id: string;
  movement_type: string;
  quantity_before: number;
  quantity_delta: number;
  quantity_after: number;
  reason: string;
  created_at: string;
};
type ProductImage = {
  id: string;
  variant_id: string | null;
  storage_path: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
};
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function ProductDetailPage({
  params,
  searchParams,
}: ProductDetailPageProps) {
  const { id } = await params;
  const messages = await searchParams;
  const { supabase } = await requireStoreOperator();
  const [productResult, categoriesResult, typesResult, valuesResult, configResult] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id,category_id,name,brand,description,is_active,product_categories(name,parent_id),product_attribute_values(attribute_type_id,attribute_value_id),product_variants(id,sku,barcode,price_paise,current_stock,low_stock_threshold,is_active,variant_attribute_values(attribute_type_id,attribute_value_id))",
        )
        .eq("id", id)
        .single(),
      supabase
        .from("product_categories")
        .select("id,name,parent_id")
        .eq("is_active", true)
        .order("sort_order")
        .order("name"),
      supabase
        .from("attribute_types")
        .select("id,name")
        .order("name"),
      supabase
        .from("attribute_values")
        .select("id,attribute_type_id,value")
        .order("sort_order")
        .order("value"),
      supabase
        .from("category_attributes")
        .select("category_id,attribute_type_id,is_required,is_variant_axis")
        .order("sort_order"),
    ]);

  if (!productResult.data) notFound();
  const product = productResult.data as unknown as ProductRow;
  const variantIds = product.product_variants.map((variant) => variant.id);
  const [movementResult, imageResult] = await Promise.all([
    variantIds.length
      ? supabase
          .from("stock_movements")
          .select(
            "id,variant_id,movement_type,quantity_before,quantity_delta,quantity_after,reason,created_at",
          )
          .in("variant_id", variantIds)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    supabase
      .from("product_images")
      .select("id,variant_id,storage_path,alt_text,is_primary,sort_order")
      .eq("product_id", id)
      .order("sort_order")
      .order("created_at"),
  ]);

  const categories = categoriesResult.data ?? [];
  const attributeTypes = (typesResult.data ?? []) as AttributeType[];
  const attributeValues = (valuesResult.data ?? []) as AttributeValue[];
  const configs = (configResult.data ?? []) as CategoryAttribute[];
  const scope = [
    product.product_categories?.parent_id,
    product.category_id,
  ].filter(Boolean) as string[];
  const resolvedConfig = new Map<string, CategoryAttribute>();
  for (const categoryId of scope) {
    for (const config of configs) {
      if (config.category_id === categoryId) {
        resolvedConfig.set(config.attribute_type_id, config);
      }
    }
  }
  const configuredAttributes = [...resolvedConfig.values()];
  const movements = (movementResult.data ?? []) as Movement[];
  const images = (imageResult.data ?? []) as ProductImage[];
  const skuByVariant = new Map(
    product.product_variants.map((variant) => [variant.id, variant.sku]),
  );
  const productSpecifications = product.product_attribute_values
    .map((selection) => {
      const type = attributeTypes.find(
        (item) => item.id === selection.attribute_type_id,
      );
      const value = attributeValues.find(
        (item) => item.id === selection.attribute_value_id,
      );
      return type && value ? `${type.name}: ${value.value}` : null;
    })
    .filter((value): value is string => Boolean(value));

  return (
    <div className="manager-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{product.product_categories?.name}</p>
          <h1>{product.name}</h1>
          {product.brand ? <p className="product-brand">{product.brand}</p> : null}
          <p>{product.description || "No product description."}</p>
          {productSpecifications.length ? (
            <p className="muted">
              {productSpecifications.join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="header-actions">
          <Link className="secondary-button" href="/store-manager/products">
            Back to products
          </Link>
          <form action={setProductActive}>
            <input name="productId" type="hidden" value={id} />
            <input
              name="active"
              type="hidden"
              value={product.is_active ? "false" : "true"}
            />
            <ConfirmSubmitButton
              className="danger-button"
              message={
                product.is_active
                  ? "Archive this product and all of its variants?"
                  : "Restore this product?"
              }
            >
              {product.is_active ? "Archive product" : "Restore product"}
            </ConfirmSubmitButton>
          </form>
        </div>
      </header>

      {messages.error ? (
        <p className="notice is-error">{messages.error}</p>
      ) : null}
      {messages.message ? (
        <p className="notice is-success">{messages.message}</p>
      ) : null}

      <ProductMediaEditor
        images={images.map((image) => ({
          id: image.id,
          publicUrl: supabase.storage
            .from("product-images")
            .getPublicUrl(image.storage_path).data.publicUrl,
          altText: image.alt_text,
          isPrimary: image.is_primary,
          variantId: image.variant_id,
          sortOrder: image.sort_order,
        }))}
        productId={id}
        variants={product.product_variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
        }))}
      />

      <details className="workspace-card editor-panel">
        <summary>Edit product information</summary>
        <form action={updateProduct} className="form-grid">
          <input name="productId" type="hidden" value={id} />
          <label>
            Category
            <select defaultValue={product.category_id} name="categoryId" required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.parent_id ? "↳ " : ""}
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Product name
            <input defaultValue={product.name} name="name" required />
          </label>
          <label>
            Brand (optional)
            <input defaultValue={product.brand ?? ""} name="brand" />
          </label>
          <label className="wide-field">
            Description
            <textarea
              defaultValue={product.description ?? ""}
              name="description"
              rows={3}
            />
          </label>
          <div className="form-actions wide-field">
            <button className="primary-button" type="submit">
              Save product
            </button>
          </div>
        </form>
      </details>

      <section className="variant-grid">
        {product.product_variants.map((variant) => {
          const status = inventoryStatus({
            isActive: variant.is_active,
            stock: variant.current_stock,
            threshold: variant.low_stock_threshold,
          });
          const selectedValues = Object.fromEntries(
            variant.variant_attribute_values.map((value) => [
              value.attribute_type_id,
              value.attribute_value_id,
            ]),
          );
          const optionLabels = configuredAttributes
            .map((configuration) => {
              const type = attributeTypes.find(
                (item) => item.id === configuration.attribute_type_id,
              );
              const value = attributeValues.find(
                (item) =>
                  item.id === selectedValues[configuration.attribute_type_id],
              );
              return value
                ? `${type?.name ?? "Option"}: ${value.value}`
                : null;
            })
            .filter(Boolean);

          return (
            <article className="workspace-card variant-card" key={variant.id}>
              <div className="variant-card-heading">
                <div>
                  <span className={`status-badge is-${status}`}>{status}</span>
                  <h2>{variant.sku}</h2>
                  {variant.barcode ? (
                    <p className="muted">Barcode: {variant.barcode}</p>
                  ) : null}
                  <p className="muted">
                    {optionLabels.length
                      ? optionLabels.join(" · ")
                      : "Standard product"}
                  </p>
                  <p>
                    {formatPaise(variant.price_paise)} · {variant.current_stock}{" "}
                    in stock · alert at {variant.low_stock_threshold}
                  </p>
                </div>
                <form action={setVariantActive}>
                  <input name="productId" type="hidden" value={id} />
                  <input name="variantId" type="hidden" value={variant.id} />
                  <input
                    name="active"
                    type="hidden"
                    value={variant.is_active ? "false" : "true"}
                  />
                  <ConfirmSubmitButton
                    className="text-button"
                    message={
                      variant.is_active
                        ? `Archive variant ${variant.sku}?`
                        : `Restore variant ${variant.sku}?`
                    }
                  >
                    {variant.is_active ? "Archive" : "Restore"}
                  </ConfirmSubmitButton>
                </form>
              </div>

              <details className="nested-editor">
                <summary>Edit SKU, price, threshold & options</summary>
                <VariantForm
                  action={updateProductVariant}
                  attributeTypes={attributeTypes}
                  attributeValues={attributeValues}
                  barcode={variant.barcode}
                  configuredAttributes={configuredAttributes}
                  lowStockThreshold={variant.low_stock_threshold}
                  openingStock={false}
                  price={(variant.price_paise / 100).toFixed(2)}
                  productId={id}
                  selectedValues={selectedValues}
                  sku={variant.sku}
                  variantId={variant.id}
                />
              </details>

              {variant.is_active ? (
                <div className="stock-actions-grid">
                  <details className="nested-editor">
                    <summary>Add stock</summary>
                    <AddStockPanel
                      currentStock={variant.current_stock}
                      idempotencyKey={randomUUID()}
                      productId={id}
                      variantId={variant.id}
                    />
                  </details>
                  <details className="nested-editor">
                    <summary>Record stock reduction</summary>
                    <StockReductionPanel
                      currentStock={variant.current_stock}
                      idempotencyKey={randomUUID()}
                      productId={id}
                      variantId={variant.id}
                    />
                  </details>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      {configuredAttributes.length > 0 ? (
        <GroupedVariantEditor
          attributeTypes={configuredAttributes
            .map((configuration) =>
              attributeTypes.find(
                (type) => type.id === configuration.attribute_type_id,
              ),
            )
            .filter((type): type is AttributeType => Boolean(type))}
          attributeValues={attributeValues}
          productId={id}
          variants={product.product_variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            price: formatPaise(variant.price_paise),
            stock: variant.current_stock,
            state: variant.is_active ? "Active" : "Archived",
          }))}
        />
      ) : null}

      {product.is_active ? (
        <details className="workspace-card editor-panel">
          <summary>Add another sellable variant</summary>
          <VariantForm
            action={addProductVariant}
            attributeTypes={attributeTypes}
            attributeValues={attributeValues}
            configuredAttributes={configuredAttributes}
            productId={id}
          />
        </details>
      ) : null}

      <section className="workspace-card history-card">
        <div className="section-heading">
          <div>
            <span>Immutable ledger</span>
            <h2>Stock movement history</h2>
          </div>
          <strong>{movements.length}</strong>
        </div>
        {movements.length === 0 ? (
          <p className="muted">No stock movements have been recorded.</p>
        ) : (
          <div className="history-table">
            <div className="history-row history-header">
              <span>When</span>
              <span>SKU</span>
              <span>Type</span>
              <span>Change</span>
              <span>Balance</span>
              <span>Reason</span>
            </div>
            {movements.map((movement) => (
              <div className="history-row" key={movement.id}>
                <span>{DATE_TIME_FORMAT.format(new Date(movement.created_at))}</span>
                <span>{skuByVariant.get(movement.variant_id)}</span>
                <span>{movement.movement_type}</span>
                <strong>
                  {movement.quantity_delta > 0 ? "+" : ""}
                  {movement.quantity_delta}
                </strong>
                <span>
                  {movement.quantity_before} → {movement.quantity_after}
                </span>
                <span>{movement.reason}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
