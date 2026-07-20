---
meta:
  contentType: Reference
  title: Edit products through their sellable variants
  navLabel: Variant-First Product Details
  category: Architecture
---

# Edit products through their sellable variants

This document defines the store-manager product-details layout, variant image ownership, and purchase-history-safe variant lifecycle.

## Goal

Make the product details page represent what the store sells: independently priced and stocked variants. Keep shared product information available without placing a product gallery or shared edit form ahead of the variants.

## Product details layout

The page renders content in this order:

1. shared product heading and lifecycle state;
2. one card for every sellable variant;
3. **Add variant**;
4. **Edit product**;
5. grouped option tools and stock movement history.

Two stored variants always produce two variant cards. The page never combines their images or inventory into a standalone gallery.

## Variant cards

Each card shows:

- the variant image or the shared catalog placeholder;
- selected option values;
- SKU and optional barcode;
- price;
- current stock and low-stock threshold;
- healthy, low-stock, out-of-stock, or archived state;
- **Edit variant**; and
- **Archive variant** or **Restore variant**.

Selecting **Edit variant** expands only that card. The editor changes the SKU, barcode, option values, price, low-stock threshold, and variant image. Stock adjustments remain separate audited operations.

## Variant images

The manager interface supports one optional image per variant. Product-level primary images and galleries are not created or managed.

Existing product-level image rows remain untouched so this UI change never deletes stored data. The product details page ignores those legacy rows. A later cleanup operation requires explicit production-data authorization.

Creating a product accepts images only within its variant rows. Adding or editing a variant accepts one variant image. Replacing an image uploads the new object, updates the variant image record, and removes the previous object after the metadata update succeeds.

## Product actions

**Add variant** opens the existing variant form after the card grid. It never generates combinations automatically.

**Edit product** opens shared fields after **Add variant**:

- category;
- product name;
- optional brand; and
- description.

Editing shared product information does not edit variant stock, SKU, price, options, or images.

## Variant lifecycle and purchase history

The manager interface never hard-deletes a variant. **Archive variant** removes it from the active catalog while preserving its identifier, stock movements, images, and order history.

`order_lines.variant_id` references `product_variants.id` with `ON DELETE RESTRICT`. A variant referenced by an order cannot be deleted even through a direct database request. Historical order lines also retain immutable name, SKU, option-description, price, and quantity snapshots.

An active product must retain at least one active variant. Restoring a variant requires its parent product to be active.

## Verification

Automated verification covers:

- one card per variant;
- variant image placement;
- no product gallery;
- **Edit variant** inside each card;
- **Add variant** before **Edit product**;
- no primary product image input during creation;
- variant-only image upload and replacement;
- archive/restore wording without a delete action; and
- the restrictive order-line foreign key in the canonical schema.

