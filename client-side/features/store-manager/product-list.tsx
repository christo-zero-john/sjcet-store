import Link from "next/link";

type ProductListVariant = Readonly<{
  id: string;
  currentStock: number;
  lowStockThreshold: number;
  isActive: boolean;
}>;

export type ProductListItem = Readonly<{
  id: string;
  name: string;
  categoryName: string;
  isActive: boolean;
  variants: readonly ProductListVariant[];
}>;

export function ProductList({
  products,
}: Readonly<{ products: readonly ProductListItem[] }>) {
  if (products.length === 0) {
    return (
      <div className="table-empty">
        <h2>No matching products</h2>
        <p>Change the filters or add a new product.</p>
      </div>
    );
  }

  return (
    <div className="product-family-list">
      <div className="product-family-header" aria-hidden="true">
        <span>Product</span>
        <span>Variants</span>
        <span>Stock</span>
        <span>Needs attention</span>
        <span>State</span>
      </div>
      {products.map((product) => {
        const activeVariants = product.variants.filter((variant) => variant.isActive);
        const totalStock = activeVariants.reduce(
          (sum, variant) => sum + variant.currentStock,
          0,
        );
        const outCount = activeVariants.filter(
          (variant) => variant.currentStock === 0,
        ).length;
        const lowCount = activeVariants.filter(
          (variant) =>
            variant.currentStock > 0 &&
            variant.currentStock <= variant.lowStockThreshold,
        ).length;

        return (
          <Link
            className="product-family-row"
            href={`/store-manager/products/${product.id}`}
            key={product.id}
          >
            <span>
              <strong>{product.name}</strong>
              <small>{product.categoryName}</small>
            </span>
            <span>{product.variants.length} variants</span>
            <span>{totalStock} total</span>
            <span>
              {lowCount} low · {outCount} out
            </span>
            <span>{product.isActive ? "Active" : "Archived"}</span>
          </Link>
        );
      })}
    </div>
  );
}
