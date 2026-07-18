# E-Commerce Product Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make product creation use explicit parent/subcategory selection, inline hierarchy creation, shared specifications, and independently stocked sellable variants.

**Architecture:** Categories define reusable parameters and inheritance. Product families own shared commerce information; product variants own option combinations, SKU, barcode, price, stock, threshold, image, and lifecycle. One transactional database function creates the family, product specifications, and all explicit variants.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 5.9.3, Supabase Postgres/Storage, Vitest 4.1.10, Playwright 1.61.1, and pnpm.

## Global Constraints

- Follow the approved product-first design and UI acceptance authority.
- Do not hardcode category, subcategory, parameter, or value names.
- Support exactly one root category and one optional child level.
- Preserve product and category drafts during inline creation.
- Treat each colour or other sellable choice as an independent variant with its own stock and SKU.
- Keep product-wide specifications separate from variant axes.
- Keep the single migration and canonical schema synchronized.
- Do not apply remote Supabase changes or use Docker.
- Preserve unrelated work and use test-first review/fix cycles.

---

## File Map

| Path | Responsibility |
|---|---|
| `client-side/features/catalog/product-draft.ts` | Parse and validate shared details and explicit variant rows |
| `client-side/features/store-manager/category-inline-panel.tsx` | Parent/subcategory creation with nested parent flow |
| `client-side/features/store-manager/product-form.tsx` | Detailed family and sellable-variant creation |
| `client-side/features/store-manager/product-variant-rows.tsx` | Explicit variant row editor |
| `client-side/features/catalog/product-actions.ts` | Transactional create RPC and image composition |
| `docs/supabase/migrations/20260718090000_product_first_inventory.sql` | Brand, barcode, and multi-variant creation |
| `docs/supabase/main_schema.sql` | Canonical final catalog schema |
| `docs/supabase/tests/ecommerce_product_entry.test.sql` | Hierarchy, attributes, variants, and authorization |

### Task 1: Define product draft contracts

**Files:**

- Create: `client-side/features/catalog/product-draft.ts`
- Create: `client-side/features/catalog/product-draft.test.ts`
- Modify: `client-side/features/catalog/contracts.ts`

**Interfaces:**

- Produces: `ProductVariantDraft`.
- Produces: `parseProductVariants(formData: FormData): ProductVariantDraft[]`.
- Produces: `selectedProductValues(formData: FormData): Record<string, string>`.

- [ ] **Step 1: Write failing parser tests**

Cover two colour rows with distinct SKU, barcode, prices, stock, and option values; duplicate option combinations; missing required fields; nonnegative numeric validation; and the one-default-variant path for categories without variant axes.

- [ ] **Step 2: Verify red**

Run `pnpm vitest run features/catalog/product-draft.test.ts`.

Expected: module-not-found failure.

- [ ] **Step 3: Implement typed parsing**

Parse row fields named `variant:<rowKey>:sku`, `barcode`, `price`, `openingStock`, `lowStockThreshold`, and `attribute:<typeId>`. Return stable row keys so uploaded variant images can map to created variant IDs.

- [ ] **Step 4: Verify green and review**

Run focused tests. Review duplicate rows, malformed keys, blank optional barcode, money precision, and empty variants.

### Task 2: Add complete family and variant database creation

**Files:**

- Modify: `docs/supabase/migrations/20260718090000_product_first_inventory.sql`
- Modify: `docs/supabase/main_schema.sql`
- Modify: `client-side/scripts/validate-main-schema.mjs`
- Create: `docs/supabase/tests/ecommerce_product_entry.test.sql`

**Interfaces:**

- Adds: `products.brand text`.
- Adds: `product_variants.barcode text` with unique nonblank nonnull values.
- Produces: `public.create_product_with_variants(category_id uuid, product_name text, product_brand text, product_description text, selected_product_values jsonb, variants jsonb) returns jsonb`.

- [ ] **Step 1: Write failing SQL and structural tests**

Cover a Stationery-like root and Pens-like child without hardcoding those values in production code. Prove parent parameter inheritance, child parameter addition, product-wide values, three colour variants, unique SKU/barcode, independent opening stock, duplicate-combination rollback, and role denial.

- [ ] **Step 2: Verify structural red**

Require the new columns and RPC in `validate-main-schema.mjs`; run `pnpm schema:check` and confirm the expected missing-fragment failure.

- [ ] **Step 3: Implement the transactional RPC**

Validate active final category, product values against resolved non-variant configurations, every variant against resolved variant-axis configurations, unique client keys, and nonnegative numeric fields. Insert the product, shared values, variants, option values, opening movements, and one audit event in one transaction. Return:

```json
{
  "product_id": "uuid",
  "variants": [
    { "client_key": "row-key", "variant_id": "uuid" }
  ]
}
```

- [ ] **Step 4: Verify green and review**

Run schema check and `git diff --check`. Review transaction rollback, inheritance precedence, invalid value injection, barcode collision, SKU collision, and authorization.

### Task 3: Correct inline hierarchy creation

**Files:**

- Modify: `client-side/features/store-manager/category-inline-panel.tsx`
- Create: `client-side/features/store-manager/category-inline-panel.test.tsx`
- Modify: `client-side/features/catalog/actions.ts`

**Interfaces:**

- Consumes: `createCategoryInline`.
- Produces: explicit `mode: "parent" | "subcategory"` behavior.
- Produces: nested parent creation that returns to the preserved subcategory draft.

- [ ] **Step 1: Write failing UI tests**

Assert separate parent/subcategory copy, `+ Create parent category` inside the subcategory panel, preservation of child name and parameters after a parent is created, auto-selection of the parent, and absence of third-level controls.

- [ ] **Step 2: Verify red**

Run the focused component test and confirm current markup fails.

- [ ] **Step 3: Implement nested creation**

Keep product form state in the parent component and unfinished subcategory state in the panel. Reuse the same server action for parent creation. After success, merge the returned category/parameter data locally, select the parent, and continue the child form.

- [ ] **Step 4: Verify green and review**

Run focused tests. Review Escape/Close behavior, focus labels, duplicate categories, failed parent save, and draft preservation.

### Task 4: Build explicit parent/subcategory and variant product entry

**Files:**

- Modify: `client-side/features/store-manager/product-form.tsx`
- Modify: `client-side/features/store-manager/product-form.test.tsx`
- Create: `client-side/features/store-manager/product-variant-rows.tsx`
- Create: `client-side/features/store-manager/product-variant-rows.test.tsx`
- Modify: `client-side/app/store-manager/products/new/page.tsx`

**Interfaces:**

- Consumes: resolved categories, parameters, and values.
- Produces: shared product detail controls and explicit variant rows.

- [ ] **Step 1: Write failing UI tests**

Assert separate Parent Category and Subcategory dropdowns; create actions for both; brand; inherited shared specification selects; variant-only option selects; Add Variant; one Blue/Black/Red-like row each with SKU, barcode, price, stock, threshold, and image; and ordinary direct selling fields when no variant axes exist.

- [ ] **Step 2: Verify red**

Run both focused component tests and confirm failures against the current flattened form.

- [ ] **Step 3: Implement the form**

Resolve configurations with child precedence. Render non-variant parameters under Product Details and variant axes in explicit rows. Keep all state controlled so opening and closing category panels does not lose input. Prevent removing the final variant row.

- [ ] **Step 4: Verify green and review**

Run focused tests, typecheck, and lint. Review keyboard access, mobile layout, empty categories, parent-only products, child filtering, duplicate row feedback, and terminology.

### Task 5: Submit and display complete commerce data

**Files:**

- Modify: `client-side/features/catalog/product-actions.ts`
- Modify: `client-side/app/store-manager/products/[id]/page.tsx`
- Modify: `client-side/features/store-manager/grouped-variant-editor.tsx`
- Modify: `client-side/features/store-manager/variant-form.tsx`
- Modify: `client-side/app/globals.css`

**Interfaces:**

- Consumes: `parseProductVariants` and `create_product_with_variants`.
- Produces: post-create image uploads mapped by client row key.

- [ ] **Step 1: Write failing action/source and detail tests**

Assert the create action calls the multi-variant RPC with brand, shared values, and all variant rows. Assert product details show brand and each variant barcode.

- [ ] **Step 2: Verify red**

Run focused tests and confirm the old single-variant RPC causes failure.

- [ ] **Step 3: Implement submission and detail rendering**

Call the transactional RPC once. Upload the product primary image and each provided variant image after database creation, using returned row-key mappings. On upload failure, preserve the created catalog records and redirect to product details with a precise recoverable message.

- [ ] **Step 4: Verify green and review**

Run focused tests, typecheck, lint, and browser review. Fix stale state, mapping, error copy, responsive row layout, and accessibility findings.

### Task 6: Update acceptance authority and run the product-entry gate

**Files:**

- Modify: `docs/testing/store-manager-product-first-ui-acceptance.md`
- Modify: `docs/requirements/store_manager.md`
- Modify: `docs/architecture/project-foundation.md`
- Modify: `client-side/tests/e2e/store-manager-product-first.spec.ts`

- [ ] **Step 1: Add acceptance scenarios**

Add scenarios for parent creation inside subcategory creation, separate hierarchy selectors, shared specifications, explicit three-variant creation, and independent SKU/stock.

- [ ] **Step 2: Update shared docs**

Document family-versus-variant ownership, brand/barcode, hierarchy inheritance, and transactional multi-variant creation.

- [ ] **Step 3: Run the complete gate**

Run:

```powershell
pnpm schema:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
git diff --check
```

Report credential-gated browser skips explicitly.
