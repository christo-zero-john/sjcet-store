import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";

import { requireStoreOperator } from "../../../../features/auth/authorization";
import {
  addProductVariant,
  removeProductImage,
  setProductActive,
  setVariantActive,
  updateProduct,
  updateProductVariant,
} from "../../../../features/catalog/product-actions";
import { inventoryStatus } from "../../../../features/inventory/inventory-status";
import { AddStockPanel } from "../../../../features/store-manager/add-stock-panel";
import { ConfirmSubmitButton } from "../../../../features/store-manager/confirm-submit-button";
import { GroupedVariantEditor } from "../../../../features/store-manager/grouped-variant-editor";
import { ProductVariantCard } from "../../../../features/store-manager/product-variant-card";
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
type ProductOption = {
  attribute_type_id: string;
  is_required: boolean;
  is_variant_axis: boolean;
  sort_order: number;
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
  product_number: number;
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
  product_options: ProductOption[];
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
  variant_id: string;
  storage_path: string;
  alt_text: string | null;
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
  const [productResult, categoriesResult, typesResult, valuesResult] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id,product_number,category_id,name,brand,description,is_active,product_categories(name,parent_id),product_attribute_values(attribute_type_id,attribute_value_id),product_options(attribute_type_id,is_required,is_variant_axis,sort_order),product_variants(id,sku,barcode,price_paise,current_stock,low_stock_threshold,is_active,variant_attribute_values(attribute_type_id,attribute_value_id))",
        )
        .eq("id", id)
        .single(),
      supabase
        .from("product_categories")
        .select("id,name,parent_id")
        .eq("is_active", true)
        .order("sort_order")
        .order("name"),
      supabase.from("attribute_types").select("id,name").order("name"),
      supabase
        .from("attribute_values")
        .select("id,attribute_type_id,value")
        .order("sort_order")
        .order("value"),
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
      .select("id,variant_id,storage_path,alt_text")
      .eq("product_id", id)
      .not("variant_id", "is", null)
      .order("created_at"),
  ]);

  const categories = categoriesResult.data ?? [];
  const attributeTypes = (typesResult.data ?? []) as AttributeType[];
  const attributeValues = (valuesResult.data ?? []) as AttributeValue[];
  const configuredAttributes = [...(product.product_options ?? [])].sort(
    (left, right) => left.sort_order - right.sort_order,
  );
  const movements = (movementResult.data ?? []) as Movement[];
  const images = (imageResult.data ?? []) as unknown as ProductImage[];
  const imageByVariant = new Map(
    images.map((image) => [image.variant_id, image]),
  );
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
          <p className="eyebrow">
            Product #{product.product_number} · {product.product_categories?.name}
          </p>
          <h1>{product.name}</h1>
          {product.brand ? <p className="product-brand">{product.brand}</p> : null}
          <p>{product.description || "No product description."}</p>
          {productSpecifications.length ? (
            <p className="muted">{productSpecifications.join(" · ")}</p>
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
                  ? "Remove this product and all variants from the active catalog?"
                  : "Restore this product to the catalog?"
              }
            >
              {product.is_active
                ? "Remove product from catalog"
                : "Restore product to catalog"}
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

      <section aria-label="Product variants" className="variant-grid">
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
            .filter((configuration) => configuration.is_variant_axis)
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
            .filter((value): value is string => Boolean(value));
          const image = imageByVariant.get(variant.id);
          const cardImage = image
            ? {
                id: image.id,
                publicUrl: supabase.storage
                  .from("product-images")
                  .getPublicUrl(image.storage_path).data.publicUrl,
                altText: image.alt_text,
              }
            : null;

          return (
            <ProductVariantCard
              barcode={variant.barcode}
              image={cardImage}
              isActive={variant.is_active}
              key={variant.id}
              lowStockThreshold={variant.low_stock_threshold}
              optionLabels={optionLabels}
              price={formatPaise(variant.price_paise)}
              sku={variant.sku}
              status={status}
              stock={variant.current_stock}
            >
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

              {image ? (
                <form action={removeProductImage} className="inline-action">
                  <input name="productId" type="hidden" value={id} />
                  <input name="imageId" type="hidden" value={image.id} />
                  <ConfirmSubmitButton
                    className="text-button"
                    message={`Remove the image for ${variant.sku}?`}
                  >
                    Remove variant image
                  </ConfirmSubmitButton>
                </form>
              ) : null}

              <form action={setVariantActive} className="inline-action">
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
                      ? `Remove ${variant.sku} from the catalog? Its purchase history will be preserved.`
                      : `Restore ${variant.sku} to the catalog?`
                  }
                >
                  {variant.is_active
                    ? "Remove from catalog"
                    : "Restore to catalog"}
                </ConfirmSubmitButton>
              </form>

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
            </ProductVariantCard>
          );
        })}
      </section>

      {product.is_active ? (
        <details className="workspace-card editor-panel">
          <summary>Add variant</summary>
          <VariantForm
            action={addProductVariant}
            attributeTypes={attributeTypes}
            attributeValues={attributeValues}
            configuredAttributes={configuredAttributes}
            productId={id}
          />
        </details>
      ) : null}

      <details className="workspace-card editor-panel">
        <summary>Edit product</summary>
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

      {configuredAttributes.length > 0 ? (
        <GroupedVariantEditor
          attributeTypes={configuredAttributes
            .filter((configuration) => configuration.is_variant_axis)
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
            state: variant.is_active ? "Active" : "Removed from catalog",
          }))}
        />
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
