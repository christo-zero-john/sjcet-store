---
meta:
  contentType: Reference
  title: Choose product options explicitly and repair partial Supabase schemas
  navLabel: Product Options and Schema Reconciliation
  category: Architecture
---

# Choose product options explicitly and repair partial Supabase schemas

## Goal

Correct two related failures in the store-manager product flow:

1. selecting a category must not automatically add every category parameter as
   a product option; and
2. a database that received migrations manually or partially must be repairable
   by running one safe reconciliation migration.

This design also gives every product a simple auto-incrementing number for
manager-facing references without replacing the existing UUID relationships.

## Confirmed root causes

The product form currently resolves `category_attributes` immediately after a
category is selected. Every resolved variant-defining attribute is rendered as
an already-selected product option. Consequently, `Colour` appears even when
the manager never selected it.

The existing removal operation detaches an option from a category. It is not a
remove-from-this-product operation and is disabled when products in the
category use the option.

The live Supabase database is partially applied. The
`category_attributes.required_from` column exists, but
`public.create_product_with_variants(uuid,text,text,text,jsonb,jsonb)` does not.
Rerunning `20260718090000_product_first_inventory.sql` stops at the duplicate
column before reaching the missing function.

## Product option ownership

Reusable option definitions remain global:

- `attribute_types` owns names such as Colour or Size;
- `attribute_values` owns allowed values such as Blue or Medium; and
- edits to a reusable definition continue to affect every product using it.

Category configuration remains useful as a catalog template:

- `category_attributes` defines suggested product parameters and their default
  required, variant-defining, and display-order settings;
- parent-category suggestions remain visible to subcategories; and
- category suggestions are never automatically selected for a product.

Products explicitly own the options they use through `product_options`:

- `product_id`;
- `attribute_type_id`;
- `is_required`;
- `is_variant_axis`;
- `sort_order`;
- `required_from`;
- audit timestamps and actor.

The `(product_id, attribute_type_id)` pair is unique.

Existing products are backfilled from the attribute types already referenced by
their product or variant values. This preserves every current product and
variant without making unused category parameters appear selected.

## Add Product behavior

Selecting a parent category or subcategory does not select any product option.
The Product options section starts empty for a new product.

Selecting **Add product option** opens one focused panel that immediately lists
every available reusable option and also provides **Create a new option**:

1. select an existing reusable option from the visible list; or
2. select **Create a new option** to open the name-and-values form.

Category suggestions appear first, followed by the remaining reusable options.
Choosing an option adds it only to the current product draft. Creating an
option creates the global reusable definition and selects it in the current
draft. It does not silently attach the option to every product in the category.

Each selected option appears as an editable row or chip with:

- the option name;
- **Edit** for its values and per-product configuration; and
- **Remove from product**.

Removing an option from an unsaved product draft always succeeds and preserves
all unrelated product fields. Variant values belonging to that option are
removed from the unsaved variant rows after confirmation.

## Existing product behavior

The product details editor loads `product_options`, not all effective category
attributes.

An option can be removed from an existing product when no stored product or
variant value references it. If references exist, removal is disabled and the
manager sees the number of affected variants. The manager must first update the
variants or product specification values. Global reusable definitions and
category suggestions are not deleted by this operation.

Deleting a global option or allowed value retains the existing reference-safe
rules.

## Database validation

Product and variant validation resolves configuration from `product_options`.
Category configuration supplies selection defaults only and is not an
authoritative statement that every product in that category uses the option.

`create_product_with_variants` receives the explicitly selected product-option
configuration in the same transaction as the product and variants. It:

1. creates the product;
2. inserts the selected `product_options`;
3. validates product specification values against selected non-variant options;
4. validates variant values against selected variant-defining options;
5. requires every required selected option;
6. rejects values from unselected options; and
7. creates stock movements and audit events atomically.

Adding an option to an existing product never creates variants automatically.
The existing grandfathering rule remains: a newly required option may remain
null on older variants, while variants created afterward must select a value.

## Product numbers

`products.id` remains a UUID primary key. Replacing it would require rewriting
every product foreign key, URL, storage path, RPC, audit reference, and existing
deployed row.

`products.product_number` is a generated identity `bigint`, unique and not
null. It is the simple manager-facing Product ID:

```text
Product #1
Product #2
Product #3
```

Application URLs and internal contracts continue to use the UUID. Lists,
details, search, bills, and manager-facing messages display and accept the
product number where appropriate.

## Reconciliation migration

Create one new migration using the required filename convention with serial
`006`. The five existing migrations remain unchanged because they may already
exist in remote migration ledgers.

The reconciliation migration is safe to run more than once after the base
application relations exist. It handles:

- the current complete schema;
- a database where any earlier migration was partially applied; and
- SQL Editor execution that did not update the migration ledger.

It deliberately rejects a database missing the base application tables with a
specific instruction to run `main_schema.sql`. A brand-new project uses
`main_schema.sql`; migration `006` repairs existing or partially applied
application schemas.

It uses:

- `create table if not exists` for missing tables;
- `alter table ... add column if not exists` for additive columns;
- catalog checks before adding or removing constraints;
- `create or replace function` for current function bodies;
- `drop ... if exists` followed by canonical policy and trigger creation;
- idempotent storage-bucket upsert;
- guarded data backfills;
- canonical grants and revokes; and
- `notify pgrst, 'reload schema'`.

The migration runs in one transaction. Any incompatible object shape raises a
specific exception and rolls back instead of silently discarding data.

`docs/supabase/main_schema.sql` remains the clean single-run authority for a
fresh Supabase project. It declares the final tables and functions directly and
does not copy the reconciliation checks or migration-history patches.

## Verification

Database verification covers:

- running the reconciliation migration twice;
- running it against a representative partial schema;
- presence of `create_product_with_variants`;
- product-number identity and uniqueness;
- backfilled product options;
- explicit product-option creation;
- rejection of unselected option values;
- safe removal from unsaved and persisted products; and
- unchanged global reusable definitions after product-option removal.

UI verification covers:

- category selection leaves Product options empty;
- Add product option immediately lists every unselected reusable option and a
  **Create a new option** action;
- selecting an existing option adds only that option;
- creating an option selects it without clearing the product draft;
- removing a draft option succeeds;
- changing category does not inject options;
- product creation succeeds through the reconciled RPC; and
- product lists and details show the simple product number.
