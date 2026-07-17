# Product-First Inventory Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the store-manager catalog and inventory module with product-first navigation, focused product entry, explicit variants, inline category configuration, product media, and audited stock operations.

**Architecture:** Supabase owns catalog integrity, option grandfathering, media metadata, and row-locked stock mutations. Next.js Server Components read manager views, Server Actions call typed feature operations, and focused Client Components own disclosure panels and synchronized controls. The store-manager feature composes catalog and inventory contracts without writing their tables directly.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 5.9.3, Supabase Postgres, Supabase Storage, Zod 4.3.6, Vitest 4.1.10, Playwright 1.61.1, and pnpm.

## Global constraints

- Read `AGENTS.md`, `docs/architecture/project-foundation.md`, `docs/requirements/store_manager.md`, `docs/team/development-guide.md`, `docs/superpowers/specs/2026-07-18-product-first-inventory-management-design.md`, and this plan before each task.
- Treat `docs/testing/store-manager-product-first-ui-acceptance.md` as the user interface acceptance authority.
- Keep the complete Next.js application under `client-side/`.
- Keep the complete Supabase project under `docs/supabase/`.
- Run application commands from `client-side/`.
- Run Supabase commands from `client-side/` with `--workdir ../docs`.
- Update the task migration and `docs/supabase/main_schema.sql` together for every schema change.
- Keep `main_schema.sql` as a clean empty-database setup without migration-history patches, backfills, obsolete objects, or seed data.
- Do not hardcode category, parameter, or parameter-value names.
- Keep category depth at one root plus one optional child.
- Keep catalog visibility independent of department or audience.
- Store money as non-negative integer paise.
- Keep stock writes behind inventory database functions.
- Authorize every manager mutation for `store_manager` and `super_admin`; deny `student`, `print_admin`, and anonymous callers.
- Do not make remote Supabase, Dodo, deployment, or production-data changes.
- Preserve unrelated work, including the untracked `.superpowers/` directory.
- End every task with a test → implementation → review → fix → fresh verification cycle.
- This plan supersedes the catalog and inventory user interface portions of Tasks 5 and 6 in `docs/superpowers/plans/2026-07-17-shared-foundation-store-manager.md`. It does not supersede authentication, orders, payments, or webhooks.

## File map

| Path | Responsibility |
|---|---|
| `docs/supabase/migrations/20260718090000_reference_safe_catalog_options.sql` | Grandfathered required options and reference-safe removal |
| `docs/supabase/migrations/20260718091000_product_images.sql` | Product image metadata, storage bucket, and storage policies |
| `docs/supabase/migrations/20260718092000_idempotent_inventory_operations.sql` | Add-stock and stock-reduction functions |
| `docs/supabase/main_schema.sql` | Canonical current schema for an empty database |
| `docs/supabase/tests/reference_safe_catalog_options.test.sql` | Catalog option integrity and authorization |
| `docs/supabase/tests/product_images.test.sql` | Media ownership, uniqueness, and authorization |
| `docs/supabase/tests/idempotent_inventory_operations.test.sql` | Locked and idempotent stock behavior |
| `client-side/features/catalog/contracts.ts` | Catalog read and mutation types |
| `client-side/features/catalog/sku.ts` | Editable SKU suggestion and normalization |
| `client-side/features/catalog/product-images.ts` | Image input validation and storage operations |
| `client-side/features/catalog/actions.ts` | Category, parameter, usage, and removal actions |
| `client-side/features/catalog/product-actions.ts` | Product, variant, bulk edit, and media actions |
| `client-side/features/catalog/index.ts` | Catalog public feature surface |
| `client-side/features/inventory/contracts.ts` | Stock operation types and stable error codes |
| `client-side/features/inventory/stock-input.ts` | Target-count and reduction validation |
| `client-side/features/inventory/actions.ts` | Add-stock and reduction Server Actions |
| `client-side/features/inventory/index.ts` | Inventory public feature surface |
| `client-side/features/store-manager/manager-shell.tsx` | Daily-work and maintenance navigation |
| `client-side/features/store-manager/product-list.tsx` | One-row-per-product list |
| `client-side/features/store-manager/inventory-list.tsx` | One-row-per-variant list |
| `client-side/features/store-manager/product-form.tsx` | Focused product entry and disclosure |
| `client-side/features/store-manager/category-inline-panel.tsx` | Inline category and parameter creation |
| `client-side/features/store-manager/grouped-variant-editor.tsx` | Explicit variant rows and bulk edits |
| `client-side/features/store-manager/product-media-editor.tsx` | Product gallery and variant images |
| `client-side/features/store-manager/variant-context.tsx` | Selected variant and sibling navigation |
| `client-side/features/store-manager/add-stock-panel.tsx` | Synchronized increase-only controls |
| `client-side/features/store-manager/stock-reduction-panel.tsx` | Confirmed reduction workflow |
| `client-side/features/store-manager/module-placeholder.tsx` | Non-inventory module boundary page |
| `client-side/app/store-manager/page.tsx` | Redirect to Products |
| `client-side/app/store-manager/products/page.tsx` | Product-family read and filtering |
| `client-side/app/store-manager/products/new/page.tsx` | Focused product creation |
| `client-side/app/store-manager/products/[id]/page.tsx` | Product detail and grouped variants |
| `client-side/app/store-manager/inventory/page.tsx` | Variant inventory read and filtering |
| `client-side/app/store-manager/inventory/[variantId]/page.tsx` | Variant detail with sibling context |
| `client-side/app/store-manager/categories/page.tsx` | Catalog Settings maintenance route |
| `client-side/app/store-manager/orders/page.tsx` | Order-management boundary until its plan executes |
| `client-side/app/store-manager/payments/page.tsx` | Payment-management boundary until its plan executes |
| `client-side/app/store-manager/orders/new/page.tsx` | Counter-sale boundary until its plan executes |
| `client-side/app/globals.css` | Responsive, focus, panel, list, and status styles |
| `client-side/playwright.config.ts` | Browser test configuration |
| `client-side/tests/e2e/fixtures/store-manager.ts` | Authenticated deterministic browser fixtures |
| `client-side/tests/e2e/store-manager-product-first.spec.ts` | Browser coverage for `SM-UX-001` through `SM-UX-026` |

### Task 1: Enforce reference-safe catalog options

**Files:**

- Create: `docs/supabase/migrations/20260718090000_reference_safe_catalog_options.sql`
- Create: `docs/supabase/tests/reference_safe_catalog_options.test.sql`
- Modify: `docs/supabase/main_schema.sql`
- Modify: `client-side/scripts/validate-main-schema.mjs`

**Interfaces:**

- Consumes: `private.is_store_operator()`, `category_attributes`, `variant_attribute_values`, and current product/variant functions.
- Produces: `category_attributes.required_from timestamptz`.
- Produces: `public.get_catalog_option_usage(attribute_type_id uuid, attribute_value_id uuid default null) returns jsonb`.
- Produces: `public.remove_attribute_value(target_value_id uuid) returns void`.
- Produces: `public.remove_attribute_type(target_type_id uuid) returns void`.
- Produces: `public.remove_category_attribute(target_category_id uuid, target_attribute_type_id uuid) returns void`.
- Produces: `public.bulk_assign_variant_attribute(target_product_id uuid, target_attribute_type_id uuid, target_attribute_value_id uuid, target_variant_ids uuid[]) returns integer`.

- [ ] **Step 1: Write failing pgTAP coverage**

Create `docs/supabase/tests/reference_safe_catalog_options.test.sql` with cases that prove:

```sql
select throws_ok(
  $$select public.remove_attribute_value('00000000-0000-0000-0000-000000000301')$$,
  '23503',
  'Attribute value is used by 1 variant.',
  'referenced values cannot be removed'
);

select lives_ok(
  $$select public.remove_attribute_value('00000000-0000-0000-0000-000000000302')$$,
  'unreferenced values can be removed'
);

select is(
  (
    select value->>'variant_count'
    from jsonb_each(
      public.get_catalog_option_usage(
        '00000000-0000-0000-0000-000000000201',
        '00000000-0000-0000-0000-000000000301'
      )
    )
    limit 1
  ),
  '1',
  'usage returns the referencing variant count'
);
```

Add allow cases for `store_manager` and `super_admin`. Add deny cases for `student`, `print_admin`, and anonymous roles. Add cases for required-option `required_from`, grandfathered null values, future variant rejection, bulk default assignment, and duplicate-combination rollback.

- [ ] **Step 2: Run the database test and capture the expected failure**

Run from `client-side/`:

```powershell
npx supabase --workdir ../docs test db docs/supabase/tests/reference_safe_catalog_options.test.sql
```

Expected: failure because the usage and removal functions do not exist.

- [ ] **Step 3: Implement the catalog-option migration**

Create the migration with these exact rules:

```sql
alter table public.category_attributes
  add column required_from timestamptz;

update public.category_attributes
set required_from = created_at
where is_required;

alter table public.attribute_types drop column is_active;
alter table public.attribute_values drop column is_active;
alter table public.category_attributes drop column is_active;
```

Add `security definer` functions with `set search_path = ''`. Each function must check `private.is_store_operator()`. Removal functions must count references before deleting and raise SQLSTATE `23503` with a stable message when usage is nonzero.

Update `private.variant_attribute_signature` to accept:

```sql
target_category_id uuid,
selected_variant_values jsonb,
target_variant_created_at timestamptz default now()
```

Require an option only when `is_required` is true and either `required_from` is null or `target_variant_created_at >= required_from`. Pass `now()` for new variants and the stored `created_at` for existing variants.

Implement `bulk_assign_variant_attribute` in one transaction. Lock selected variants in UUID order. Verify that all variants belong to the target product. Recalculate every signature before updating. Reject the whole operation if two signatures collide.

Add a `before delete` trigger on `category_attributes` that rejects removal when a product or variant still uses that configuration. Foreign keys continue to protect attribute types and values.

- [ ] **Step 4: Rebuild the canonical schema declarations**

Edit `docs/supabase/main_schema.sql` in dependency order. Remove the three `is_active` columns and every query predicate that used them. Declare `required_from`, updated functions, triggers, revokes, grants, and comments as final definitions. Do not copy `ALTER`, `DROP`, or data-update history into the canonical script.

- [ ] **Step 5: Extend the structural schema validator**

Update `client-side/scripts/validate-main-schema.mjs` to require:

```js
[
  "required_from timestamptz",
  "create function public.get_catalog_option_usage",
  "create function public.remove_attribute_value",
  "create function public.bulk_assign_variant_attribute",
]
```

Also reject `is_active boolean` declarations inside `attribute_types`, `attribute_values`, and `category_attributes`.

- [ ] **Step 6: Run focused verification**

Run:

```powershell
pnpm schema:check
npx supabase --workdir ../docs test db docs/supabase/tests/reference_safe_catalog_options.test.sql
```

Expected: schema check passes. The database test passes when local Supabase is available. If Docker is unavailable, record that environmental gate and do not claim the database test passed.

- [ ] **Step 7: Review and fix**

Review the migration and canonical schema for:

- direct-delete bypasses
- role escalation
- missing `search_path`
- partial bulk updates
- signature collisions
- migration-history statements in `main_schema.sql`

Fix every confirmed finding. Rerun Step 6 and `git diff --check`.

- [ ] **Step 8: Commit the slice**

```powershell
git add docs/supabase/migrations/20260718090000_reference_safe_catalog_options.sql docs/supabase/tests/reference_safe_catalog_options.test.sql docs/supabase/main_schema.sql client-side/scripts/validate-main-schema.mjs
git commit -m "feat: enforce reference-safe catalog options"
```

### Task 2: Add product and variant image storage

**Files:**

- Create: `docs/supabase/migrations/20260718091000_product_images.sql`
- Create: `docs/supabase/tests/product_images.test.sql`
- Modify: `docs/supabase/main_schema.sql`

**Interfaces:**

- Consumes: `products`, `product_variants`, `private.is_store_operator()`, and Supabase Storage.
- Produces: `public.product_images`.
- Produces: public read access to the `product-images` bucket.
- Produces: store-operator insert, update, and delete policies for `product-images`.

- [ ] **Step 1: Write failing media database tests**

Create tests for one product primary image, multiple gallery images, one image per variant, same-product variant ownership, student write denial, manager write access, and product deletion behavior.

Use assertions shaped like:

```sql
select throws_ok(
  $$insert into public.product_images (
      product_id, variant_id, storage_path, created_by
    ) values (
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000499',
      'products/401/variant.webp',
      '00000000-0000-0000-0000-000000000101'
    )$$,
  '23503',
  null,
  'variant images must reference a variant from the same product'
);
```

- [ ] **Step 2: Run the test and verify the missing-table failure**

```powershell
npx supabase --workdir ../docs test db docs/supabase/tests/product_images.test.sql
```

Expected: failure because `public.product_images` does not exist.

- [ ] **Step 3: Implement media metadata and storage policies**

Create `public.product_images` with:

```sql
id uuid primary key default gen_random_uuid(),
product_id uuid not null,
variant_id uuid,
storage_path text not null unique,
alt_text text,
sort_order integer not null default 0,
is_primary boolean not null default false,
created_by uuid not null references auth.users(id) on delete restrict,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

Add a composite foreign key from `(product_id, variant_id)` to a unique `(product_id, id)` pair on `product_variants`. Add checks for nonblank paths, non-negative sort order, and `is_primary = false` when `variant_id` is nonnull.

Add partial unique indexes:

```sql
create unique index product_images_one_primary
  on public.product_images (product_id)
  where is_primary and variant_id is null;

create unique index product_images_one_per_variant
  on public.product_images (variant_id)
  where variant_id is not null;
```

Enable Row Level Security (RLS). Allow reads to `anon` and `authenticated`. Restrict metadata writes to store operators.

Configure `storage.buckets` for a public `product-images` bucket with:

- `file_size_limit = 5242880`
- MIME types `image/jpeg`, `image/png`, and `image/webp`

Storage write policies must require the first object-path segment to be `products` and `private.is_store_operator()` to return true.

- [ ] **Step 4: Synchronize the canonical schema**

Declare the table, indexes, bucket configuration, grants, RLS, and policies in `docs/supabase/main_schema.sql`. Keep declarations in dependency order.

- [ ] **Step 5: Run, review, and fix**

Run:

```powershell
pnpm schema:check
npx supabase --workdir ../docs test db docs/supabase/tests/product_images.test.sql
```

Review cross-product variant references, anonymous writes, path traversal, duplicate primaries, and orphaned metadata. Fix findings, rerun both commands, and run `git diff --check`.

- [ ] **Step 6: Commit the slice**

```powershell
git add docs/supabase/migrations/20260718091000_product_images.sql docs/supabase/tests/product_images.test.sql docs/supabase/main_schema.sql
git commit -m "feat: add product image storage"
```

### Task 3: Add idempotent stock operations

**Files:**

- Create: `docs/supabase/migrations/20260718092000_idempotent_inventory_operations.sql`
- Create: `docs/supabase/tests/idempotent_inventory_operations.test.sql`
- Modify: `docs/supabase/main_schema.sql`

**Interfaces:**

- Consumes: `private.adjust_stock_internal`, `product_variants`, and `stock_movements`.
- Produces: `public.add_stock_to_count(variant_id uuid, target_count integer, reason text, idempotency_key uuid) returns integer`.
- Produces: `public.record_stock_reduction(variant_id uuid, quantity_to_remove integer, reason text, idempotency_key uuid) returns integer`.
- Produces: `stock_movements.idempotency_key uuid`.
- Produces: `stock_movements.request_fingerprint text`.

- [ ] **Step 1: Write failing stock database tests**

Cover:

- target count cannot be below or equal to locked stock
- reduction quantity must be positive
- reduction cannot exceed locked stock
- reason is required
- archived variant rejection
- manager and super-admin access
- student, print-admin, and anonymous denial
- repeated key with identical input returns the original quantity
- repeated key with changed input raises SQLSTATE `23505`
- concurrent-safe quantity-before and quantity-after records

Use an idempotency assertion:

```sql
select is(
  public.add_stock_to_count(
    '00000000-0000-0000-0000-000000000501',
    20,
    'Semester restock',
    '00000000-0000-0000-0000-000000000601'
  ),
  20,
  'first request sets the target count'
);

select is(
  public.add_stock_to_count(
    '00000000-0000-0000-0000-000000000501',
    20,
    'Semester restock',
    '00000000-0000-0000-0000-000000000601'
  ),
  20,
  'identical retry does not apply twice'
);
```

- [ ] **Step 2: Run the test and verify function-not-found failures**

```powershell
npx supabase --workdir ../docs test db docs/supabase/tests/idempotent_inventory_operations.test.sql
```

- [ ] **Step 3: Implement the stock migration**

Add nullable columns:

```sql
idempotency_key uuid,
request_fingerprint text
```

Create a unique partial index on `idempotency_key` when nonnull.

Build the fingerprint from operation name, variant ID, requested count or quantity, normalized reason, and actor ID. On an existing key:

1. return `quantity_after` when the fingerprint matches;
2. raise SQLSTATE `23505` when it differs.

Both public functions validate input, lock the active variant row with `for update`, compute a signed delta, and call one private movement writer. Revoke public execution and grant only to `authenticated`; each function must still call `private.is_store_operator()`.

Keep `adjust_stock` for order/internal compatibility, but remove it from application-facing manual stock actions.

- [ ] **Step 4: Synchronize the canonical schema**

Rebuild `stock_movements` and function declarations in `main_schema.sql`. Add final indexes, revokes, grants, and comments.

- [ ] **Step 5: Run, review, and fix**

Run schema validation and the focused database test. Review retry races, cross-user key reuse, equal target counts, integer overflow, negative stock, and archived rows. Fix findings and rerun.

- [ ] **Step 6: Commit the slice**

```powershell
git add docs/supabase/migrations/20260718092000_idempotent_inventory_operations.sql docs/supabase/tests/idempotent_inventory_operations.test.sql docs/supabase/main_schema.sql
git commit -m "feat: add idempotent inventory operations"
```

### Task 4: Add typed catalog and inventory contracts

**Files:**

- Create: `client-side/features/catalog/contracts.ts`
- Create: `client-side/features/catalog/sku.ts`
- Create: `client-side/features/catalog/sku.test.ts`
- Create: `client-side/features/catalog/product-images.ts`
- Create: `client-side/features/catalog/product-images.test.ts`
- Create: `client-side/features/catalog/index.ts`
- Create: `client-side/features/inventory/contracts.ts`
- Create: `client-side/features/inventory/stock-input.ts`
- Create: `client-side/features/inventory/stock-input.test.ts`
- Create: `client-side/features/inventory/index.ts`
- Modify: `client-side/features/inventory/inventory-status.ts`
- Modify: `client-side/features/inventory/inventory-status.test.ts`

**Interfaces:**

- Produces: `CatalogOption`, `ProductSummary`, `VariantSummary`, `ProductImage`, and `CatalogUsage`.
- Produces: `CatalogMutationResult<T>`.
- Produces: `suggestSku(input: SkuSuggestionInput): string`.
- Produces: `normalizeSku(value: string): string`.
- Produces: `validateProductImage(file: File): ImageValidationResult`.
- Produces: `parseAddStockInput(input: unknown): AddStockInput`.
- Produces: `parseReductionInput(input: unknown): StockReductionInput`.
- Produces: `InventoryMutationResult`.
- Produces: `summarizeProductStock(variants: readonly StockState[]): ProductStockSummary`.

- [ ] **Step 1: Write failing unit tests**

Add SKU cases:

```ts
expect(
  suggestSku({
    productName: "College Shirt",
    optionValues: ["Blue", "Medium"],
    suffix: "7K2P",
  }),
).toBe("COLLEGE-SHIRT-BLUE-MEDIUM-7K2P");

expect(normalizeSku("  gel pen / blue  ")).toBe("GEL-PEN-BLUE");
```

Add image cases for JPEG, PNG, WebP, unsupported MIME types, zero-byte files, and files above `5 * 1024 * 1024`.

Add stock cases:

```ts
expect(parseAddStockInput({ current: 10, target: 15, reason: "Restock" }))
  .toEqual({ current: 10, target: 15, reason: "Restock" });

expect(() =>
  parseAddStockInput({ current: 10, target: 9, reason: "Restock" }),
).toThrow("New stock count cannot be below current stock.");

expect(() =>
  parseReductionInput({ current: 3, quantity: 4, reason: "Damaged" }),
).toThrow("Only 3 units are available.");
```

- [ ] **Step 2: Run focused tests and verify failure**

```powershell
pnpm test -- features/catalog/sku.test.ts features/catalog/product-images.test.ts features/inventory/stock-input.test.ts features/inventory/inventory-status.test.ts
```

Expected: module-not-found or missing-export failures.

- [ ] **Step 3: Implement focused pure modules**

Use Zod schemas for integer counts, reasons, and file metadata. Keep SKU generation deterministic by accepting the four-character suffix as input. Generate the suffix in the Server Action with `crypto.randomUUID()`.

Implement:

```ts
export type CatalogMutationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: string;
      message: string;
      field?: string;
    };

export type ImageValidationResult =
  | {
      ok: true;
      data: {
        file: File;
        extension: "jpg" | "png" | "webp";
      };
    }
  | {
      ok: false;
      error: "EMPTY_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_IMAGE";
    };

export type InventoryMutationResult =
  | { ok: true; data: { stockAfter: number } }
  | {
      ok: false;
      code:
        | "TARGET_BELOW_CURRENT"
        | "NO_STOCK_CHANGE"
        | "INSUFFICIENT_STOCK"
        | "DUPLICATE_REQUEST_CONFLICT"
        | "VARIANT_ARCHIVED"
        | "INVALID_INPUT";
      message: string;
      currentStock?: number;
    };

export type ProductStockSummary = Readonly<{
  totalStock: number;
  lowCount: number;
  outCount: number;
}>;
```

`summarizeProductStock` excludes archived variants. It counts stock `0` as out and stock from `1` through threshold as low.

Export only public contracts from each `index.ts`.

- [ ] **Step 4: Run focused and static verification**

```powershell
pnpm test -- features/catalog/sku.test.ts features/catalog/product-images.test.ts features/inventory/stock-input.test.ts features/inventory/inventory-status.test.ts
pnpm typecheck
pnpm lint
```

- [ ] **Step 5: Review and fix**

Review integer limits, Unicode normalization, empty option fragments, unsafe filenames, MIME spoofing assumptions, archived-stock exclusion, and deep imports. Fix findings and rerun Step 4.

- [ ] **Step 6: Commit the slice**

```powershell
git add client-side/features/catalog/contracts.ts client-side/features/catalog/sku.ts client-side/features/catalog/sku.test.ts client-side/features/catalog/product-images.ts client-side/features/catalog/product-images.test.ts client-side/features/catalog/index.ts client-side/features/inventory/contracts.ts client-side/features/inventory/stock-input.ts client-side/features/inventory/stock-input.test.ts client-side/features/inventory/index.ts client-side/features/inventory/inventory-status.ts client-side/features/inventory/inventory-status.test.ts
git commit -m "feat: add catalog and inventory contracts"
```

### Task 5: Make Products the manager home

**Files:**

- Modify: `client-side/app/store-manager/page.tsx`
- Modify: `client-side/features/store-manager/manager-shell.tsx`
- Modify: `client-side/features/store-manager/manager-shell.test.tsx`
- Create: `client-side/features/store-manager/product-list.tsx`
- Create: `client-side/features/store-manager/product-list.test.tsx`
- Create: `client-side/features/store-manager/inventory-list.tsx`
- Create: `client-side/features/store-manager/inventory-list.test.tsx`
- Modify: `client-side/app/store-manager/products/page.tsx`
- Modify: `client-side/app/store-manager/inventory/page.tsx`
- Create: `client-side/features/store-manager/module-placeholder.tsx`
- Create: `client-side/app/store-manager/orders/page.tsx`
- Create: `client-side/app/store-manager/payments/page.tsx`
- Create: `client-side/app/store-manager/orders/new/page.tsx`
- Modify: `client-side/app/globals.css`

**Interfaces:**

- Consumes: `ProductSummary`, `VariantSummary`, `summarizeProductStock`, and `inventoryStatus`.
- Produces: `ProductList`.
- Produces: `InventoryList`.

- [ ] **Step 1: Write failing navigation and list tests**

Assert that the shell contains Products, Inventory, Orders, Payments, Counter Sale, and Catalog Settings. Assert that Overview and top-level Categories are absent.

For Products, render a product with two variants and assert:

```ts
expect(markup.match(/College Shirt/g)).toHaveLength(1);
expect(markup).toContain("2 variants");
expect(markup).toContain("1 low");
expect(markup).toContain("1 out");
```

For Inventory, assert one row per variant and links to `/store-manager/inventory/{variantId}`.

- [ ] **Step 2: Run focused tests and verify failures**

```powershell
pnpm test -- features/store-manager/manager-shell.test.tsx features/store-manager/product-list.test.tsx features/store-manager/inventory-list.test.tsx
```

- [ ] **Step 3: Implement navigation and redirect**

Replace the overview page with:

```ts
import { redirect } from "next/navigation";

export default function StoreManagerPage() {
  redirect("/store-manager/products");
}
```

Group the shell navigation under Daily work and Maintenance. Link Catalog Settings to `/store-manager/categories`. Add Payments even if its route remains a later module boundary.

Render `ModulePlaceholder` at Orders, Payments, and Counter Sale routes. Each page names its owning module and links back to Products. Do not add order, payment, or counter-sale business logic in this plan.

- [ ] **Step 4: Implement product and inventory lists**

Move list markup out of route files. Products renders one product row with total stock and low/out counts. Inventory renders one variant row with option labels, SKU, price, stock, threshold, and text status.

Keep search and stock filters visible. Use URL query parameters for filtering and sorting.

- [ ] **Step 5: Add responsive and focus styles**

Add row labels for narrow screens, visible `:focus-visible` styles, status text plus color, and an active navigation state derived from the pathname in a small client navigation component.

- [ ] **Step 6: Run, review, and fix**

Run focused tests, `pnpm typecheck`, and `pnpm lint`. Review `SM-UX-001` through `SM-UX-005`, keyboard order, narrow layouts, and one-row-per-product behavior. Fix findings and rerun.

- [ ] **Step 7: Commit the slice**

```powershell
git add client-side/app/store-manager/page.tsx client-side/app/store-manager/products/page.tsx client-side/app/store-manager/inventory/page.tsx client-side/app/store-manager/orders/page.tsx client-side/app/store-manager/payments/page.tsx client-side/app/store-manager/orders/new/page.tsx client-side/features/store-manager/manager-shell.tsx client-side/features/store-manager/manager-shell.test.tsx client-side/features/store-manager/module-placeholder.tsx client-side/features/store-manager/product-list.tsx client-side/features/store-manager/product-list.test.tsx client-side/features/store-manager/inventory-list.tsx client-side/features/store-manager/inventory-list.test.tsx client-side/app/globals.css
git commit -m "feat: make products the manager home"
```

### Task 6: Build focused product entry and inline catalog setup

**Files:**

- Modify: `client-side/features/catalog/actions.ts`
- Modify: `client-side/features/catalog/product-actions.ts`
- Modify: `client-side/features/store-manager/product-form.tsx`
- Modify: `client-side/features/store-manager/product-form.test.tsx`
- Create: `client-side/features/store-manager/category-inline-panel.tsx`
- Create: `client-side/features/store-manager/category-inline-panel.test.tsx`
- Create: `client-side/features/store-manager/category-parameter-editor.tsx`
- Create: `client-side/features/store-manager/category-parameter-editor.test.tsx`
- Modify: `client-side/app/store-manager/products/new/page.tsx`
- Modify: `client-side/app/store-manager/categories/page.tsx`
- Modify: `client-side/app/globals.css`

**Interfaces:**

- Consumes: Task 1 usage/removal functions and Task 4 contracts.
- Produces: inline category creation that returns the created category ID.
- Produces: `ProductForm` with single-product and explicit-variant modes.
- Produces: parameter usage counts and guarded removal actions.

- [ ] **Step 1: Write failing component tests**

Cover:

- essential product fields render first
- no “variant” heading appears in single-product mode
- category chooser ends with **Add New Category**
- opening the panel keeps product input in component state
- saving a category selects its returned ID
- **Add Parameter** supports existing and new parameters
- referenced values render disabled **Remove**, a count, and **View Products**
- unreferenced values render confirmed removal
- no archive, hide, or unavailable controls appear
- selecting **Add variants** reveals explicit rows without generating combinations

- [ ] **Step 2: Run focused tests and verify failures**

```powershell
pnpm test -- features/store-manager/product-form.test.tsx features/store-manager/category-inline-panel.test.tsx features/store-manager/category-parameter-editor.test.tsx
```

- [ ] **Step 3: Refactor catalog actions to typed results**

Use `CatalogMutationResult<T>` from Task 4 for panel mutations. Keep route-level compatibility wrappers only where full-page forms still need redirects. Never return raw Postgres messages to the browser.

Add actions for usage lookup, value removal, type removal, category-parameter removal, and bulk default assignment.

- [ ] **Step 4: Implement the inline category panel**

Use a modal side panel with:

- `role="dialog"`
- `aria-modal="true"`
- labelled heading
- focus moved to the heading on open
- Escape handling
- unsaved-change confirmation
- focus return to the category trigger

Keep product form state in the parent component. After a successful category action, append the category to local options and set `categoryId` to the returned ID.

- [ ] **Step 5: Implement focused product creation**

Render one page with product details and direct SKU, price, opening stock, threshold, and category-driven option fields. Save one internal default variant when explicit variant mode is off.

When explicit variant mode is on, require the manager to add each row. Submit product and variant rows through one controlled server operation. Do not generate Cartesian products.

Keep **Generate SKU** optional and editable. Map duplicate code `23505` to the SKU field.

- [ ] **Step 6: Simplify Catalog Settings**

Use the category maintenance page for existing category edits. Reuse the same parameter editor and removal rules. Remove separate archive controls for parameter types, values, and category-parameter links.

- [ ] **Step 7: Run, review, and fix**

Run focused tests, typecheck, lint, and build. Review `SM-UX-007` and `SM-UX-009` through `SM-UX-024`, focus trapping, form-state preservation, no hardcoded catalog names, and database error mapping. Fix findings and rerun.

- [ ] **Step 8: Commit the slice**

```powershell
git add client-side/features/catalog/actions.ts client-side/features/catalog/product-actions.ts client-side/features/store-manager/product-form.tsx client-side/features/store-manager/product-form.test.tsx client-side/features/store-manager/category-inline-panel.tsx client-side/features/store-manager/category-inline-panel.test.tsx client-side/features/store-manager/category-parameter-editor.tsx client-side/features/store-manager/category-parameter-editor.test.tsx client-side/app/store-manager/products/new/page.tsx client-side/app/store-manager/categories/page.tsx client-side/app/globals.css
git commit -m "feat: add focused product entry"
```

### Task 7: Add grouped variants, sibling context, and media

**Files:**

- Modify: `client-side/features/catalog/product-actions.ts`
- Create: `client-side/features/store-manager/grouped-variant-editor.tsx`
- Create: `client-side/features/store-manager/grouped-variant-editor.test.tsx`
- Create: `client-side/features/store-manager/product-media-editor.tsx`
- Create: `client-side/features/store-manager/product-media-editor.test.tsx`
- Create: `client-side/features/store-manager/variant-context.tsx`
- Create: `client-side/features/store-manager/variant-context.test.tsx`
- Modify: `client-side/features/store-manager/variant-form.tsx`
- Modify: `client-side/features/store-manager/variant-form.test.tsx`
- Modify: `client-side/app/store-manager/products/[id]/page.tsx`
- Create: `client-side/app/store-manager/inventory/[variantId]/page.tsx`
- Modify: `client-side/app/globals.css`

**Interfaces:**

- Consumes: Task 1 bulk assignment and Task 2 media storage.
- Produces: `updateVariantGroup(input: VariantGroupInput): Promise<CatalogMutationResult<VariantGroup>>`.
- Produces: `uploadProductImage(formData: FormData)`.
- Produces: `setPrimaryProductImage(formData: FormData)`.
- Produces: `removeProductImage(formData: FormData)`.
- Produces: `VariantContext`.

- [ ] **Step 1: Write failing grouped-variant and media tests**

Cover:

- one row per explicit variant
- current SKU remains individually editable
- selected rows accept bulk price, threshold, state, and option default
- stock has no bulk edit field
- adding an option leaves existing rows intact
- grandfathered null renders as **Not assigned**
- future variant requires the option
- selected sibling uses `aria-current="true"`
- sibling link switches to its inventory detail route
- primary image and additional gallery images render
- variant image overrides product image
- missing variant image falls back to primary
- missing all images uses the catalog placeholder

- [ ] **Step 2: Run focused tests and verify failures**

```powershell
pnpm test -- features/store-manager/grouped-variant-editor.test.tsx features/store-manager/product-media-editor.test.tsx features/store-manager/variant-context.test.tsx features/store-manager/variant-form.test.tsx
```

- [ ] **Step 3: Implement grouped editing**

Add these types to `client-side/features/catalog/contracts.ts`:

```ts
export type VariantGroupRowInput = Readonly<{
  id: string;
  sku: string;
  pricePaise: number;
  lowStockThreshold: number;
  isActive: boolean;
  optionValueIds: Readonly<Record<string, string | null>>;
}>;

export type VariantGroupInput = Readonly<{
  productId: string;
  variants: readonly VariantGroupRowInput[];
}>;

export type VariantGroup = Readonly<{
  productId: string;
  variants: readonly VariantSummary[];
}>;
```

Use stable variant IDs as React keys and submitted identifiers. Send changed rows only. Apply bulk changes server-side in one database operation per field group. Keep stock outside this action.

Reject archiving the final active variant with a stable `LAST_ACTIVE_VARIANT` result.

- [ ] **Step 4: Implement product media actions**

Validate files before upload. Build object paths as:

```ts
`products/${productId}/${crypto.randomUUID()}.${extension}`
```

Upload through the server Supabase client. Insert metadata only after upload succeeds. If metadata insertion fails, remove the uploaded object before returning the error.

For removal, delete metadata in a controlled server operation, then delete the object. If object deletion fails, record the path in the returned error so the manager can retry cleanup without losing catalog metadata.

- [ ] **Step 5: Implement product and variant detail layouts**

Product detail shows shared data, gallery, grouped variants, lifecycle actions, and stock history. Inventory variant detail shows parent product/category, selected variant, stock actions, history, and a sibling sidebar.

Use `Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" })` for movement times.

- [ ] **Step 6: Run, review, and fix**

Run focused tests, typecheck, lint, and build. Review `SM-UX-006` through `SM-UX-008` and `SM-UX-018` through `SM-UX-023`, file cleanup, cross-product media ownership, focus state, and no stock/catalog boundary leak. Fix findings and rerun.

- [ ] **Step 7: Commit the slice**

```powershell
git add -- client-side/features/catalog/contracts.ts client-side/features/catalog/product-actions.ts client-side/features/store-manager/grouped-variant-editor.tsx client-side/features/store-manager/grouped-variant-editor.test.tsx client-side/features/store-manager/product-media-editor.tsx client-side/features/store-manager/product-media-editor.test.tsx client-side/features/store-manager/variant-context.tsx client-side/features/store-manager/variant-context.test.tsx client-side/features/store-manager/variant-form.tsx client-side/features/store-manager/variant-form.test.tsx 'client-side/app/store-manager/products/[id]/page.tsx' 'client-side/app/store-manager/inventory/[variantId]/page.tsx' client-side/app/globals.css
git commit -m "feat: add grouped variants and product media"
```

### Task 8: Build separate stock addition and reduction panels

**Files:**

- Modify: `client-side/features/inventory/actions.ts`
- Create: `client-side/features/store-manager/add-stock-panel.tsx`
- Create: `client-side/features/store-manager/add-stock-panel.test.tsx`
- Create: `client-side/features/store-manager/stock-reduction-panel.tsx`
- Create: `client-side/features/store-manager/stock-reduction-panel.test.tsx`
- Modify: `client-side/app/store-manager/products/[id]/page.tsx`
- Modify: `client-side/app/store-manager/inventory/[variantId]/page.tsx`
- Modify: `client-side/app/globals.css`

**Interfaces:**

- Consumes: Task 3 RPCs and Task 4 stock parsing.
- Produces: `addStockToCount(formData: FormData): Promise<InventoryMutationResult>`.
- Produces: `recordStockReduction(formData: FormData): Promise<InventoryMutationResult>`.
- Produces: synchronized `AddStockPanel`.
- Produces: confirmed `StockReductionPanel`.

- [ ] **Step 1: Write failing stock-panel tests**

Use React DOM events to prove:

- input minimum equals current stock
- slider minimum equals current stock
- typing a higher count updates the slider
- moving the slider updates the input
- typing below current stock shows an error
- equal count cannot submit
- increase preview is correct
- reason is required
- reduction has no range input
- reduction preview is correct
- reduction above current stock is rejected
- reduction requires confirmation
- double submission reuses one idempotency key

- [ ] **Step 2: Run focused tests and verify failures**

```powershell
pnpm test -- features/store-manager/add-stock-panel.test.tsx features/store-manager/stock-reduction-panel.test.tsx
```

- [ ] **Step 3: Replace the generic manual adjustment action**

Delete the browser-facing signed-delta form path. Implement two actions that parse values and call:

```ts
supabase.rpc("add_stock_to_count", {
  variant_id: variantId,
  target_count: target,
  reason,
  idempotency_key: idempotencyKey,
});

supabase.rpc("record_stock_reduction", {
  variant_id: variantId,
  quantity_to_remove: quantity,
  reason,
  idempotency_key: idempotencyKey,
});
```

Map stable database errors to `TARGET_BELOW_CURRENT`, `NO_STOCK_CHANGE`, `INSUFFICIENT_STOCK`, `DUPLICATE_REQUEST_CONFLICT`, and `VARIANT_ARCHIVED`.

- [ ] **Step 4: Implement synchronized Add Stock controls**

Initialize:

```ts
const initialMax = Math.max(currentStock + 25, currentStock * 2, 25);
```

Expand the slider maximum when input exceeds it. Never lower the minimum below current stock. Show the calculated increase as `target - currentStock`.

- [ ] **Step 5: Implement confirmed reduction controls**

Use one numeric quantity field and no slider. Show `currentStock - quantity`. Require an explicit confirmation step after valid input and reason. Disable both submit buttons while the action is pending.

- [ ] **Step 6: Run, review, and fix**

Run focused tests, full unit tests, typecheck, lint, and build. Review `SM-UX-025` and `SM-UX-026`, keyboard behavior, duplicate clicks, stale stock, negative stock, movement attribution, and direct `current_stock` writes. Fix findings and rerun.

- [ ] **Step 7: Commit the slice**

```powershell
git add -- client-side/features/inventory/actions.ts client-side/features/store-manager/add-stock-panel.tsx client-side/features/store-manager/add-stock-panel.test.tsx client-side/features/store-manager/stock-reduction-panel.tsx client-side/features/store-manager/stock-reduction-panel.test.tsx 'client-side/app/store-manager/products/[id]/page.tsx' 'client-side/app/store-manager/inventory/[variantId]/page.tsx' client-side/app/globals.css
git commit -m "feat: add guarded stock operations"
```

### Task 9: Add browser acceptance and complete the review-fix cycle

**Files:**

- Create: `client-side/tests/e2e/store-manager-product-first.spec.ts`
- Create: `client-side/tests/e2e/fixtures/store-manager.ts`
- Create: `client-side/playwright.config.ts`
- Modify: `docs/testing/store-manager-product-first-ui-acceptance.md`
- Modify: `docs/requirements/store_manager.md`
- Modify: `docs/architecture/project-foundation.md` only if implementation changed a shared contract
- Modify: `docs/superpowers/plans/2026-07-18-product-first-inventory-management.md`

**Interfaces:**

- Consumes: all prior task interfaces.
- Produces: browser evidence for `SM-UX-001` through `SM-UX-026`.

- [ ] **Step 1: Add deterministic browser fixtures**

Create manager-authenticated test setup with one category, one parameter, referenced and unreferenced values, one product without options, one product with three explicit variants, product images, and stock movement history.

Keep fixture inserts in test setup or local seed helpers. Do not add sample catalog names to the canonical schema.

Configure Playwright with `testDir: "./tests/e2e"`, `baseURL: "http://127.0.0.1:3000"`, trace retention on failure, and a `webServer` command of `pnpm dev`.

- [ ] **Step 2: Implement acceptance groups**

Organize Playwright tests by:

```ts
test.describe("product-first navigation", () => {});
test.describe("focused product entry", () => {});
test.describe("reference-safe catalog configuration", () => {});
test.describe("variant and media context", () => {});
test.describe("stock operations", () => {});
```

Reference the covered `SM-UX-*` IDs in each test title. Assert keyboard focus return for panels, visible text statuses, product state preservation after inline category creation, disabled referenced removals, sibling navigation, image fallback, synchronized stock controls, and confirmed stock reduction.

- [ ] **Step 3: Run browser tests**

```powershell
pnpm test:e2e -- tests/e2e/store-manager-product-first.spec.ts
```

Expected: every configured browser project passes. If the environment lacks browser binaries or local Supabase, record the exact unavailable gate.

- [ ] **Step 4: Run the complete local verification gate**

```powershell
pnpm schema:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
npx supabase --workdir ../docs test db
npx supabase --workdir ../docs db lint
```

Do not report unavailable Supabase commands as passing.

- [ ] **Step 5: Review the complete implementation**

Review:

- all 26 acceptance scenarios
- catalog/inventory/store-manager boundaries
- manager and super-admin allow paths
- student, print-admin, and anonymous deny paths
- RLS and function grants
- migration and canonical-schema parity
- image upload and cleanup behavior
- stock idempotency and locking
- accessibility and responsive layouts
- error messages and preservation of entered values
- absence of hardcoded catalog categories or parameters

Record confirmed findings in the plan under the affected task. Fix them in the owning slice rather than adding cross-feature shortcuts.

- [ ] **Step 6: Repeat verification after fixes**

Rerun every focused command affected by a fix, then rerun Step 4. Use browser inspection for Products, Add Product, product detail, Inventory, variant detail, Add Stock, Record Stock Reduction, and Catalog Settings.

- [ ] **Step 7: Synchronize documentation and task status**

Mark each implemented step complete only after its evidence passes. Update acceptance wording only when implementation clarifies behavior without weakening the approved contract.

- [ ] **Step 8: Commit the acceptance slice**

```powershell
git add client-side/tests/e2e/store-manager-product-first.spec.ts docs/testing/store-manager-product-first-ui-acceptance.md docs/requirements/store_manager.md docs/architecture/project-foundation.md docs/superpowers/plans/2026-07-18-product-first-inventory-management.md
git commit -m "test: verify product-first inventory management"
```

## Plan self-review

- Every `SM-UX-001` through `SM-UX-026` scenario maps to Tasks 5 through 9.
- Tasks 1 through 3 define every new database function consumed by later tasks.
- Task 4 defines every shared TypeScript contract consumed by user interface tasks.
- Product media ownership includes product primary, product gallery, variant override, and fallback behavior.
- Products without options use one internal default variant without exposing variant terminology.
- Managers create variants explicitly; no task generates option combinations.
- Required options use `required_from` to preserve existing null values and validate future variants.
- Referenced parameter removal is disabled in the interface and rejected by the database.
- Parameter types, values, and category links have no archive state.
- Add Stock cannot lower stock and uses a synchronized input and slider.
- Record Stock Reduction is separate, confirmed, and has no slider.
- Manual stock mutations are row-locked, attributable, and idempotent.
- Each database task updates its migration and the canonical schema together.
- Each task ends with a review-fix-verification loop and an independent commit.
- The plan does not authorize remote Supabase, Dodo, deployment, or production-data changes.
