import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStoreOperator } from "../../../../features/auth/authorization";
import {
  addProductVariant,
  setProductActive,
  setVariantActive,
  updateProduct,
  updateProductVariant,
} from "../../../../features/catalog/product-actions";
import { adjustVariantStock } from "../../../../features/inventory/actions";
import { inventoryStatus } from "../../../../features/inventory/inventory-status";
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
  description: string | null;
  is_active: boolean;
  product_categories: {
    name: string;
    parent_id: string | null;
  } | null;
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
          "id,category_id,name,description,is_active,product_categories(name,parent_id),product_variants(id,sku,price_paise,current_stock,low_stock_threshold,is_active,variant_attribute_values(attribute_type_id,attribute_value_id))",
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
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("attribute_values")
        .select("id,attribute_type_id,value")
        .eq("is_active", true)
        .order("sort_order")
        .order("value"),
      supabase
        .from("category_attributes")
        .select("category_id,attribute_type_id,is_required,is_variant_axis")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

  if (!productResult.data) notFound();
  const product = productResult.data as unknown as ProductRow;
  const variantIds = product.product_variants.map((variant) => variant.id);
  const movementResult = variantIds.length
    ? await supabase
        .from("stock_movements")
        .select(
          "id,variant_id,movement_type,quantity_before,quantity_delta,quantity_after,reason,created_at",
        )
        .in("variant_id", variantIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

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
  const skuByVariant = new Map(
    product.product_variants.map((variant) => [variant.id, variant.sku]),
  );

  return (
    <div className="manager-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{product.product_categories?.name}</p>
          <h1>{product.name}</h1>
          <p>{product.description || "No product description."}</p>
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
            <button className="danger-button" type="submit">
              {product.is_active ? "Archive product" : "Restore product"}
            </button>
          </form>
        </div>
      </header>

      {messages.error ? (
        <p className="notice is-error">{messages.error}</p>
      ) : null}
      {messages.message ? (
        <p className="notice is-success">{messages.message}</p>
      ) : null}

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

          return (
            <article className="workspace-card variant-card" key={variant.id}>
              <div className="variant-card-heading">
                <div>
                  <span className={`status-badge is-${status}`}>{status}</span>
                  <h2>{variant.sku}</h2>
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
                  <button className="text-button" type="submit">
                    {variant.is_active ? "Archive" : "Restore"}
                  </button>
                </form>
              </div>

              <details className="nested-editor">
                <summary>Edit SKU, price, threshold & options</summary>
                <VariantForm
                  action={updateProductVariant}
                  attributeTypes={attributeTypes}
                  attributeValues={attributeValues}
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

              <form action={adjustVariantStock} className="stock-form">
                <input name="productId" type="hidden" value={id} />
                <input name="variantId" type="hidden" value={variant.id} />
                <label>
                  Stock change
                  <input
                    name="quantityDelta"
                    placeholder="+10 or -2"
                    required
                    type="number"
                  />
                </label>
                <label>
                  Reason
                  <input
                    name="reason"
                    placeholder="Restock, damage, or correction"
                    required
                  />
                </label>
                <button className="secondary-button" type="submit">
                  Record adjustment
                </button>
              </form>
            </article>
          );
        })}
      </section>

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
                <span>{new Date(movement.created_at).toLocaleString("en-IN")}</span>
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
