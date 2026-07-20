import type { ReactNode } from "react";

type VariantImage = Readonly<{
  id: string;
  publicUrl: string;
  altText: string | null;
}>;

type ProductVariantCardProps = Readonly<{
  sku: string;
  barcode: string | null;
  price: string;
  stock: number;
  lowStockThreshold: number;
  status: "healthy" | "low" | "out" | "archived";
  isActive: boolean;
  optionLabels: readonly string[];
  image: VariantImage | null;
  children: ReactNode;
}>;

export function ProductVariantCard({
  sku,
  barcode,
  price,
  stock,
  lowStockThreshold,
  status,
  isActive,
  optionLabels,
  image,
  children,
}: ProductVariantCardProps) {
  return (
    <article className="workspace-card variant-card">
      <div className="variant-card-image">
        {image ? (
          // Supabase public URLs are user-managed runtime content.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={image.altText ?? `${sku} variant`}
            height="480"
            loading="lazy"
            src={image.publicUrl}
            width="480"
          />
        ) : (
          <div aria-label={`${sku} has no image`} className="variant-image-empty">
            No variant image
          </div>
        )}
      </div>

      <div className="variant-card-heading">
        <div>
          <span className={`status-badge is-${status}`}>{status}</span>
          <h2>{sku}</h2>
          {barcode ? <p className="muted">Barcode: {barcode}</p> : null}
          <p className="muted">
            {optionLabels.length ? optionLabels.join(" · ") : "Standard product"}
          </p>
          <p>
            {price} · {stock} in stock · alert at {lowStockThreshold}
          </p>
          {!isActive ? <p className="muted">Removed from active catalog</p> : null}
        </div>
      </div>

      <details className="nested-editor">
        <summary>Edit variant</summary>
        {children}
      </details>
    </article>
  );
}
