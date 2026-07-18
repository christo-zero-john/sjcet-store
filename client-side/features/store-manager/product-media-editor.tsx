import {
  removeProductImage,
  reorderProductImage,
  setPrimaryProductImage,
  uploadProductImage,
} from "../catalog/product-actions";
import { ConfirmSubmitButton } from "./confirm-submit-button";

type ProductImage = Readonly<{
  id: string;
  publicUrl: string;
  altText: string | null;
  isPrimary: boolean;
  variantId: string | null;
  sortOrder?: number;
}>;

type MediaVariant = Readonly<{
  id: string;
  sku: string;
}>;

type ProductMediaEditorProps = Readonly<{
  productId: string;
  images: readonly ProductImage[];
  variants: readonly MediaVariant[];
}>;

export function ProductMediaEditor({
  productId,
  images,
  variants,
}: ProductMediaEditorProps) {
  return (
    <section className="workspace-card product-media-editor">
      <div className="section-heading">
        <div>
          <span>Product gallery</span>
          <h2>Images</h2>
        </div>
      </div>

      {images.length ? (
        <div className="media-grid">
          {images.map((image) => (
            <article key={image.id}>
              {/* Supabase public URLs are user-managed runtime content. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={image.altText ?? ""}
                height="320"
                loading="lazy"
                src={image.publicUrl}
                width="320"
              />
              <span>
                {image.variantId
                  ? variants.find((variant) => variant.id === image.variantId)
                      ?.sku ?? "Variant image"
                  : image.isPrimary
                    ? "Primary image"
                    : "Gallery image"}
              </span>
              {!image.variantId && !image.isPrimary ? (
                <form action={setPrimaryProductImage}>
                  <input name="productId" type="hidden" value={productId} />
                  <input name="imageId" type="hidden" value={image.id} />
                  <button className="text-button" type="submit">
                    Make primary
                  </button>
                </form>
              ) : null}
              {!image.variantId ? (
                <form action={reorderProductImage} className="image-order-form">
                  <input name="productId" type="hidden" value={productId} />
                  <input name="imageId" type="hidden" value={image.id} />
                  <label>
                    Order
                    <input
                      defaultValue={image.sortOrder ?? 0}
                      min="0"
                      name="sortOrder"
                      type="number"
                    />
                  </label>
                  <button className="text-button" type="submit">
                    Save order
                  </button>
                </form>
              ) : null}
              <form action={removeProductImage}>
                <input name="productId" type="hidden" value={productId} />
                <input name="imageId" type="hidden" value={image.id} />
                <ConfirmSubmitButton
                  className="text-button"
                  message="Remove this image permanently?"
                >
                  Remove
                </ConfirmSubmitButton>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No product images yet.</p>
      )}

      <details className="nested-editor">
        <summary>Add a gallery or variant image</summary>
        <form action={uploadProductImage} className="form-grid">
          <input name="productId" type="hidden" value={productId} />
          <label>
            Use for
            <select name="variantId">
              <option value="">Product gallery</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  Variant {variant.sku}
                </option>
              ))}
            </select>
          </label>
          <label>
            Image
            <input
              accept="image/jpeg,image/png,image/webp"
              name="image"
              required
              type="file"
            />
          </label>
          <label className="wide-field">
            Alternative text
            <input name="altText" />
          </label>
          <button className="primary-button" type="submit">
            Upload image
          </button>
        </form>
      </details>
    </section>
  );
}
