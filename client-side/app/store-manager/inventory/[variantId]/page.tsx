import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStoreOperator } from "../../../../features/auth/authorization";
import { inventoryStatus } from "../../../../features/inventory/inventory-status";
import { AddStockPanel } from "../../../../features/store-manager/add-stock-panel";
import { StockReductionPanel } from "../../../../features/store-manager/stock-reduction-panel";
import { formatPaise } from "../../../../lib/money/paise";

type VariantDetailPageProps = Readonly<{
  params: Promise<{ variantId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}>;

type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  price_paise: number;
  current_stock: number;
  low_stock_threshold: number;
  is_active: boolean;
  products: {
    id: string;
    name: string;
    is_active: boolean;
    product_categories: { name: string } | null;
  } | null;
  variant_attribute_values: Array<{
    attribute_values: {
      value: string;
      attribute_types: { name: string } | null;
    } | null;
  }>;
};

type Movement = {
  id: string;
  movement_type: string;
  quantity_before: number;
  quantity_delta: number;
  quantity_after: number;
  reason: string;
  created_at: string;
};
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function optionSummary(variant: VariantRow): string {
  const values = variant.variant_attribute_values
    .map((selection) => {
      const value = selection.attribute_values;
      return value
        ? `${value.attribute_types?.name ?? "Option"}: ${value.value}`
        : null;
    })
    .filter(Boolean);

  return values.length ? values.join(" · ") : "Standard product";
}

export default async function VariantDetailPage({
  params,
  searchParams,
}: VariantDetailPageProps) {
  const { variantId } = await params;
  const messages = await searchParams;
  const { supabase } = await requireStoreOperator();
  const { data } = await supabase
    .from("product_variants")
    .select(
      "id,product_id,sku,price_paise,current_stock,low_stock_threshold,is_active,products(id,name,is_active,product_categories(name)),variant_attribute_values(attribute_values(value,attribute_types(name)))",
    )
    .eq("id", variantId)
    .single();

  if (!data) notFound();
  const variant = data as unknown as VariantRow;
  const [{ data: siblingData }, { data: movementData }] = await Promise.all([
    supabase
      .from("product_variants")
      .select(
        "id,product_id,sku,price_paise,current_stock,low_stock_threshold,is_active,variant_attribute_values(attribute_values(value,attribute_types(name)))",
      )
      .eq("product_id", variant.product_id)
      .order("sku"),
    supabase
      .from("stock_movements")
      .select(
        "id,movement_type,quantity_before,quantity_delta,quantity_after,reason,created_at",
      )
      .eq("variant_id", variantId)
      .order("created_at", { ascending: false }),
  ]);
  const siblings = (siblingData ?? []) as unknown as VariantRow[];
  const movements = (movementData ?? []) as Movement[];
  const status = inventoryStatus({
    isActive: variant.is_active && Boolean(variant.products?.is_active),
    stock: variant.current_stock,
    threshold: variant.low_stock_threshold,
  });

  return (
    <div className="manager-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {variant.products?.product_categories?.name ?? "Inventory"}
          </p>
          <h1>{variant.products?.name}</h1>
          <p>{optionSummary(variant)}</p>
        </div>
        <Link
          className="secondary-button"
          href={`/store-manager/products/${variant.product_id}`}
        >
          Edit all variants
        </Link>
      </header>

      {messages.error ? (
        <p className="notice is-error">{messages.error}</p>
      ) : null}
      {messages.message ? <p className="notice">{messages.message}</p> : null}

      <div className="variant-detail-layout">
        <div className="variant-detail-main">
          <section className="workspace-card">
            <span className={`status-badge is-${status}`}>{status}</span>
            <h2>{variant.sku}</h2>
            <dl className="detail-list">
              <div>
                <dt>Price</dt>
                <dd>{formatPaise(variant.price_paise)}</dd>
              </div>
              <div>
                <dt>Current stock</dt>
                <dd>{variant.current_stock}</dd>
              </div>
              <div>
                <dt>Low-stock alert</dt>
                <dd>{variant.low_stock_threshold}</dd>
              </div>
            </dl>
          </section>

          {variant.is_active ? (
            <section className="stock-actions-grid">
              <details className="workspace-card">
                <summary>Add stock</summary>
                <AddStockPanel
                  currentStock={variant.current_stock}
                  idempotencyKey={randomUUID()}
                  productId={variant.product_id}
                  returnTo={`/store-manager/inventory/${variant.id}`}
                  variantId={variant.id}
                />
              </details>
              <details className="workspace-card">
                <summary>Record stock reduction</summary>
                <StockReductionPanel
                  currentStock={variant.current_stock}
                  idempotencyKey={randomUUID()}
                  productId={variant.product_id}
                  returnTo={`/store-manager/inventory/${variant.id}`}
                  variantId={variant.id}
                />
              </details>
            </section>
          ) : null}

          <section className="workspace-card">
            <div className="section-heading">
              <div>
                <span>Inventory ledger</span>
                <h2>Movement history</h2>
              </div>
            </div>
            {movements.length ? (
              <div className="movement-list">
                {movements.map((movement) => (
                  <article key={movement.id}>
                    <strong>
                      {movement.quantity_delta > 0 ? "+" : ""}
                      {movement.quantity_delta}
                    </strong>
                    <span>
                      {movement.quantity_before} → {movement.quantity_after}
                    </span>
                    <span>{movement.reason}</span>
                    <time dateTime={movement.created_at}>
                      {DATE_TIME_FORMAT.format(new Date(movement.created_at))}
                    </time>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No stock movements recorded yet.</p>
            )}
          </section>
        </div>

        <aside className="workspace-card sibling-variants" aria-label="Other variants">
          <div className="section-heading">
            <div>
              <span>Product family</span>
              <h2>Other variants</h2>
            </div>
          </div>
          {siblings.map((sibling) => (
            <Link
              aria-current={sibling.id === variant.id ? "page" : undefined}
              className={sibling.id === variant.id ? "is-current" : undefined}
              href={`/store-manager/inventory/${sibling.id}`}
              key={sibling.id}
            >
              <strong>{optionSummary(sibling)}</strong>
              <span>{sibling.sku}</span>
              <span>
                {sibling.current_stock} in stock ·{" "}
                {sibling.is_active ? "Active" : "Archived"}
              </span>
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}
