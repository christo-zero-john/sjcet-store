const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateProductImage(file: File): File {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Product images must be 5 MB or smaller.");
  }

  return file;
}

export function productImageObjectPath(
  productId: string,
  imageId: string,
  filename: string,
): string {
  const extension = filename.toLocaleLowerCase().match(/\.(jpe?g|png|webp)$/)?.[1];
  const normalizedExtension = extension === "jpeg" ? "jpg" : extension;

  if (!normalizedExtension) {
    throw new Error("Product image filename must include a supported extension.");
  }

  return `products/${productId}/${imageId}.${normalizedExtension}`;
}
