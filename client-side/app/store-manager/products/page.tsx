import Link from "next/link";

import { requireStoreOperator } from "../../../features/auth/authorization";
import { inventoryStatus } from "../../../features/inventory/inventory-status";
import { formatPaise } from "../../../lib/money/paise";

type ProductRow = {
  id: string;
  category_id: string;
  name: string;
  is_active: boolean;
  product_categories: { name: string } | null;
  product_variants: Array<{
    id: string;
    sku: string;
    price_paise: number;
    current_stock: number;
    low_stock_threshold: number;
    is_active: boolean;
  }>;
};
type ProductsPageProps = Readonly<{
  searchParams: Promise<{
    q?: string;
    category?: string;
    state?: string;
    sort?: string;
  }>;
}>;

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim().toLocaleLowerCase() ?? "";
  const state = ["active", "archived", "all"].includes(params.state ?? "")
    ? params.state
    : "active";
  const sort = params.sort === "name-desc" ? "name-desc" : "name-asc";
  const { supabase } = await requireStoreOperator();
  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id,category_id,name,is_active,product_categories(name),product_variants(id,sku,price_paise,current_stock,low_stock_threshold,is_active)",
      )
      .order("name"),
    supabase
      .from("product_categories")
      .select("id,name,parent_id")
      .order("sort_order")
      .order("name"),
  ]);
  const products = ((productsResult.data ?? []) as unknown as ProductRow[])
    .filter((product) => {
      if (state !== "all" && product.is_active !== (state === "active")) {
        return false;
      }
      if (params.category && product.category_id !== params.category) return false;
      return (
        !q ||
        product.name.toLocaleLowerCase().includes(q) ||
        product.product_variants.some((variant) =>
          variant.sku.toLocaleLowerCase().includes(q),
        )
      );
    })
    .sort((left, right) =>
      sort === "name-desc"
        ? right.name.localeCompare(left.name)
        : left.name.localeCompare(right.name),
    );

  return (
    <div className="manager-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Products</h1>
          <p>Manage product families, variants, prices, and lifecycle state.</p>
        </div>
        <Link className="primary-button" href="/store-manager/products/new">
          Add product
        </Link>
      </header>

      {productsResult.error ? (
        <p className="notice is-error">{productsResult.error.message}</p>
      ) : null}

      <form className="filter-bar">
        <label>
          <span>Search</span>
          <input defaultValue={params.q} name="q" placeholder="Product or SKU" />
        </label>
        <label>
          <span>Category</span>
          <select defaultValue={params.category ?? ""} name="category">
            <option value="">All categories</option>
            {(categoriesResult.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.parent_id ? "↳ " : ""}
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>State</span>
          <select defaultValue={state} name="state">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select defaultValue={sort} name="sort">
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select>
        </label>
        <button className="secondary-button" type="submit">
          Apply
        </button>
      </form>

      <section className="workspace-card product-table-card">
        {products.length === 0 ? (
          <div className="table-empty">
            <h2>No matching products</h2>
            <p>Change the filters or add a new product.</p>
          </div>
        ) : (
          <div className="product-table">
            <div className="product-table-header">
              <span>Product</span>
              <span>Variant</span>
              <span>Price</span>
              <span>Stock</span>
              <span>Status</span>
            </div>
            {products.flatMap((product) =>
              product.product_variants.map((variant) => {
                const status = inventoryStatus({
                  isActive: product.is_active && variant.is_active,
                  stock: variant.current_stock,
                  threshold: variant.low_stock_threshold,
                });
                return (
                  <Link
                    className="product-table-row"
                    href={`/store-manager/products/${product.id}`}
                    key={variant.id}
                  >
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.product_categories?.name}</small>
                    </span>
                    <span>{variant.sku}</span>
                    <span>{formatPaise(variant.price_paise)}</span>
                    <span>{variant.current_stock}</span>
                    <span className={`status-text is-${status}`}>{status}</span>
                  </Link>
                );
              }),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
