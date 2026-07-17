import Link from "next/link";

import { requireStoreOperator } from "../../../features/auth/authorization";
import {
  inventoryStatus,
  matchesInventoryFilter,
  normalizeInventoryQuery,
} from "../../../features/inventory/inventory-status";
import { formatPaise } from "../../../lib/money/paise";

type InventoryPageProps = Readonly<{
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}>;
type VariantRow = {
  id: string;
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
};

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const query = normalizeInventoryQuery(await searchParams);
  const { supabase } = await requireStoreOperator();
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id,sku,price_paise,current_stock,low_stock_threshold,is_active,products(id,name,is_active,product_categories(name))",
    );
  const q = query.q.toLocaleLowerCase();
  const variants = ((data ?? []) as unknown as VariantRow[])
    .filter((variant) => {
      const active = variant.is_active && Boolean(variant.products?.is_active);
      return (
        matchesInventoryFilter(
          {
            isActive: active,
            stock: variant.current_stock,
            threshold: variant.low_stock_threshold,
          },
          query.status,
        ) &&
        (!q ||
          variant.sku.toLocaleLowerCase().includes(q) ||
          variant.products?.name.toLocaleLowerCase().includes(q))
      );
    })
    .sort((left, right) => {
      if (query.sort === "stock-asc") {
        return left.current_stock - right.current_stock;
      }
      if (query.sort === "stock-desc") {
        return right.current_stock - left.current_stock;
      }
      return (left.products?.name ?? "").localeCompare(
        right.products?.name ?? "",
      );
    });
  const activeRows = ((data ?? []) as unknown as VariantRow[]).filter(
    (variant) => variant.is_active && variant.products?.is_active,
  );
  const outCount = activeRows.filter((variant) => variant.current_stock === 0).length;
  const lowCount = activeRows.filter(
    (variant) =>
      variant.current_stock > 0 &&
      variant.current_stock <= variant.low_stock_threshold,
  ).length;

  return (
    <div className="manager-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1>Stock control</h1>
          <p>Monitor stock and open a variant to record an adjustment.</p>
        </div>
      </header>

      {error ? <p className="notice is-error">{error.message}</p> : null}

      <section className="summary-grid inventory-summary">
        <article className="summary-card">
          <span>Active variants</span>
          <strong>{activeRows.length}</strong>
          <p>Currently available for store operations</p>
        </article>
        <article className="summary-card">
          <span>Low stock</span>
          <strong>{lowCount}</strong>
          <p>At or below their configured threshold</p>
        </article>
        <article className="summary-card">
          <span>Out of stock</span>
          <strong>{outCount}</strong>
          <p>Require attention before the next sale</p>
        </article>
      </section>

      <form className="filter-bar">
        <label>
          <span>Search</span>
          <input defaultValue={query.q} name="q" placeholder="Product or SKU" />
        </label>
        <label>
          <span>Stock status</span>
          <select defaultValue={query.status} name="status">
            <option value="active">All active</option>
            <option value="attention">Needs attention</option>
            <option value="out">Out of stock</option>
            <option value="low">Low stock</option>
            <option value="healthy">Healthy</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select defaultValue={query.sort} name="sort">
            <option value="name-asc">Product name</option>
            <option value="stock-asc">Lowest stock first</option>
            <option value="stock-desc">Highest stock first</option>
          </select>
        </label>
        <button className="secondary-button" type="submit">
          Apply
        </button>
      </form>

      <section className="workspace-card product-table-card">
        {variants.length === 0 ? (
          <div className="table-empty">
            <h2>No matching inventory</h2>
            <p>Change the filters or create a product variant.</p>
          </div>
        ) : (
          <div className="product-table">
            <div className="product-table-header">
              <span>Product</span>
              <span>SKU</span>
              <span>Price</span>
              <span>Stock</span>
              <span>Status</span>
            </div>
            {variants.map((variant) => {
              const status = inventoryStatus({
                isActive:
                  variant.is_active && Boolean(variant.products?.is_active),
                stock: variant.current_stock,
                threshold: variant.low_stock_threshold,
              });
              return (
                <Link
                  className="product-table-row"
                  href={`/store-manager/products/${variant.products?.id}`}
                  key={variant.id}
                >
                  <span>
                    <strong>{variant.products?.name}</strong>
                    <small>{variant.products?.product_categories?.name}</small>
                  </span>
                  <span>{variant.sku}</span>
                  <span>{formatPaise(variant.price_paise)}</span>
                  <span>
                    {variant.current_stock} / alert {variant.low_stock_threshold}
                  </span>
                  <span className={`status-text is-${status}`}>{status}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
