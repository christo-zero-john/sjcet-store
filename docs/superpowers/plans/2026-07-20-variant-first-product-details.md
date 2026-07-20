# Variant-First Product Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended when explicitly authorized) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace product-gallery-first editing with one image-aware card per sellable variant, followed by explicit add-variant and edit-product actions.

**Architecture:** Keep shared product information on `products` and selling information on `product_variants`. Reuse `product_images` only for variant-owned images in manager workflows, preserve legacy product-level rows, and rely on the existing restrictive order-line foreign key plus archive/restore functions for lifecycle safety.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 5.9.3, Supabase Storage/Postgres, Vitest 4.1.10, Playwright 1.61.1, and pnpm.

## Global Constraints

- Preserve unrelated work and existing product-level image rows.
- Do not expose product-level image creation, gallery, ordering, or primary-image controls.
- Render exactly one card per stored variant.
- Keep stock mutations in audited inventory operations.
- Never expose destructive variant deletion.
- Use archive/restore for catalog removal.
- Keep **Add variant** before **Edit product**.
- Do not apply migrations or mutate remote Supabase.

---

### Task 1: Define the variant card contract

**Files:**

- Create: `client-side/features/store-manager/product-variant-card.tsx`
- Create: `client-side/features/store-manager/product-variant-card.test.tsx`

**Interfaces:**

- Consumes: variant identity, commerce fields, option labels, inventory state, optional public image URL, `VariantForm`, and inventory actions.
- Produces: one accessible variant card with **Edit variant** and archive/restore controls.

- [x] **Step 1: Write a failing component test**

Assert that two component instances produce two variant headings, separate images, **Edit variant**, SKU, price, stock, status, and no **Delete variant**.

- [x] **Step 2: Confirm the focused test fails**

Run:

```powershell
pnpm exec vitest run features/store-manager/product-variant-card.test.tsx
```

- [x] **Step 3: Implement the card**

Render the image and summary before a card-local `<details>` editor. Keep stock adjustments and archive/restore inside the matching card.

- [x] **Step 4: Pass the focused test**

Run the same Vitest command and confirm it passes.

---

### Task 2: Move image management into variant editing

**Files:**

- Replace: `client-side/features/store-manager/product-media-editor.tsx`
- Modify: `client-side/features/catalog/product-actions.ts`
- Modify: `client-side/features/catalog/product-actions.test.ts`

**Interfaces:**

- Produces: `VariantImageEditor`.
- Produces: variant-only `saveVariantImage(formData)` and existing `removeProductImage(formData)`.

- [x] **Step 1: Write failing image-boundary tests**

Reject a blank variant ID and prove product creation ignores `primaryImage` while retaining `variantImage:<client_key>`.

- [x] **Step 2: Confirm failure**

Run:

```powershell
pnpm exec vitest run features/catalog/product-actions.test.ts
```

- [x] **Step 3: Implement variant-only image writes**

Require `variantId`, validate ownership through the `(product_id, variant_id)` relationship, update or insert the single image record, and remove the superseded storage object only after metadata succeeds.

- [x] **Step 4: Pass focused tests**

Run the focused action and component tests.

---

### Task 3: Recompose the product details page

**Files:**

- Modify: `client-side/app/store-manager/products/[id]/page.tsx`
- Modify: `client-side/app/globals.css`
- Create: `client-side/features/store-manager/product-detail-layout.test.tsx`

**Interfaces:**

- Consumes: one optional image per variant.
- Produces: variant grid, **Add variant**, then **Edit product**.

- [x] **Step 1: Write a failing layout test**

Assert that the rendered order is variant cards, **Add variant**, then **Edit product**, and that **Product gallery** is absent.

- [x] **Step 2: Confirm failure**

Run the focused layout test.

- [x] **Step 3: Implement the layout**

Ignore `product_images` rows whose `variant_id` is null. Map each remaining image to its variant card. Remove `ProductMediaEditor`, move shared product editing below add-variant, and preserve grouped editing and history.

- [x] **Step 4: Pass focused tests and responsive review**

Verify two-column desktop cards and one-column mobile cards.

---

### Task 4: Remove product-level image creation

**Files:**

- Modify: `client-side/features/store-manager/product-form.tsx`
- Modify: `client-side/features/store-manager/product-form.test.tsx`
- Modify: `client-side/features/catalog/product-actions.ts`

**Interfaces:**

- Removes: `primaryImage` from product creation.
- Retains: `variantImage:<client_key>`.

- [x] **Step 1: Write failing creation tests**

Assert that the product form has no **Primary image** input and each variant row retains **Variant image**.

- [x] **Step 2: Confirm failure**

Run product-form and product-action tests.

- [x] **Step 3: Remove the product-level path**

Delete the input and primary-image upload branch without changing the product creation transaction.

- [x] **Step 4: Pass focused tests**

Run product-form, variant-row, and product-action tests.

---

### Task 5: Synchronize requirements and acceptance authority

**Files:**

- Modify: `docs/requirements/store_manager.md`
- Modify: `docs/testing/store-manager-product-first-ui-acceptance.md`
- Modify: `docs/superpowers/specs/2026-07-18-product-first-inventory-management-design.md`
- Modify: `docs/superpowers/specs/2026-07-19-product-options-and-schema-reconciliation-design.md`
- Modify: `docs/superpowers/plans/2026-07-19-product-options-schema-reconciliation.md`

**Interfaces:**

- Produces: one consistent variant-first product-details contract.

- [x] **Step 1: Remove obsolete gallery requirements**

Replace product-primary/gallery wording with one optional variant image and legacy-row preservation.

- [x] **Step 2: Document lifecycle safety**

State that managers archive variants, order history restricts deletion, and historical snapshots remain immutable.

- [x] **Step 3: Reconcile option chooser and migration claims**

Document the immediate reusable-option list, remove obsolete dropdown assertions, and state that migration `006` repairs schemas only after the base application relations exist.

- [x] **Step 4: Validate documentation**

Search for obsolete product-gallery, primary-image, dropdown-copy, and empty-schema claims.

---

### Task 6: Run the complete gate

**Files:**

- Verify all modified files.

**Interfaces:**

- Produces: current evidence for completion.

- [x] **Step 1: Run focused tests**

- [x] **Step 2: Run `pnpm test`**

- [x] **Step 3: Run `pnpm typecheck`**

- [x] **Step 4: Run `pnpm lint`**

- [x] **Step 5: Run `pnpm build`**

- [x] **Step 6: Run `pnpm schema:check` and `git diff --check`**

- [x] **Step 7: Review the final diff against this plan**
