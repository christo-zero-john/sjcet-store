# Product Options and Schema Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended when explicitly authorized) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair empty, complete, or partially applied Supabase schemas with one idempotent migration while making product options explicitly product-owned and adding simple auto-increment product numbers.

**Architecture:** Keep UUID primary keys and global reusable option definitions. Add `products.product_number` and `product_options`, change product/variant validation to resolve product-owned options, and make category configuration suggestion-only. Deliver every database correction through one rerunnable `006` reconciliation migration while keeping `main_schema.sql` declarative.

**Tech Stack:** PostgreSQL 17/Supabase, PL/pgSQL, Next.js 16 App Router, React 19, TypeScript 5.9, Vitest 4, Playwright 1.61.

## Application Status

- [x] `006-19-07-2026-reconcile-product-options` was manually applied to
  Supabase through the SQL Editor on 2026-07-19 (user confirmed).
- The Supabase migration ledger was not inspected or modified by Codex, so this
  records schema application only and does not claim CLI ledger synchronization.

## Global Constraints

- Do not edit, rename, or delete the five existing migration files.
- Create exactly one new migration:
  `docs/supabase/migrations/20260719125603_006-19-07-2026-reconcile-product-options.sql`.
- The new migration must be safe to run twice and must roll back on incompatible object shapes.
- Keep `docs/supabase/main_schema.sql` as a clean empty-project declaration without repair checks, backfills, or migration history.
- Category parameters are suggestions and are never automatically selected for a product.
- Products explicitly own selected options.
- `products.id` remains UUID; `products.product_number` is the unique generated identity shown to managers.
- Preserve unrelated work in `AGENTS.md`, `CLAUDE.md`, `docs/team/development-guide.md`, and `client-side/scripts/validate-main-schema.mjs`.
- Do not use Docker or mutate Supabase Cloud.
- Every task follows test, fail, implement, pass, review, fix, and fresh verification.

---

## File Map

| File | Responsibility |
|---|---|
| `docs/supabase/migrations/20260719125603_006-19-07-2026-reconcile-product-options.sql` | Idempotent schema reconciliation and current RPC definitions |
| `docs/supabase/main_schema.sql` | Clean canonical final schema |
| `docs/supabase/tests/product_owned_options.test.sql` | Database ownership, validation, backfill, and removal tests |
| `client-side/scripts/validate-main-schema.mjs` | Canonical-schema and new migration structural guard |
| `client-side/features/catalog/contracts.ts` | Product-option and product-number TypeScript contracts |
| `client-side/features/catalog/product-draft.ts` | Immutable explicit-option draft operations |
| `client-side/features/catalog/product-draft.test.ts` | Draft selection/removal regression tests |
| `client-side/features/catalog/product-actions.ts` | Product creation payload with selected options |
| `client-side/features/catalog/product-actions.test.ts` | Server-action payload boundary tests |
| `client-side/features/store-manager/product-option-inline-panel.tsx` | Existing-option chooser and new-option creation |
| `client-side/features/store-manager/product-option-inline-panel.test.tsx` | Chooser and remove-control component tests |
| `client-side/features/store-manager/product-form.tsx` | Explicit selected-option state and draft removal |
| `client-side/features/store-manager/product-form.test.tsx` | No-auto-selection and preservation tests |
| `client-side/app/store-manager/products/new/page.tsx` | Load suggestion and reusable-option data |
| `client-side/app/store-manager/products/page.tsx` | Product-number list/search |
| `client-side/app/store-manager/products/[id]/page.tsx` | Product-number details and persisted options |
| `client-side/features/store-manager/product-list.tsx` | Product-number presentation |
| `client-side/tests/e2e/store-manager-product-first.spec.ts` | Authenticated product-option acceptance |
| `docs/requirements/store_manager.md` | Authoritative corrected behavior |
| `docs/testing/store-manager-product-first-ui-acceptance.md` | UI acceptance scenarios |

---

### Task 1: Add reconciliation and naming guards

**Interfaces:**
- Consumes: the five existing migrations and canonical schema
- Produces: structural validation for the `006` filename and idempotent SQL patterns

- [ ] **Step 1: Extend the schema validator with failing reconciliation checks**

Require the exact migration filename and assert that it contains:

```js
const reconciliationRequirements = new Map([
  ["transaction start", /^\s*begin\s*;/im],
  ["transaction commit", /^\s*commit\s*;/im],
  ["product number", /\bproduct_number\s+bigint\b/i],
  ["product options", /\bcreate table if not exists public\.product_options\b/i],
  ["product creation RPC", /\bcreate or replace function public\.create_product_with_variants\b/i],
  ["schema reload", /\bnotify pgrst,\s*'reload schema'/i],
]);
```

Reject unguarded `add column`, non-replaceable public/private function creation, and unguarded policy/trigger recreation in the new migration.

- [ ] **Step 2: Run the guard and confirm failure**

Run from `client-side/`:

```powershell
pnpm schema:check
```

Expected: FAIL because the `006` reconciliation migration does not exist.

- [ ] **Step 3: Create the migration skeleton**

Create the exact file with:

```sql
begin;

-- Canonical reconciliation sections are added in Task 2.

notify pgrst, 'reload schema';
commit;
```

- [ ] **Step 4: Run the guard**

Expected: FAIL only for the schema elements intentionally supplied by Task 2.

- [ ] **Step 5: Review**

Confirm the validator ignores the five grandfathered files, rejects a seventh file with serial `006`, and does not require migration-only constructs in `main_schema.sql`.

---

### Task 2: Build the idempotent reconciliation migration

**Interfaces:**
- Consumes: canonical table/function/policy definitions
- Produces: `product_options`, `product_number`, and a complete rerunnable current-schema repair

- [ ] **Step 1: Write failing pgTAP coverage**

Add assertions equivalent to:

```sql
select has_column('public', 'products', 'product_number');
select col_is_unique('public', 'products', 'product_number');
select has_table('public', 'product_options');
select has_function(
  'public',
  'create_product_with_variants',
  array['uuid', 'text', 'text', 'text', 'jsonb', 'jsonb', 'jsonb']
);
```

Assert RLS is enabled on `product_options`, its `(product_id,
attribute_type_id)` primary key exists, and the RPC is executable by
`authenticated` but not `anon`.

- [ ] **Step 2: Add guarded foundation reconciliation**

In dependency order, reconcile extensions, schemas, enums, tables, columns,
indexes, and constraints. Use catalog checks such as:

```sql
alter table public.products
  add column if not exists product_number bigint
  generated by default as identity;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_product_number_unique'
  ) then
    alter table public.products
      add constraint products_product_number_unique unique (product_number);
  end if;
end;
$$;
```

For a missing base table, use the complete canonical `create table if not
exists` declaration. Before accepting an existing table, assert required
primary-key column types through `pg_attribute`; raise a named exception on a
conflicting shape.

- [ ] **Step 3: Add `product_options`**

Use:

```sql
create table if not exists public.product_options (
  product_id uuid not null
    references public.products (id) on delete cascade,
  attribute_type_id uuid not null
    references public.attribute_types (id) on delete restrict,
  is_required boolean not null default true,
  is_variant_axis boolean not null default true,
  sort_order integer not null default 0,
  required_from timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, attribute_type_id),
  constraint product_options_sort_order_nonnegative check (sort_order >= 0)
);
```

Enable and force RLS. Recreate select/manage policies after
`drop policy if exists`.

- [ ] **Step 4: Backfill only referenced options**

Insert one row per product/type found in `product_attribute_values` or
`variant_attribute_values`. Resolve defaults from the product category and
parent category when available; otherwise use required/variant defaults based
on where the reference exists. Use `on conflict (product_id,
attribute_type_id) do nothing`.

- [ ] **Step 5: Replace authoritative functions**

Use `create or replace` for all functions consumed by the current application,
including the missing six-argument RPC for compatibility and a new
seven-argument RPC:

```sql
public.create_product_with_variants(
  target_category_id uuid,
  product_name text,
  product_brand text,
  product_description text,
  selected_product_values jsonb,
  selected_product_options jsonb,
  target_variants jsonb
) returns jsonb
```

The six-argument overload delegates with product options inferred from submitted
product and variant attribute keys. The seven-argument overload validates and
persists explicit options.

Replace variant validation with product-aware functions that validate persisted
variants against `product_options`. Keep a creation-time helper accepting the
submitted option configuration before the product exists.

- [ ] **Step 6: Reconcile triggers, policies, storage, and grants**

For every current trigger/policy, drop by exact name with `if exists`, recreate
the canonical definition, and enable/force RLS. Upsert the `product-images`
bucket. Reapply canonical revokes/grants. End with PostgREST reload and commit.

- [ ] **Step 7: Synchronize `main_schema.sql`**

Declare `product_number` directly inside `products`, declare
`product_options` in dependency order, and use only final function signatures
and policies. Do not include `if exists`, backfills, or repair `do` blocks.

- [ ] **Step 8: Verify**

Run:

```powershell
pnpm schema:check
pnpm exec vitest run features/catalog/product-actions.test.ts
```

Expected: PASS. If a disposable database becomes available, apply the
reconciliation twice and run `docs/supabase/tests/*.sql`. Do not mutate Cloud
without explicit authorization.

- [ ] **Step 9: Review and commit**

Review transactionality, data preservation, security-definer search paths,
RLS, grants, overload ambiguity, identity backfill, and rerun safety.

Commit:

```powershell
git add -- docs/supabase/migrations/20260719125603_006-19-07-2026-reconcile-product-options.sql docs/supabase/main_schema.sql docs/supabase/tests/product_owned_options.test.sql client-side/scripts/validate-main-schema.mjs
git commit -m "feat: reconcile product option schema"
```

---

### Task 3: Add explicit option draft contracts

**Interfaces:**
- Produces: `ProductOptionDraft`, `addProductOption`, `removeProductOption`
- Consumes: global reusable types/values and category suggestion defaults

- [ ] **Step 1: Write failing draft tests**

Cover an empty initial option list, selecting exactly one option, rejecting a
duplicate, and removing an option plus its values from every variant without
changing name, description, images, SKU, price, or stock.

- [ ] **Step 2: Confirm failure**

```powershell
pnpm exec vitest run features/catalog/product-draft.test.ts
```

- [ ] **Step 3: Add contracts and immutable helpers**

```ts
export type ProductOptionDraft = Readonly<{
  attributeTypeId: string;
  isRequired: boolean;
  isVariantAxis: boolean;
  sortOrder: number;
}>;
```

Helpers return new arrays and never mutate category configurations.

- [ ] **Step 4: Pass focused tests and review**

Check duplicate prevention, value cleanup, and preservation of unrelated draft
state.

---

### Task 4: Correct the Add Product option chooser

**Interfaces:**
- Consumes: explicit option draft helpers
- Produces: chooser with existing/create paths and remove-from-draft behavior

- [ ] **Step 1: Write failing component tests**

Assert:

```ts
expect(markup).not.toContain("colour Edit");
expect(markup).toContain("Add product option");
expect(markup).toContain("Choose existing option");
expect(markup).toContain("Create new option");
expect(markup).toContain("Remove from product");
```

Add a category-selection test proving category suggestions are not selected.

- [ ] **Step 2: Confirm failure**

```powershell
pnpm exec vitest run features/store-manager/product-form.test.tsx features/store-manager/product-option-inline-panel.test.tsx
```

- [ ] **Step 3: Separate suggestions from selected options**

Initialize selected product options to `[]`. Use effective category
configurations only to order and prefill chooser defaults. Do not derive
selected option chips from category IDs.

- [ ] **Step 4: Implement chooser paths**

Existing selection updates only local draft state. New option creation saves
the reusable type/values, then adds the returned type to local draft state. It
must not attach a `category_attribute` unless the manager is explicitly editing
category settings.

- [ ] **Step 5: Implement removal**

Render **Remove from product** beside each selected draft option. Confirm only
when variant rows contain a selected value for that option. Remove those
values, retain the variant rows, and preserve all unrelated form state.

- [ ] **Step 6: Submit explicit configuration**

Add a hidden JSON field containing selected options. Parse and send it as
`selected_product_options` to the seven-argument RPC.

- [ ] **Step 7: Pass focused tests, review, and commit**

Review category changes, nested category creation, option creation failures,
duplicate choices, focus return, and draft preservation.

---

### Task 5: Persist and display product numbers and options

**Interfaces:**
- Consumes: `product_options` and `products.product_number`
- Produces: product details/list display and persisted-option editing

- [ ] **Step 1: Add failing list/detail tests**

Require `Product #42` display and ensure option editing loads only rows from
`product_options`.

- [ ] **Step 2: Update queries and contracts**

Select `product_number` on product list/detail reads. Load product-owned option
rows for existing-product pages. Preserve UUID route parameters.

- [ ] **Step 3: Add number search**

If the normalized search is a positive integer, include
`product_number = search`; otherwise retain name/SKU search.

- [ ] **Step 4: Implement persisted removal**

Add a product-level RPC/action that deletes `product_options` only when no
product/variant value references the option. Show affected counts and keep the
global reusable option/category suggestion.

- [ ] **Step 5: Pass focused tests, review, and commit**

Review number visibility, UUID leakage, search behavior, reference checks, and
audit events.

---

### Task 6: Complete acceptance and review-fix verification

- [ ] **Step 1: Extend Playwright acceptance**

Cover:

1. select a category and see no selected options;
2. reuse an existing option;
3. remove it from the unsaved product;
4. create a new option;
5. create two explicit variants;
6. save the product;
7. see its product number; and
8. reopen it with only its persisted options.

- [ ] **Step 2: Run the complete local gate**

```powershell
pnpm schema:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright test tests/e2e/store-manager-product-first.spec.ts
```

Record skipped browser/database tests with their exact environmental reason.

- [ ] **Step 3: Perform final review**

Trace category selection, chooser selection, option creation, draft removal,
RPC payload, database validation, product-option persistence, product number,
RLS, and reconciliation rerun behavior. Add a focused regression test before
each confirmed fix.

- [ ] **Step 4: Rerun all affected gates**

Do not report completion with a known finding or without fresh command output.

- [ ] **Step 5: Handoff**

Report the exact runnable SQL file. Explicitly state that `.md` files are
documentation and must not be run in Supabase. Confirm no Cloud or Docker
mutation occurred.
