# Inline Catalog Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let store managers edit or safely detach every category and product option that can be created inline, without leaving or clearing the product form.

**Architecture:** Keep catalog mutations behind focused Server Actions and transactional, security-definer PostgreSQL functions. Reuse the existing category and product-option drawers in explicit create/edit modes, keep the product form as the owner of draft and refreshed catalog state, and make global versus category-owned changes visible before saving.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Supabase PostgreSQL/RLS/RPC, Vitest, Playwright, pgTAP, CSS

## Global Constraints

- Keep the complete Next.js application under `client-side/`.
- Keep Supabase migrations, tests, and the canonical clean setup under `docs/supabase/`.
- Do not edit either previously created migration: `20260718090000_product_first_inventory.sql` or `20260718100200_inline_product_options.sql`.
- Add catalog editing through one new migration ordered after `20260718100200_inline_product_options.sql`.
- Update `docs/supabase/main_schema.sql` in the same change as the new migration.
- Do not use Docker. Do not mutate Supabase Cloud without explicit user authorization.
- Category hierarchy remains limited to one parent level and one optional subcategory level.
- Reusable option names and allowed-value labels are global changes.
- Required, variant-defining, and display-order fields belong to one category attachment.
- Detaching an option never deletes its reusable type or allowed values.
- Referenced values and category attachments cannot be removed.
- Preserve unrelated uncommitted work and the entire product draft.
- Every database mutation must authorize the actor, validate integrity, and append an audit event.
- Every task follows test, fail, implement, pass, review, fix, and commit.

---

## File and Interface Map

| File | Responsibility |
|---|---|
| `docs/supabase/migrations/20260718113000_inline_catalog_editing.sql` | Incremental RPCs for category editing, global option editing, scoped usage, and safe detachment |
| `docs/supabase/main_schema.sql` | Clean empty-database equivalent of the new migration |
| `docs/supabase/tests/reference_safe_catalog_options.test.sql` | pgTAP contract checks for the new guarded RPCs |
| `client-side/features/catalog/contracts.ts` | Shared catalog editor result and usage types |
| `client-side/features/catalog/actions.ts` | Store-operator Server Actions that call the RPCs and return refreshed records |
| `client-side/features/store-manager/category-inline-panel.tsx` | One create/edit drawer for parent categories and subcategories |
| `client-side/features/store-manager/product-option-inline-panel.tsx` | One create/edit drawer for reusable options and category attachments |
| `client-side/features/store-manager/product-form.tsx` | Draft-preserving panel routing and local catalog-state replacement |
| `client-side/app/store-manager/products/new/page.tsx` | Loads descriptions and complete category-attachment metadata |
| `client-side/app/globals.css` | Accessible edit chips, inline action rows, usage warning, and disabled removal styling |
| Focused Vitest and Playwright files | Component, action-boundary, and product-workflow regression coverage |

---

### Task 0: Verify and checkpoint the inline-create prerequisite

**Files:**
- Modify only when a confirmed prerequisite defect is found:
  `client-side/app/globals.css`,
  `client-side/features/catalog/actions.ts`,
  `client-side/features/store-manager/product-form.test.tsx`,
  `client-side/features/store-manager/product-form.tsx`,
  `client-side/features/store-manager/product-option-action-boundary.test.ts`,
  `client-side/features/store-manager/product-option-inline-panel.tsx`,
  `client-side/scripts/validate-main-schema.mjs`,
  `client-side/tests/e2e/store-manager-product-first.spec.ts`,
  `docs/supabase/main_schema.sql`,
  `docs/supabase/migrations/20260718100200_inline_product_options.sql`,
  `docs/supabase/tests/ecommerce_product_entry.test.sql`

**Interfaces:**
- Consumes: the current uncommitted inline product-option implementation
- Produces: a verified, tracked baseline that later tasks must not rewrite

- [ ] **Step 1: Confirm the older applied inventory migration is unchanged**

```powershell
git diff --exit-code -- docs/supabase/migrations/20260718090000_product_first_inventory.sql
```

Expected: exit code 0 and no output.

- [ ] **Step 2: Run the prerequisite verification**

From `client-side/`:

```powershell
pnpm schema:check
pnpm exec vitest run features/store-manager/product-form.test.tsx features/store-manager/product-option-action-boundary.test.ts
pnpm typecheck
pnpm lint
```

Expected: every command PASS.

- [ ] **Step 3: Review and fix only confirmed prerequisite defects**

Check that adding an option uses `20260718100200_inline_product_options.sql`,
that `20260718090000_product_first_inventory.sql` remains unchanged, that the
product draft is retained, and that the newly attached option immediately
appears in variant rows. Add a focused regression assertion before any fix and
rerun Step 2.

- [ ] **Step 4: Commit the verified prerequisite**

```powershell
git add -- client-side/app/globals.css client-side/features/catalog/actions.ts client-side/features/store-manager/product-form.test.tsx client-side/features/store-manager/product-form.tsx client-side/features/store-manager/product-option-action-boundary.test.ts client-side/features/store-manager/product-option-inline-panel.tsx client-side/scripts/validate-main-schema.mjs client-side/tests/e2e/store-manager-product-first.spec.ts docs/supabase/main_schema.sql docs/supabase/migrations/20260718100200_inline_product_options.sql docs/supabase/tests/ecommerce_product_entry.test.sql
git commit -m "feat: add inline product options from product entry"
```

Do not stage any other dirty-worktree file.

---

### Task 1: Add the guarded database editing contract

**Files:**
- Create: `docs/supabase/migrations/20260718113000_inline_catalog_editing.sql`
- Modify: `docs/supabase/main_schema.sql`
- Modify: `docs/supabase/tests/reference_safe_catalog_options.test.sql`
- Modify: `client-side/features/store-manager/product-option-action-boundary.test.ts`

**Interfaces:**
- Produces: `public.get_category_option_usage(uuid, uuid) returns jsonb`
- Produces: `public.update_category_inline(uuid, text, uuid, text) returns jsonb`
- Produces: `public.update_catalog_option_inline(uuid, uuid, text, jsonb, boolean, boolean, integer) returns jsonb`
- Consumes: existing `private.is_store_operator()`, `private.enforce_category_depth()`, `private.protect_category_attribute_delete()`, `public.audit_events`, and `public.remove_category_attribute(uuid, uuid)`

- [ ] **Step 1: Extend the pgTAP contract with failing assertions**

Change the plan count and append these exact checks:

```sql
select has_function(
  'public',
  'get_category_option_usage',
  array['uuid', 'uuid'],
  'category-scoped option usage is available before detachment'
);
select has_function(
  'public',
  'update_category_inline',
  array['uuid', 'text', 'uuid', 'text'],
  'inline category editing has one guarded operation'
);
select has_function(
  'public',
  'update_catalog_option_inline',
  array['uuid', 'uuid', 'text', 'jsonb', 'boolean', 'boolean', 'integer'],
  'global option data and category configuration update atomically'
);
select is_definer(
  'public',
  'update_category_inline',
  array['uuid', 'text', 'uuid', 'text'],
  'category editing uses an authorized database boundary'
);
select is_definer(
  'public',
  'update_catalog_option_inline',
  array['uuid', 'uuid', 'text', 'jsonb', 'boolean', 'boolean', 'integer'],
  'option editing uses an authorized database boundary'
);
```

- [ ] **Step 2: Add a failing migration-boundary test**

Add assertions that the two existing migrations remain unchanged and that a later `_inline_catalog_editing.sql` migration owns all three new functions:

```ts
const editingMigration = readdirSync(migrationsDirectory).find((file) =>
  file.endsWith("_inline_catalog_editing.sql"),
);

expect(appliedMigration).not.toContain("update_catalog_option_inline");
expect(upgradeMigrationSource).not.toContain("update_catalog_option_inline");
expect(editingMigration).toBeDefined();
const editingSource = readFileSync(
  resolve(migrationsDirectory, editingMigration!),
  "utf8",
);
expect(editingSource).toContain(
  "create function public.update_category_inline(",
);
expect(editingSource).toContain(
  "create function public.update_catalog_option_inline(",
);
expect(editingSource).toContain(
  "create function public.get_category_option_usage(",
);
```

- [ ] **Step 3: Run the focused tests and confirm failure**

Run from `client-side/`:

```powershell
pnpm exec vitest run features/store-manager/product-option-action-boundary.test.ts
```

Expected: FAIL because `20260718113000_inline_catalog_editing.sql` and the new functions do not exist.

- [ ] **Step 4: Implement category-scoped usage**

Create `public.get_category_option_usage` as `stable security definer`. It must:

```sql
if actor is null or not private.is_store_operator() then
  raise exception using errcode = '42501',
    message = 'Store-manager access is required.';
end if;
```

Its category scope must contain the attachment owner and direct children when the owner is a parent category:

```sql
with category_scope as (
  select target_category_id as category_id
  union all
  select id
  from public.product_categories
  where parent_id = target_category_id
),
referenced_products as (
  select distinct products.id
  from public.products
  join category_scope on category_scope.category_id = products.category_id
  left join public.product_attribute_values
    on product_attribute_values.product_id = products.id
   and product_attribute_values.attribute_type_id =
       target_attribute_type_id
  left join public.product_variants
    on product_variants.product_id = products.id
  left join public.variant_attribute_values
    on variant_attribute_values.variant_id = product_variants.id
   and variant_attribute_values.attribute_type_id =
       target_attribute_type_id
  where product_attribute_values.product_id is not null
     or variant_attribute_values.variant_id is not null
)
```

Return:

```sql
jsonb_build_object(
  'product_count', product_count,
  'variant_count', variant_count,
  'product_ids', product_ids
)
```

- [ ] **Step 5: Implement transactional category editing**

`public.update_category_inline` must normalize the name and slug, lock the selected row, update `name`, `slug`, `parent_id`, and `description`, and return:

```sql
jsonb_build_object(
  'id', target_category_id,
  'name', normalized_name,
  'parent_id', parent_category_id,
  'description', normalized_description
)
```

Use the existing depth trigger for cycle/depth enforcement. Reject a blank name with SQLSTATE `22023`, a missing category with `P0002`, and unauthorised access with `42501`. Append:

```sql
insert into public.audit_events (
  actor_id, action, entity_type, entity_id, metadata
) values (
  actor,
  'catalog.category_updated',
  'category',
  target_category_id,
  jsonb_build_object('parent_id', parent_category_id)
);
```

- [ ] **Step 6: Implement transactional global option editing**

`allowed_values` is a JSON array with this shape:

```json
[
  { "id": "existing-value-uuid", "value": "Blue", "sort_order": 0 },
  { "id": null, "value": "Green", "sort_order": 1 }
]
```

The function must:

1. authorize with `private.is_store_operator()`;
2. lock the owning `category_attributes` row, attribute type, and existing values;
3. reject blank names, empty value arrays, duplicate normalized labels, negative order, unknown value IDs, and value IDs belonging to another type;
4. update the global type name and slug;
5. update existing values and insert new values;
6. identify omitted existing values and reject deletion when either product-value table references them;
7. delete only omitted, unreferenced values;
8. update only the selected attachment's `is_required`, `is_variant_axis`, and `sort_order`;
9. rely on `category_attributes_set_required_from` when required changes from false to true;
10. append `catalog.option_updated` with `category_count`, inserted-value count, updated-value count, and removed-value count.

Return the complete editor payload:

```sql
jsonb_build_object(
  'attribute_type',
  jsonb_build_object('id', target_attribute_type_id, 'name', normalized_name),
  'attribute_values',
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', id,
        'attribute_type_id', attribute_type_id,
        'value', value,
        'sort_order', sort_order
      )
      order by sort_order, value
    )
    from public.attribute_values
    where attribute_type_id = target_attribute_type_id
  ),
  'category_attribute',
  jsonb_build_object(
    'category_id', target_category_id,
    'attribute_type_id', target_attribute_type_id,
    'is_required', option_is_required,
    'is_variant_axis', option_is_variant_axis,
    'sort_order', option_sort_order
  ),
  'category_count',
  (
    select count(*)
    from public.category_attributes
    where attribute_type_id = target_attribute_type_id
  )
)
```

- [ ] **Step 7: Reuse the safe-detachment trigger and expose grants**

Do not duplicate detachment logic. Keep `public.remove_category_attribute` as the mutation; its existing delete reaches `private.protect_category_attribute_delete()`.

For every new public function:

```sql
revoke all on function public.function_name(argument_types)
  from public, anon;
grant execute on function public.function_name(argument_types)
  to authenticated, service_role;
```

End the migration with:

```sql
notify pgrst, 'reload schema';
```

- [ ] **Step 8: Mirror the final objects into the canonical schema**

Place the complete function bodies with other catalog RPCs in `docs/supabase/main_schema.sql`. Add matching grants and revokes in the canonical permission blocks. Do not paste migration-only `create or replace`, upgrade patches, or `notify` statements into the clean schema.

- [ ] **Step 9: Run schema and focused contract verification**

Run from `client-side/`:

```powershell
pnpm schema:check
pnpm exec vitest run features/store-manager/product-option-action-boundary.test.ts
```

Expected: both commands PASS. Run pgTAP only against an explicitly authorised Supabase Cloud target; do not start Docker or mutate Cloud automatically.

- [ ] **Step 10: Review and fix the database slice**

Check authorization, `search_path = ''`, fully qualified relations, row locks, global versus scoped usage, trigger reuse, audit metadata, grants/revokes, and migration immutability. Apply every confirmed correction and rerun Step 9.

- [ ] **Step 11: Commit the database slice**

```powershell
git add -- docs/supabase/migrations/20260718113000_inline_catalog_editing.sql docs/supabase/main_schema.sql docs/supabase/tests/reference_safe_catalog_options.test.sql client-side/features/store-manager/product-option-action-boundary.test.ts
git commit -m "feat: add guarded inline catalog editing"
```

---

### Task 2: Add typed Server Action boundaries

**Files:**
- Modify: `client-side/features/catalog/contracts.ts`
- Modify: `client-side/features/catalog/actions.ts`
- Create: `client-side/features/catalog/inline-catalog-actions.test.ts`
- Modify: `client-side/features/store-manager/category-inline-action-boundary.test.ts`

**Interfaces:**
- Consumes: Task 1 RPCs
- Produces: `updateCategoryInline(previousState, formData)`
- Produces: `loadProductOptionInlineEditor(categoryId, attributeTypeId)`
- Produces: `updateProductOptionInline(previousState, formData)`
- Produces: `detachProductOptionInline(previousState, formData)`
- Produces: `CatalogOptionEditorResult`, `CategoryOptionUsage`, and richer inline mutation states

- [ ] **Step 1: Write failing contract and action tests**

Assert that:

```ts
expect(actionSource).toContain(
  "export async function updateCategoryInline",
);
expect(actionSource).toContain(
  "export async function updateProductOptionInline",
);
expect(actionSource).toContain(
  "export async function loadProductOptionInlineEditor",
);
expect(actionSource).toContain(
  "export async function detachProductOptionInline",
);
expect(actionSource).toMatch(/rpc\(\s*"update_category_inline"/);
expect(actionSource).toMatch(/rpc\(\s*"update_catalog_option_inline"/);
expect(actionSource).toMatch(/rpc\(\s*"get_category_option_usage"/);
expect(actionSource).toMatch(/rpc\(\s*"get_catalog_option_usage"/);
expect(actionSource).toMatch(/rpc\(\s*"remove_category_attribute"/);
```

Add unit cases for malformed `allowedValuesJson`, blank IDs, duplicate labels, and mapping SQLSTATE `23503` to the stable `REFERENCE_IN_USE` result.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
pnpm exec vitest run features/catalog/inline-catalog-actions.test.ts features/store-manager/category-inline-action-boundary.test.ts features/store-manager/product-option-action-boundary.test.ts
```

Expected: FAIL because the types and actions are absent.

- [ ] **Step 3: Extend shared contracts**

Add:

```ts
export type ProductCategory = Readonly<{
  id: string;
  name: string;
  parent_id: string | null;
  description: string | null;
}>;

export type CatalogAttributeValue = Readonly<{
  id: string;
  attribute_type_id: string;
  value: string;
  sort_order: number;
}>;

export type CategoryAttributeConfiguration = Readonly<{
  category_id: string;
  attribute_type_id: string;
  is_required: boolean;
  is_variant_axis: boolean;
  sort_order: number;
  required_from?: string | null;
}>;

export type CategoryOptionUsage = Readonly<{
  product_count: number;
  variant_count: number;
  product_ids: readonly string[];
}>;

export type CatalogOptionEditorResult = Readonly<{
  attributeType: CatalogAttributeType;
  attributeValues: readonly CatalogAttributeValue[];
  categoryAttribute: CategoryAttributeConfiguration;
  categoryCount: number;
}>;
```

Extend inline state with `code?: CatalogMutationCode`, updated records, scoped usage, and detached IDs.

- [ ] **Step 4: Implement `updateCategoryInline`**

Parse `categoryId`, `name`, `parentId`, and `description`; reject blank IDs/names locally; call `update_category_inline`; revalidate the category settings and new-product paths; return the updated category without redirecting.

- [ ] **Step 5: Implement `loadProductOptionInlineEditor`**

Require a store operator, then load the type, values, and owning attachment in
parallel with `get_category_option_usage(categoryId, attributeTypeId)` and
`get_catalog_option_usage(attributeTypeId, null)`. Return:

```ts
{
  attributeType,
  attributeValues,
  categoryAttribute,
  categoryCount: globalUsage.category_count,
  usage: scopedUsage,
}
```

Reject a missing attachment rather than silently editing an inherited child
record; the product form passes the configuration owner's `category_id`.

- [ ] **Step 6: Implement `updateProductOptionInline`**

Parse `allowedValuesJson` as the exact array from Task 1. Reject malformed JSON and duplicate trimmed labels before the RPC. Call `update_catalog_option_inline` and map its snake-case JSON result into `CatalogOptionEditorResult`.

- [ ] **Step 7: Implement safe detachment**

First call `get_category_option_usage`. When `product_count` or `variant_count` is nonzero, return:

```ts
{
  code: "REFERENCE_IN_USE",
  error: "Products in this category use this option, so it cannot be removed.",
  usage,
}
```

Otherwise call `remove_category_attribute`. Treat database SQLSTATE `23503` as the same result to cover stale clients and concurrent usage. On success return:

```ts
{
  detachedCategoryId: categoryId,
  detachedAttributeTypeId: attributeTypeId,
}
```

- [ ] **Step 8: Run focused tests**

```powershell
pnpm exec vitest run features/catalog/inline-catalog-actions.test.ts features/store-manager/category-inline-action-boundary.test.ts features/store-manager/product-option-action-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 9: Review, fix, and commit**

Review input normalization, stable error mapping, redirects, revalidation, and absence of service-role secrets in client code. Fix findings, rerun Step 7, then:

```powershell
git add -- client-side/features/catalog/contracts.ts client-side/features/catalog/actions.ts client-side/features/catalog/inline-catalog-actions.test.ts client-side/features/store-manager/category-inline-action-boundary.test.ts
git commit -m "feat: add inline catalog edit actions"
```

---

### Task 3: Reuse the category drawer for editing

**Files:**
- Modify: `client-side/features/store-manager/category-inline-panel.tsx`
- Modify: `client-side/features/store-manager/category-inline-panel.test.tsx`
- Modify: `client-side/app/globals.css`

**Interfaces:**
- Consumes: `createCategoryInline`, `updateCategoryInline`, `ProductCategory`
- Produces: `CategoryInlinePanel` with `intent: "create" | "edit"` and `category?: ProductCategory`
- Produces: `onSaved(state)` for both create and edit outcomes

- [ ] **Step 1: Write failing component tests**

Render edit mode and assert:

```tsx
expect(markup).toContain("Edit parent category");
expect(markup).toContain('value="Stationery"');
expect(markup).toContain("Category details");
expect(markup).toContain("Product parameters");
expect(markup).toContain("Save changes");
expect(markup).not.toContain("Save and select parent category");
```

Add a subcategory case that preselects its parent and never offers a third hierarchy level.

- [ ] **Step 2: Run the focused test and confirm failure**

```powershell
pnpm exec vitest run features/store-manager/category-inline-panel.test.tsx
```

Expected: FAIL because the panel has no edit intent or prefilled category.

- [ ] **Step 3: Add explicit create/edit props**

Use:

```ts
type CategoryInlinePanelProps = Readonly<{
  categories: readonly ProductCategory[];
  attributeTypes: readonly CatalogAttributeType[];
  attributeValues: readonly CatalogAttributeValue[];
  categoryAttributes: readonly CategoryAttributeConfiguration[];
  mode: "parent" | "subcategory";
  intent: "create" | "edit";
  category?: ProductCategory;
  initialParentId?: string;
  onClose: () => void;
  onSaved: (state: SavedCategoryState) => void;
  onIntermediateCreated?: (state: CreatedCategoryState) => void;
  onEditOption?: (
    categoryId: string,
    attributeTypeId: string,
  ) => void;
}>;
```

Derive one `editing` boolean and choose `createCategoryInline` or `updateCategoryInline` through a small wrapper action. Do not duplicate the drawer markup.

- [ ] **Step 4: Prefill edit fields and preserve nested creation**

Use controlled `name`, `description`, and `parentId` state initialized from `category`. Keep nested parent creation available only while creating/editing a subcategory. When the nested parent is saved, return to the unchanged subcategory form.

Show attached parameters as editable rows with an **Edit** button that calls `onEditOption(configuration.category_id, configuration.attribute_type_id)`. For inherited parameters, label the owning parent category.

- [ ] **Step 5: Add unsaved-close protection and focus behavior**

Track whether controlled values differ from their initial snapshot. Escape, backdrop, and Cancel close immediately when pristine; otherwise show the existing confirmation pattern before closing. Keep `aria-labelledby`, `aria-modal`, and focus return through the trigger owned by `ProductForm`.

- [ ] **Step 6: Run focused tests**

```powershell
pnpm exec vitest run features/store-manager/category-inline-panel.test.tsx features/store-manager/category-inline-action-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 7: Review, fix, and commit**

Review create-mode regressions, prefilled values, two-level hierarchy, keyboard access, nested draft preservation, and duplicated form markup. Fix findings and rerun Step 6.

```powershell
git add -- client-side/features/store-manager/category-inline-panel.tsx client-side/features/store-manager/category-inline-panel.test.tsx client-side/app/globals.css
git commit -m "feat: edit categories in the inline drawer"
```

---

### Task 4: Reuse the product-option drawer for global editing and detachment

**Files:**
- Modify: `client-side/features/store-manager/product-option-inline-panel.tsx`
- Create: `client-side/features/store-manager/product-option-inline-panel.test.tsx`
- Modify: `client-side/app/globals.css`

**Interfaces:**
- Consumes: Task 2 option actions and catalog contracts
- Produces: create/edit option panel with global usage warning
- Produces: `onSaved(state)` and `onDetached(state)`

- [ ] **Step 1: Write failing component tests**

Cover:

```tsx
expect(markup).toContain("Edit product option");
expect(markup).toContain("Used by 3 categories");
expect(markup).toContain(
  "Changing the option name or value labels updates every category using it.",
);
expect(markup).toContain("Blue");
expect(markup).toContain("Black");
expect(markup).toContain("+ Add value");
expect(markup).toContain("Remove from this category");
```

Add a referenced-usage case:

```tsx
expect(markup).toMatch(
  /<button[^>]*disabled[^>]*>Remove from this category<\/button>/,
);
expect(markup).toContain("2 products use this option");
expect(markup).toContain("View products");
```

- [ ] **Step 2: Run the focused test and confirm failure**

```powershell
pnpm exec vitest run features/store-manager/product-option-inline-panel.test.tsx
```

Expected: FAIL because the panel supports create mode only.

- [ ] **Step 3: Add create/edit panel props**

Use:

```ts
type ProductOptionInlinePanelProps = Readonly<{
  intent: "create" | "edit";
  categoryId: string;
  attributeType?: CatalogAttributeType;
  attributeValues: readonly CatalogAttributeValue[];
  categoryAttribute?: CategoryAttributeConfiguration;
  categoryCount?: number;
  usage?: CategoryOptionUsage;
  attributeTypes: readonly CatalogAttributeType[];
  configuredAttributeTypeIds: readonly string[];
  usableAttributeTypeIds: readonly string[];
  onClose: () => void;
  onSaved: (state: InlineProductOptionState) => void;
  onDetached: (state: InlineProductOptionState) => void;
}>;
```

- [ ] **Step 4: Replace comma input with editable value rows**

Create controlled rows:

```ts
type OptionValueDraft = {
  key: string;
  id: string | null;
  value: string;
};
```

Render one labeled text input and Remove button per value, plus **+ Add value**. Submit:

```tsx
<input
  name="allowedValuesJson"
  type="hidden"
  value={JSON.stringify(
    values.map((item, sortOrder) => ({
      id: item.id,
      value: item.value.trim(),
      sort_order: sortOrder,
    })),
  )}
/>
```

Disable the final remaining value's Remove button so an option can never save with zero values. Let the RPC reject stale referenced-value removal and display the returned message in the panel.

- [ ] **Step 5: Separate global and category-owned fields**

Under **Reusable option**, show name and values plus the affected-category warning. Under **This category**, show required, variant-defining, and display-order controls. In product entry, preserve the existing defaults of required and variant-defining for newly created options.

- [ ] **Step 6: Add safe detachment**

Use a separate form bound to `detachProductOptionInline`. Disable **Remove from this category** when scoped usage is nonzero. Require confirmation before submitting. Show **View products** linking to:

```ts
`/store-manager/products?ids=${usage.product_ids.join(",")}`
```

Do not show archive, hide, or unavailable controls.

- [ ] **Step 7: Run focused tests**

```powershell
pnpm exec vitest run features/store-manager/product-option-inline-panel.test.tsx features/store-manager/product-option-action-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 8: Review, fix, and commit**

Review global-impact copy, local configuration ownership, value identity, zero-value prevention, stale detachment handling, confirmation, focus, and create-mode regression. Fix findings and rerun Step 7.

```powershell
git add -- client-side/features/store-manager/product-option-inline-panel.tsx client-side/features/store-manager/product-option-inline-panel.test.tsx client-side/app/globals.css
git commit -m "feat: edit and detach product options inline"
```

---

### Task 5: Integrate editing into the draft-preserving product form

**Files:**
- Modify: `client-side/app/store-manager/products/new/page.tsx`
- Modify: `client-side/features/store-manager/product-form.tsx`
- Modify: `client-side/features/store-manager/product-form.test.tsx`
- Modify: `client-side/tests/e2e/store-manager-product-first.spec.ts`
- Modify: `client-side/app/globals.css`

**Interfaces:**
- Consumes: editable drawers from Tasks 3 and 4
- Produces: selected-category edit controls and interactive option chips
- Produces: immutable local state replacement after save/detach

- [ ] **Step 1: Write failing product-form tests**

Assert the server-rendered form contains:

```ts
expect(markup).toContain("Edit selected parent category");
expect(markup).toContain("Edit selected subcategory");
expect(markup).toContain("Edit Colour");
```

Assert the option is rendered as a button, not a display-only `<li>` text node, and that only the selected category's effective attachments appear.

- [ ] **Step 2: Extend the Playwright scenario**

Add an authenticated store-operator scenario for:

1. type a product name and description;
2. open **Edit Colour**;
3. see the global category count;
4. rename a value and add a value;
5. save and confirm the product fields remain;
6. reopen the option and detach it when unused;
7. confirm the variant fields return to the no-options presentation.

Add a seeded/referenced case where detachment is disabled and **View products** remains available.

- [ ] **Step 3: Run focused tests and confirm failure**

```powershell
pnpm exec vitest run features/store-manager/product-form.test.tsx
pnpm exec playwright test tests/e2e/store-manager-product-first.spec.ts
```

Expected: component test FAILS for missing edit controls. Playwright may require the configured browser/auth environment; record environment unavailability separately from application failures.

- [ ] **Step 4: Load complete editor metadata**

Change the new-product page selects to:

```ts
.select("id,name,parent_id,description")
.select("id,attribute_type_id,value,sort_order")
.select(
  "category_id,attribute_type_id,is_required,is_variant_axis,sort_order,required_from",
)
```

Do not fetch service-role data or private tables.

- [ ] **Step 5: Replace booleans with explicit panel targets**

Use:

```ts
type CategoryPanelTarget =
  | { intent: "create"; mode: "parent" | "subcategory" }
  | {
      intent: "edit";
      mode: "parent" | "subcategory";
      categoryId: string;
    };

type OptionPanelTarget =
  | { intent: "create"; categoryId: string }
  | {
      intent: "edit";
      categoryId: string;
      attributeTypeId: string;
    };
```

This prevents create/edit state from leaking across drawer openings.

- [ ] **Step 6: Load authoritative option-editor state**

When an edit chip is selected, call
`loadProductOptionInlineEditor(configuration.category_id,
configuration.attribute_type_id)` in a transition. Open the edit drawer only
with the returned type, values, owning attachment, global category count, and
scoped usage. Show a retryable inline error if loading fails; do not clear or
submit the product form.

- [ ] **Step 7: Render category edit actions and interactive option chips**

Place a compact **Edit selected parent category** button beside the parent chooser and an **Edit selected subcategory** button beside the subcategory chooser only when selected. Render every option as:

```tsx
<button
  aria-label={`Edit ${type.name}`}
  className="product-option-chip"
  onClick={() =>
    setOptionPanelTarget({
      intent: "edit",
      categoryId: configuration.category_id,
      attributeTypeId: configuration.attribute_type_id,
    })
  }
  type="button"
>
  {type.name}
  <span aria-hidden="true">Edit</span>
</button>
```

Using `configuration.category_id` ensures inherited options edit the owning parent attachment.

- [ ] **Step 8: Replace local catalog records after mutations**

Create focused immutable helpers:

```ts
function replaceById<T extends { id: string }>(
  current: readonly T[],
  next: T,
) {
  return [...current.filter((item) => item.id !== next.id), next];
}

function replaceOptionValues(
  current: readonly CatalogAttributeValue[],
  attributeTypeId: string,
  next: readonly CatalogAttributeValue[],
) {
  return [
    ...current.filter(
      (value) => value.attribute_type_id !== attributeTypeId,
    ),
    ...next,
  ];
}
```

On category save, replace the category and preserve selected IDs. On option save, replace type, values, and attachment. On detach, remove only the matching `(category_id, attribute_type_id)` attachment. Never reset product name, brand, description, images, product specifications, or variant-row state.

- [ ] **Step 9: Run focused tests**

```powershell
pnpm exec vitest run features/store-manager/product-form.test.tsx features/store-manager/category-inline-panel.test.tsx features/store-manager/product-option-inline-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Review, fix, and commit**

Review inherited attachment ownership, product draft retention, state replacement versus duplication, category moves, accessible names, narrow layout, and no-options transitions after detachment. Fix findings and rerun Step 9.

```powershell
git add -- client-side/app/store-manager/products/new/page.tsx client-side/features/store-manager/product-form.tsx client-side/features/store-manager/product-form.test.tsx client-side/tests/e2e/store-manager-product-first.spec.ts client-side/app/globals.css
git commit -m "feat: wire inline catalog editing into products"
```

---

### Task 6: Complete regression verification and review-fix iteration

**Files:**
- Potential review-fix files:
  `client-side/app/globals.css`,
  `client-side/app/store-manager/products/new/page.tsx`,
  `client-side/features/catalog/actions.ts`,
  `client-side/features/catalog/contracts.ts`,
  `client-side/features/catalog/inline-catalog-actions.test.ts`,
  `client-side/features/store-manager/category-inline-action-boundary.test.ts`,
  `client-side/features/store-manager/category-inline-panel.test.tsx`,
  `client-side/features/store-manager/category-inline-panel.tsx`,
  `client-side/features/store-manager/product-form.test.tsx`,
  `client-side/features/store-manager/product-form.tsx`,
  `client-side/features/store-manager/product-option-action-boundary.test.ts`,
  `client-side/features/store-manager/product-option-inline-panel.test.tsx`,
  `client-side/features/store-manager/product-option-inline-panel.tsx`,
  `client-side/tests/e2e/store-manager-product-first.spec.ts`,
  `docs/supabase/main_schema.sql`,
  `docs/supabase/migrations/20260718113000_inline_catalog_editing.sql`,
  `docs/supabase/tests/reference_safe_catalog_options.test.sql`

**Interfaces:**
- Consumes: all prior tasks
- Produces: verified implementation matching the approved spec and UI acceptance contract

- [ ] **Step 1: Verify migration immutability**

```powershell
$baseline = git log -1 --format=%H --grep="feat: add inline product options from product entry"
git diff --exit-code $baseline -- docs/supabase/migrations/20260718090000_product_first_inventory.sql docs/supabase/migrations/20260718100200_inline_product_options.sql
```

Expected: no output for either previously created migration.

- [ ] **Step 2: Run schema verification**

```powershell
pnpm schema:check
```

Expected: PASS.

- [ ] **Step 3: Run the complete unit/component suite**

```powershell
pnpm test
```

Expected: all Vitest files and tests PASS.

- [ ] **Step 4: Run static verification**

```powershell
pnpm typecheck
pnpm lint
```

Expected: both PASS with zero errors.

- [ ] **Step 5: Run the production build**

```powershell
pnpm build
```

Expected: Next.js build exits successfully.

- [ ] **Step 6: Run browser acceptance when the configured environment is available**

```powershell
pnpm exec playwright test tests/e2e/store-manager-product-first.spec.ts
```

Expected: the inline create, edit, global warning, safe detachment, referenced-detachment denial, and draft-preservation scenarios PASS.

- [ ] **Step 7: Perform the final code and UX review**

Trace every `SM-UX-013A`, `SM-UX-013B`, `SM-UX-013C`, `SM-UX-014` through `SM-UX-017A` step from UI control to Server Action to RPC and back. Check:

- no display-only option chip remains;
- every inline create surface has a matching edit action;
- global changes show affected-category count;
- category-owned flags do not leak globally;
- referenced detachment is disabled in UI and rejected in PostgreSQL;
- unreferenced detachment keeps the global reusable option;
- product and variant draft state survives save, cancel, error, and concurrent refresh;
- no service-role secret reaches browser code;
- no Docker or unapproved Cloud mutation occurred.

- [ ] **Step 8: Fix every confirmed finding and rerun verification**

For each finding, add or tighten a focused regression test before applying the
fix. Rerun the focused test, then always rerun Steps 2 through 5. Rerun Step 6
when its configured browser environment is available and record the exact
reason otherwise. Do not claim completion with a known confirmed finding.

- [ ] **Step 9: Commit final review fixes**

```powershell
git add -- client-side/app/globals.css client-side/app/store-manager/products/new/page.tsx client-side/features/catalog/actions.ts client-side/features/catalog/contracts.ts client-side/features/catalog/inline-catalog-actions.test.ts client-side/features/store-manager/category-inline-action-boundary.test.ts client-side/features/store-manager/category-inline-panel.test.tsx client-side/features/store-manager/category-inline-panel.tsx client-side/features/store-manager/product-form.test.tsx client-side/features/store-manager/product-form.tsx client-side/features/store-manager/product-option-action-boundary.test.ts client-side/features/store-manager/product-option-inline-panel.test.tsx client-side/features/store-manager/product-option-inline-panel.tsx client-side/tests/e2e/store-manager-product-first.spec.ts docs/supabase/main_schema.sql docs/supabase/migrations/20260718113000_inline_catalog_editing.sql docs/supabase/tests/reference_safe_catalog_options.test.sql
git commit -m "fix: close inline catalog editing review findings"
```

Skip this commit only when Step 7 finds nothing and the worktree contains no review-fix changes.

---

## Completion Evidence

The implementation is complete only when the handoff reports:

- the exact new migration filename to apply;
- confirmation that both older migrations remained unchanged;
- schema-check, Vitest, typecheck, lint, build, and focused Playwright results;
- any pgTAP or browser gate not run and the precise environmental reason;
- confirmation that no Supabase Cloud mutation or Docker command was used;
- the final review findings and corresponding fixes;
- the remaining dirty-worktree files that were preserved because they were unrelated.
