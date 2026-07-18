---
meta:
  contentType: Reference
  title: Manage store products and inventory without catalog complexity
  navLabel: Product-First Inventory Design
  category: Architecture
---

# Manage store products and inventory without catalog complexity

This design defines the product-first store-manager experience and the contracts required to implement it. Managers work with products and stock during daily operations. Category configuration, reusable parameters, and variant internals appear only when the selected task requires them.

## Document plan

- **Goal**: define an implementable product and inventory workflow that satisfies `SM-UX-001` through `SM-UX-026`
- **Audience**: store-manager developers, database reviewers, user interface reviewers, and test authors
- **Content**: navigation, product entry, variants, catalog configuration, images, stock operations, module boundaries, errors, and verification
- **Open questions**: none

## Scope

This delivery redesigns and completes the catalog and inventory portions of the store-manager module. It covers:

- product-first navigation
- product listing and details
- variant listing, creation, and grouped editing
- inline category and parameter creation
- reference-safe parameter removal
- product and variant images
- manual and generated stock keeping units (SKUs)
- stock additions and reductions
- stock movement history
- database integrity and authorization

Order management, payment management, and counter sales remain separate modules. This delivery adds their sidebar destinations but does not redesign their internal workflows.

## Experience structure

The `/store-manager` route redirects to `/store-manager/products`. The application does not show a separate manager dashboard.

The sidebar contains two groups:

- **Daily work**: Products, Inventory, Orders, Payments, Counter Sale
- **Maintenance**: Catalog Settings

**Products** lists one row per product family. Each row shows the category, variant count, combined stock state, and lifecycle state. Search and stock-state filters remain visible beside the list. **Add Product** is the primary action.

**Inventory** lists one row per sellable variant. Each row shows the product name, option values, SKU, price, stock count, low-stock threshold, and state. Products without options still have one internal variant, but the interface describes them as products.

An Inventory variant is out of stock at zero units. It is low in stock above zero and at or below its threshold. It is healthy above its threshold. A Products row shows total stock plus low-stock and out-of-stock variant counts.

Catalog visibility does not depend on department, faculty, student, or staff membership.

## Focused product entry

**Add Product** uses one page. It does not use a wizard.

The initial page emphasizes:

- product name
- brand
- parent category
- subcategory
- description
- primary image
- category-defined product specifications
- sellable variants

Additional images stay out of the initial path. The manager reveals them only when needed.

The category chooser uses separate **Parent Category** and **Subcategory** dropdowns. Each dropdown ends with an appropriate create action. Selecting **Add Parent Category** or **Add Subcategory** opens a side panel without leaving the product form. The product form keeps every entered value.

When creating a subcategory, the parent chooser includes **Add Parent Category**. The manager can create the missing parent inside the same panel. Saving the parent returns to the unfinished subcategory form and selects the new parent. Saving the subcategory closes the panel and selects both hierarchy levels on the product form.

Selecting a subcategory reveals inherited parent parameters and subcategory parameters. Non-variant parameters appear as shared product specifications. Variant-defining parameters appear in the sellable-variant editor.

Products without options show price, SKU, stock, and low-stock fields directly. Saving creates one product and one default sellable variant in the same transaction.

Products with variant-defining options use explicit sellable rows during creation. For example, **Pinpoint Pen** is one product family and Blue, Black, and Red are separate sellable variants. Each row owns its option values, SKU, price, opening stock, low-stock threshold, optional barcode, optional image, and active state. Shared name, brand, description, images, category, subcategory, and specifications remain on the product family.

## Category and parameter configuration

The inline category panel contains all category-owned configuration:

- category name
- hierarchy level
- parent category when creating a subcategory
- description
- product parameters
- **Add Parameter**

The category hierarchy supports one root and one optional child level. The database rejects cycles and a third level.

The parent-category chooser contains **Add Parent Category**. Creating a parent preserves the unfinished child-category draft, automatically selects the new parent, and returns the manager to the child form.

**Add Parameter** opens a searchable chooser. The manager can select an existing reusable parameter or create one in place. New parameter configuration includes:

- parameter name
- allowed values
- required state
- variant-defining state
- display order

Categories own parameter definitions and allowed values. Products own sellable variants. The schema never hardcodes catalog names such as stationery, uniform, size, or color.

Parent parameters are inherited by child categories. Child categories can add configuration appropriate to their products. The product form renders shared specifications separately from variant-defining options so details are not lost merely because they do not affect SKU or stock.

## Reference-safe parameter removal

The interface allows parameter and value removal only when no product or variant references the target.

When references exist, the interface:

- disables **Remove**
- explains why removal is unavailable
- shows the referencing variant count
- links to the affected products

The database enforces the same rule. A direct or stale client request cannot remove referenced data.

Parameters and values do not have archive, hidden, or unavailable states. Unreferenced data can be removed after confirmation. Product, variant, and category lifecycle rules continue to use archive and restore where historical references require them.

The migration removes manager-controlled active states from parameter types, parameter values, and category-parameter links. Row presence determines whether a category uses a parameter. The application does not expose an operation that changes these records into a retained inactive state.

## Variant ownership and editing

Managers create every sellable variant explicitly. The application does not generate option combinations.

Each variant owns:

- selected option values
- unique SKU
- optional barcode
- price in integer paise
- current stock
- low-stock threshold
- active or archived state
- optional variant image

The grouped variant editor shows one row per variant. Managers can edit individual rows. Selected rows support bulk price, low-stock threshold, lifecycle state, and newly added option defaults. SKU remains an individual field. Stock changes remain inventory operations and never become catalog bulk edits.

Archiving cannot leave an active product without an active sellable variant. The database rejects that transition.

Adding an option never creates, replaces, splits, or duplicates variants. Existing variants retain their identifiers, SKUs, prices, stock counts, thresholds, lifecycle states, and movement histories.

When a manager adds an option, the manager can bulk-assign one default value to selected existing variants. Existing variants can otherwise keep a null value.

If the option is required, the requirement applies to variants created after the option takes effect. Earlier variants remain valid with null. Editing unrelated fields on a grandfathered variant does not force a value. A new variant must select an allowed value before saving.

A bulk default assignment runs in one transaction. The database rejects the entire change if the assigned values would create duplicate option combinations.

## Variant detail context

Opening a variant from Inventory keeps the product family visible.

The detail page shows:

- parent product and category
- selected variant details
- stock actions and movement history
- a sibling-variant side panel

Each sibling entry shows option values, SKU, stock count, and state. The selected entry has a distinct current state. Selecting another entry changes the current variant without returning to Inventory. **Edit All Variants** opens the grouped editor.

## Product and variant images

A product can have one optional primary image and additional gallery images. The manager can reorder gallery images and choose the primary image.

A variant can have one optional image. Variant-specific surfaces use that image when present. Otherwise, they use the product primary image. A product or variant without an image uses the shared catalog placeholder.

Supabase Storage uses a `product-images` bucket. Public catalog reads can access stored product images. Only authorized store managers and super admins can upload, replace, reorder, or remove them through server operations.

The first implementation accepts JPEG, PNG, and WebP files up to 5 MB each. Server validation checks the file type and size before upload. Image database rows store the product, optional variant, object path, alternative text, display order, and primary state.

## SKU entry

Every variant SKU remains globally unique and editable.

The manager can type a SKU or select **Generate SKU**. Generation uses normalized product and option fragments plus a collision-resistant suffix. The generated value remains editable.

The server normalizes the final SKU before saving. A duplicate returns field-level feedback and does not discard other form values. Database uniqueness remains authoritative.

## Add stock

**Add Stock** is available from Inventory and product details. It opens a focused panel for one variant.

The panel contains:

- current stock
- **New stock count** integer input
- synchronized stock slider
- calculated increase
- required reason

The current stock count is the minimum for both controls. Moving the slider updates the input. Editing the input updates the slider. When the input exceeds the slider range, the interface expands the range without changing the entered count.

Confirmation sends the target count, reason, and an idempotency key to the inventory operation. The operation locks the current variant row and recalculates the delta from the latest stock. It rejects a target below the locked count. It also rejects a target equal to the locked count because no movement would occur.

## Record a stock reduction

**Record Stock Reduction** is separate from **Add Stock**. It does not use a slider.

The panel contains:

- current stock
- positive integer quantity to remove
- resulting stock preview
- required reason
- confirmation step

The inventory operation locks the variant, checks the latest stock, and rejects a reduction that would produce negative stock. The operation records one negative delta after confirmation.

Both stock operations record:

- quantity before
- signed delta
- quantity after
- movement type
- reason
- actor
- timestamp
- idempotency key

Retrying the same idempotency key returns the recorded result without applying the movement again. Application code never updates `current_stock` directly.

Reusing an idempotency key with another variant, target, quantity, or reason returns a conflict. It never returns an unrelated earlier result.

## Data model changes

The implementation keeps the current normalized catalog tables and adds the following contracts.

### Product images

`product_images` stores product gallery and variant image records:

| Column | Rule |
|---|---|
| `id` | UUID primary key |
| `product_id` | Required product reference |
| `variant_id` | Optional variant reference that must belong to the same product |
| `storage_path` | Required unique object path |
| `alt_text` | Optional accessible description |
| `sort_order` | Non-negative integer |
| `is_primary` | Allowed only for product-level images |
| audit timestamps and actor | Required |

A partial unique index allows one primary product image. Another partial unique index allows one image per variant.

### Effective required options

`category_attributes` records when a required variant option takes effect. Creating a new required option or changing an option from optional to required sets `required_from`.

New-variant validation compares the operation time with `required_from`. Existing variants remain grandfathered. Controlled bulk assignment can populate a default value without recreating variants.

The migration removes the current `is_active` columns from `attribute_types`, `attribute_values`, and `category_attributes`. Removal functions delete only unreferenced rows and return reference details when deletion is blocked.

### Idempotent stock movements

`stock_movements` gains a nullable unique `idempotency_key`. Manual stock operations require it. Order deductions can continue to use the existing unique order transition contract.

Public manual-stock functions become task-specific:

- `add_stock_to_count(variant_id, target_count, reason, idempotency_key)`
- `record_stock_reduction(variant_id, quantity_to_remove, reason, idempotency_key)`

Both functions call one private row-locking inventory operation. Only `store_manager` and `super_admin` can execute the public functions.

## Module boundaries

The redesign keeps business rules in their owning features:

| Module | Owns | Does not own |
|---|---|---|
| `catalog` | categories, parameters, products, variants, SKUs, prices, images, lifecycle state | stock mutations |
| `inventory` | current stock, stock classification, additions, reductions, movement history | product definitions or prices |
| `store-manager` | route composition and manager task flows | catalog or inventory persistence rules |
| `orders` | order snapshots and stock-consumption requests | manual stock editing |
| `payments` | payment state and provider integration | product, price, or stock writes |

Each feature exports typed operations through its public entry point. Store-manager components do not deep-import another feature’s internals.

## Server operations and data flow

Server Components read product and inventory views. Client Components own local form interactions such as panels, disclosure controls, synchronized stock inputs, and sibling selection.

Server Actions validate form input and call typed catalog or inventory services. The database remains authoritative for role checks, uniqueness, references, hierarchy depth, option validity, stock locking, and audit records.

Mutations return typed success or failure results. Redirects occur only after a successful save. Validation errors keep the manager on the current task and preserve entered values.

## Error handling

The interface maps stable error codes to field or panel feedback:

| Condition | Manager feedback |
|---|---|
| duplicate SKU | Mark the SKU field and keep the form values |
| referenced parameter or value | Disable removal and show reference count |
| stale stock count | Refresh the current count and keep the entered reason |
| invalid stock reduction | Show the available quantity beside the field |
| invalid image | Show accepted formats and the 5 MB limit |
| unauthorized operation | Show an access message without rendering mutation controls |
| concurrent catalog change | Reload affected options and keep unrelated form values |

Unexpected failures show a retry action and a traceable error identifier. Logs include identifiers and state transitions, never secrets or uploaded file content.

## Accessibility and responsive behavior

All controls support keyboard operation and visible focus. Side panels trap focus while open, return focus to their trigger, and close with Escape after confirmation when unsaved data exists.

The stock slider has an accessible name and shares its value with the numeric input. The input remains available for precise entry and assistive technology.

Tables preserve their column headers on desktop. Narrow layouts use labeled rows rather than horizontal overflow for primary actions. Status never relies on color alone.

## Verification and review-fix loop

Every implementation slice follows this sequence:

1. Add or update the focused acceptance, unit, component, or database test.
2. Run the focused test and confirm that it detects the missing behavior.
3. Implement the smallest complete slice.
4. Run focused tests, type checking, and linting.
5. Review the slice against requirements, module boundaries, security, accessibility, and `SM-UX-*` scenarios.
6. Fix every confirmed finding.
7. Repeat review and verification until no confirmed finding remains.
8. Run the broader regression suite before marking the slice complete.

Database slices also update the incremental migration and `docs/supabase/main_schema.sql` in the same change. The canonical schema remains a clean empty-database setup.

Browser verification covers all scenarios in `docs/testing/store-manager-product-first-ui-acceptance.md`. The final gate includes:

- `pnpm schema:check`
- database tests when local Supabase is available
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- focused Playwright acceptance tests
- a browser review of Products, Add Product, product details, Inventory, Add Stock, and Record Stock Reduction

## Completion criteria

Implementation is complete when:

1. all `SM-UX-001` through `SM-UX-026` scenarios pass;
2. product entry does not require catalog-model knowledge;
3. products without options hide variant terminology;
4. products with options expose explicit sellable variants during creation;
5. parent and subcategory choices are separate and can both be created inline;
6. nested parent creation preserves both product and subcategory input;
7. parent and child parameters render as either shared specifications or variant options;
8. referenced parameters and values cannot be removed;
9. images follow product-gallery and optional variant-image ownership;
10. SKU generation remains optional and editable;
11. stock additions cannot reduce stock;
12. stock reductions use a separate confirmed operation;
13. every stock movement is attributable and idempotent;
14. module boundaries remain intact;
15. database authorization and integrity tests cover allow and deny paths; and
16. fresh application and schema verification passes.
