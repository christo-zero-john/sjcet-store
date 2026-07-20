# Authentication and Dynamic Catalog Manager Design

## Summary

This design defines the shared authentication entry point and the first store-manager catalog module. It uses Supabase Auth, role-based authorization, manager-defined catalog data, product families, and independently priced and stocked variants. It does not hardcode catalog names or restrict products by department or audience.

## Scope

The first delivery includes:

- one `/auth` page for login and signup;
- college-email validation, confirmation, session refresh, and protected routes;
- automatic assignment of the `student` role;
- super-admin role assignment;
- category and attribute configuration for store managers and super admins;
- product-family and variant management;
- variant-level stock adjustments and audit history;
- the shared order and payment foundation already defined in the store-manager requirements.

Social login, password reset, returns, refunds, discounts, category-specific custom widgets, bulk import, barcode generation, and department-based visibility are outside this delivery.

## Repository boundaries

The Next.js application remains under `client-side/`. The complete local Supabase project remains under `docs/supabase/`, including `config.toml`, `main_schema.sql`, migrations, database tests, and seed data.

`docs/supabase/main_schema.sql` is the canonical empty-database setup script. Each schema task updates its migration and this script in the same change. The canonical script contains the final declarations in dependency order, not migration history, patch statements, backfills, obsolete objects, or seed data.

## Authentication

The `/auth` route renders one form with login and signup modes. The active mode selects either Supabase `signInWithPassword` or `signUp`; it does not infer the operation from an authentication error.

Signup accepts only addresses whose domain contains one or more labels before `sjcetpalai.ac.in`. The form and server action use the shared TypeScript predicate, while a Supabase Before User Created hook enforces the same policy for direct Auth API calls. Signup requires email confirmation.

Every accepted signup receives the `student` role. A client cannot submit or change its role during signup. Only a `super_admin` may grant or revoke `store_manager`, `print_admin`, or `super_admin` through an audited server operation. Protected routes validate the current user and required capability on the server.

## Authorization

`store_manager` and `super_admin` may create, rename, move, reorder, and archive categories; configure attributes; manage products and variants; and adjust stock. A `student` and `print_admin` cannot perform these mutations.

Catalog visibility has no department, faculty, student, staff, or other audience filter. Items associated with a department are ordinary categories or products visible to every customer.

## Catalog model

### Categories

`product_categories` is an adjacency-list table with a nullable `parent_id`. A category is either a root or a direct child of a root. Database constraints and mutation functions reject self-parenting, cycles, and a third hierarchy level.

Managers control the category name, slug, description, parent, display order, and active state. Category names are data. The schema and application do not define catalog-name enums or fixed lists.

Each product belongs to exactly one active category. A category cannot be archived while an active child category or active product references it.

### Attribute definitions and values

`attribute_types` stores reusable manager-defined definitions. `attribute_values` stores the allowed values for one type. Names such as Size, Color, Material, and Brand are examples entered through the interface, not seeded schema concepts.

`category_attributes` links an attribute type to a category and stores:

- whether a value is required;
- whether the attribute distinguishes sellable variants;
- its display order; and
- whether the row is active.

A root category starts with its own configuration. A subcategory resolves its configuration by inheriting active parent rows, then applying its own rows. A subcategory row for the same attribute type overrides only `required`, `variant-defining`, display order, and active state for that subcategory. It does not modify the parent row. This gives inheritance and local overrides without a separate rule language.

The product editor requests the resolved category configuration and renders fields from it. The server resolves the same configuration and rejects values that do not satisfy it.

### Products and variants

`products` stores product-family data: category, name, description, active state, and audit fields. Product-level selections for configured non-variant attributes are stored in `product_attribute_values`.

`product_variants` stores each sellable SKU. Each row has a globally unique SKU, non-negative price in paise, stock quantity, low-stock threshold, active state, and audit fields. Every product has at least one active variant before it can be activated for sale.

`variant_attribute_values` links a variant to one allowed value for each variant-defining attribute. A variant must provide every required variant-defining value in the resolved category configuration. The complete selected combination must be unique within the product.

Changing a category configuration does not silently corrupt active products. A change that would make an active product or variant invalid is rejected until the affected products are archived or corrected in the same controlled operation.

## Store-manager interface

`/store-manager/categories` presents a two-level category tree and a selected-category editor. Managers can add a root or subcategory, move and reorder nodes, archive eligible nodes, create attribute types and values, and configure the selected category. The interface labels inherited settings and local overrides.

`/store-manager/products` lists product families with category, variant count, stock status, and active state. It supports search, category filtering, and archived-state filtering.

The product create/edit flow first selects one category, loads the resolved configuration, captures shared product fields and non-variant values, then manages variant rows. Each variant row contains SKU, price, stock threshold, opening stock, and dropdowns for variant-defining values. The first delivery uses explicit variant rows instead of an automatic combination generator.

## Stock and auditing

Stock belongs to a variant. Opening stock and later corrections are recorded as append-only `stock_movements`; application code does not update stock without the transactional stock function. Each movement records the variant, quantity before, signed delta, quantity after, reason, actor, and time.

Category hierarchy changes, attribute configuration changes, product changes, variant changes, stock movements, role assignments, order transitions, and payment transitions write append-only audit events.

## Validation and errors

Client validation improves feedback, but server and database rules are authoritative. Expected validation failures return stable codes and user-safe messages. The module must handle duplicate names or slugs within a parent, duplicate SKUs, invalid hierarchy moves, archived references, invalid attribute values, missing required values, duplicate variant combinations, negative prices, and negative stock.

Concurrent category, product, and stock mutations use database constraints, row locks, or conditional updates rather than relying on browser state.

## Testing

Unit tests cover college-email validation, resolved category configuration, form schemas, money validation, and variant-combination normalization.

Database tests cover signup hooks, role allow and deny cases, category depth and cycles, archival protection, inheritance and overrides, attribute ownership, product-category integrity, required values, unique variant combinations, unique SKUs, variant stock safety, RLS, and audit records.

Component tests cover auth-mode switching, category editing, inherited-setting labels, dynamic product fields, variant validation, stock indicators, and user-safe errors.

Browser tests cover signup and confirmation, manager route denial, category and attribute creation, product and variant creation, stock adjustment, cash checkout, exact-amount online checkout, webhook confirmation, order history, and bill printing.

## Acceptance criteria

The design is complete when:

1. one `/auth` page supports explicit login and signup modes;
2. invalid college domains are rejected at every public signup boundary;
3. new users receive only the `student` role;
4. only a super admin can change privileged roles;
5. managers define category, attribute, and value names through the interface;
6. category nesting cannot exceed a root and one subcategory;
7. a category configuration determines the product fields and server validation;
8. subcategories inherit parent configuration and may apply local overrides;
9. every product has exactly one category and one or more sellable variants;
10. each variant has independent SKU, price, and stock;
11. no department or audience rule affects catalog visibility;
12. relevant mutations are authorized, transactional, and audited; and
13. `docs/supabase/main_schema.sql` recreates the complete current database from an empty local Supabase instance.
