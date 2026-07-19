# Shared Foundation and Store Manager Implementation Plan

> **Supersession notice (2026-07-19):** Tasks 7 through 10 are replaced by
> `docs/superpowers/plans/2026-07-19-store-manager-order-basket.md`. Use the
> newer plan for counter orders, cash, provider-neutral online payments,
> application-owned QR handoff, history, and bills. Earlier completed
> foundation and inventory work remains authoritative where the plans do not
> conflict.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended when explicitly authorized) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure shared Next.js and Supabase foundation plus a store-manager MVP for dynamic catalog configuration, variant inventory, counter sales, cash payments, and exact-amount Dodo checkout.

**Architecture:** One Next.js application exposes shared feature contracts and route-owned modules. Supabase owns identity, authorization, catalog integrity, stock, orders, and payment state; Dodo Payments is isolated behind a provider adapter and verified webhook boundary. Managers define category and attribute data through the interface, while the database enforces the two-level hierarchy and variant rules.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 5.9.3, Supabase, Dodo Payments, Zod 4.3.6, Vitest 4.1.10, Playwright 1.61.1, and pnpm.

## Global constraints

- Read `AGENTS.md`, `docs/architecture/project-foundation.md`, `docs/requirements/store_manager.md`, `docs/team/development-guide.md`, applicable decisions, and this plan before every task.
- Keep the Next.js application under `client-side/`.
- Keep the complete Supabase project under `docs/supabase/`.
- Run application commands from `client-side/`. Run Supabase CLI commands from `client-side/` with `--workdir ../docs`.
- Update the task migration and `docs/supabase/main_schema.sql` together for every schema change.
- Keep `main_schema.sql` as one clean empty-database setup script without migration patches, obsolete objects, backfills, or seed data.
- Accept signup only for email domains with one or more labels before `sjcetpalai.ac.in`.
- New signups receive only the `student` role; only `super_admin` can assign privileged roles.
- Store all money as non-negative integer paise in INR.
- Never treat browser input as authoritative for price, total, role, actor, stock, or payment amount.
- Enable RLS for every exposed Supabase table in the change that creates it.
- Do not hardcode category, attribute-type, or attribute-value names.
- Limit category nesting to a root and one optional subcategory.
- Give every product exactly one category and one or more sellable variants.
- Apply no department or audience restrictions to catalog visibility.
- Treat Dodo redirects as navigation only; only a verified, amount-matched webhook confirms online payment.
- Do not make remote Supabase, Dodo, deployment, or production-data changes without explicit user authorization.

---

## File map

| Path | Responsibility |
|---|---|
| `client-side/app/auth/*` | combined login, signup, and confirmation route |
| `client-side/app/(protected)/*` | authenticated shell and module routes |
| `client-side/features/auth/*` | college-email policy, actions, and role gates |
| `client-side/features/catalog/*` | categories, attributes, products, and variants |
| `client-side/features/inventory/*` | variant stock operations |
| `client-side/features/orders/*` | order creation, snapshots, and history |
| `client-side/features/payments/*` | cash and provider-neutral online payments |
| `client-side/features/store-manager/*` | manager-page UI composition |
| `client-side/lib/supabase/*` | browser and server Supabase clients |
| `docs/supabase/main_schema.sql` | canonical empty-database setup |
| `docs/supabase/migrations/*` | ordered deployment history |
| `docs/supabase/tests/*` | pgTAP authorization and integrity tests |
| `client-side/tests/e2e/*` | browser acceptance tests |

### Task 1: Application and quality scaffold

**Files:**

- Modify: `client-side/package.json`
- Modify: `client-side/app/layout.tsx`
- Modify: `client-side/app/page.tsx`
- Modify: `client-side/app/globals.css`
- Modify: `client-side/.env.example`
- Test: `client-side/app/page.test.tsx`

**Interfaces:**

- Produces: standard package scripts for `dev`, `typecheck`, `lint`, `test`, `build`, `schema:check`, and `test:e2e`.

- [x] Write a smoke test that renders the public home page and asserts the SJCET Store heading.
- [x] Run `pnpm test` and verify failure before the shell exists.
- [x] Add the App Router shell, pinned dependencies, and exact scripts.
- [x] Run typecheck, lint, unit tests, and build with exit code 0.
- [ ] Review the existing scaffold diff and commit `chore: scaffold shared store application`.

### Task 2: Shared environment, money, and result contracts

**Files:**

- Create: `client-side/lib/env/server.ts`
- Create: `client-side/lib/env/client.ts`
- Create: `client-side/lib/money/paise.ts`
- Create: `client-side/lib/result.ts`
- Test: `client-side/lib/env/server.test.ts`
- Test: `client-side/lib/money/paise.test.ts`

**Interfaces:**

- Produces: `formatPaise(value: number): string`.
- Produces: `assertPaise(value: unknown): number`.
- Produces: `Result<T, E extends AppError>`.
- Produces: validated server-only Dodo and Supabase configuration.

- [ ] Write tests that reject fractional, negative, non-finite, and unsafe paise values and format `12345` as `₹123.45`.
- [ ] Write tests that reject missing server configuration without exposing secret values.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Implement the contracts and keep server configuration out of client modules.
- [ ] Run focused tests, typecheck, and lint with exit code 0.
- [ ] Commit `feat: add shared environment and money contracts`.

### Task 3: Combined Supabase authentication page

**Files:**

- Create: `client-side/lib/supabase/browser.ts`
- Create: `client-side/lib/supabase/server.ts`
- Create: `client-side/lib/supabase/proxy.ts`
- Create: `client-side/proxy.ts`
- Create: `client-side/features/auth/college-email.ts`
- Create: `client-side/features/auth/college-email.test.ts`
- Create: `client-side/features/auth/actions.ts`
- Create: `client-side/features/auth/auth-form.tsx`
- Create: `client-side/features/auth/auth-form.test.tsx`
- Create: `client-side/app/auth/page.tsx`
- Create: `client-side/app/auth/confirm/route.ts`

**Interfaces:**

- Produces: `isAllowedCollegeEmail(email: string): boolean`.
- Produces: `requireUser(): Promise<AuthUser>`.
- Produces: `signIn(formData: FormData)`, `signUp(formData: FormData)`, and `signOut()`.

- [ ] Test accepted multi-label college addresses and every rejected example in the shared foundation.
- [ ] Test explicit login/signup mode switching and invalid-signup feedback on one `/auth` page.
- [ ] Run the focused tests and confirm failure before implementation.
- [ ] Implement cookie-backed clients, proxy session refresh, confirmation handling, and `signInWithPassword` and `signUp` server actions.
- [ ] Add an integration test proving an invalid signup action returns before calling Supabase.
- [ ] Run auth tests, typecheck, lint, and build with exit code 0.
- [ ] Commit `feat: add combined college authentication`.

### Task 4: Identity, roles, and canonical Supabase project

**Files:**

- Create by running `npx supabase --workdir ../docs migration new shared_identity_roles`: the emitted `shared_identity_roles.sql` file in `docs/supabase/migrations/`.
- Create: `docs/supabase/tests/shared_identity_roles.test.sql`
- Create: `docs/supabase/seed.sql`
- Modify: `docs/supabase/config.toml`
- Rewrite: `docs/supabase/main_schema.sql`
- Modify: `client-side/scripts/validate-main-schema.mjs`

**Interfaces:**

- Produces: `private.profiles`, `private.user_roles`, and `public.audit_events`.
- Produces: `private.hook_restrict_college_signup(event jsonb)`.
- Produces: `private.has_role(required_role app_role)`.
- Produces: an audited super-admin-only role-assignment function.

- [ ] Start local Supabase and write pgTAP cases for valid and invalid signup-hook inputs, default student assignment, privileged-role denial, super-admin assignment, and RLS denial.
- [ ] Run `npx supabase --workdir ../docs test db` and confirm failure before the schema exists.
- [ ] Implement roles, profile creation, the Auth hook, grants, revokes, indexes, RLS, and role auditing in the migration.
- [ ] Rewrite `main_schema.sql` as the same complete identity schema without migration-history statements or seed data.
- [ ] Configure the local Auth hook and deterministic local role fixtures.
- [ ] Run `pnpm schema:check`, database tests, typecheck, and Supabase advisors.
- [ ] Commit `feat: add shared identity and role schema`.

### Task 5: Dynamic category and attribute configuration

**Files:**

- Create by running `npx supabase --workdir ../docs migration new dynamic_catalog_configuration`: the emitted `dynamic_catalog_configuration.sql` file in `docs/supabase/migrations/`.
- Create: `docs/supabase/tests/dynamic_catalog_configuration.test.sql`
- Modify: `docs/supabase/main_schema.sql`
- Create: `client-side/features/catalog/category-contracts.ts`
- Create: `client-side/features/catalog/category-service.ts`
- Create: `client-side/features/catalog/category-service.test.ts`
- Create: `client-side/features/store-manager/category-tree.tsx`
- Create: `client-side/features/store-manager/category-editor.tsx`
- Create: `client-side/features/store-manager/category-editor.test.tsx`
- Create: `client-side/app/(protected)/store-manager/categories/page.tsx`

**Interfaces:**

- Produces: `product_categories`, `attribute_types`, `attribute_values`, and `category_attributes`.
- Produces: `getResolvedCategoryAttributes(categoryId)` with inherited rows and local overrides.
- Produces: authorized create, rename, move, reorder, archive, value, and category-configuration operations.

- [ ] Write database tests for manager and super-admin access, student and print-admin denial, two-level depth, cycle rejection, sibling slug uniqueness, archive protection, attribute-value ownership, inheritance, local overrides, and audit events.
- [ ] Run the database test and confirm failure before the migration.
- [ ] Implement normalized tables, constraints, indexes, RLS, and controlled hierarchy mutations in the migration and canonical schema.
- [ ] Write unit tests for resolved configuration ordering and override behavior, then implement the typed catalog service.
- [ ] Write component tests for tree operations, inherited labels, attribute/value creation, validation errors, and archive protection.
- [ ] Implement the category configuration page without fixed catalog names.
- [ ] Run schema validation, database tests, focused unit and component tests, typecheck, lint, and build.
- [ ] Commit `feat: add dynamic catalog configuration`.

### Task 6: Product families, variants, and variant stock

**Files:**

- Create by running `npx supabase --workdir ../docs migration new product_variants_inventory`: the emitted `product_variants_inventory.sql` file in `docs/supabase/migrations/`.
- Create: `docs/supabase/tests/product_variants_inventory.test.sql`
- Modify: `docs/supabase/main_schema.sql`
- Create: `client-side/features/catalog/product-contracts.ts`
- Create: `client-side/features/catalog/product-service.ts`
- Create: `client-side/features/catalog/product-service.test.ts`
- Create: `client-side/features/inventory/stock-service.ts`
- Create: `client-side/features/inventory/stock-service.test.ts`
- Create: `client-side/features/store-manager/product-form.tsx`
- Create: `client-side/features/store-manager/product-form.test.tsx`
- Create: `client-side/app/(protected)/store-manager/products/page.tsx`
- Create: `client-side/app/(protected)/store-manager/products/new/page.tsx`
- Create: `client-side/app/(protected)/store-manager/products/[id]/page.tsx`

**Interfaces:**

- Produces: `products`, `product_attribute_values`, `product_variants`, `variant_attribute_values`, and append-only `stock_movements`.
- Produces: validated product-family create, edit, archive, list, and variant operations.
- Produces: `adjust_variant_stock(variant_id, delta, reason)` with row locking.

- [ ] Write database tests for one category per product, active-category enforcement, at least one active variant, global SKU uniqueness, non-negative price, required attribute values, value-type ownership, unique variant combinations, invalid configuration changes, archival, role denial, stock auditing, and negative-stock rejection.
- [ ] Run the database test and confirm failure before the migration.
- [ ] Implement normalized product and variant tables, constraints, indexes, RLS, transactional stock adjustment, audit writes, and canonical-schema declarations.
- [ ] Write unit tests that derive dynamic form fields and normalize variant combinations, then implement product and stock services.
- [ ] Write component tests for category-driven fields, explicit variant rows, validation errors, search, filtering, and stock indicators.
- [ ] Implement product list, create, and edit pages with independent variant SKU, price, threshold, and opening stock.
- [ ] Run schema validation, database tests, focused tests, typecheck, lint, and build.
- [ ] Commit `feat: add product variants and inventory`.

### Task 7: Transactional counter orders

**Files:**

- Create by running `npx supabase --workdir ../docs migration new store_orders`: the emitted `store_orders.sql` file in `docs/supabase/migrations/`.
- Create: `docs/supabase/tests/store_orders.test.sql`
- Modify: `docs/supabase/main_schema.sql`
- Create: `client-side/features/orders/contracts.ts`
- Create: `client-side/features/orders/actions.ts`
- Create: `client-side/features/store-manager/counter-sale.tsx`
- Create: `client-side/app/(protected)/store-manager/orders/new/page.tsx`

**Interfaces:**

- Produces: `orders` and immutable `order_lines` with product, variant, SKU, and price snapshots.
- Produces: `create_counter_order(items, payment_method)` returning the order ID, order number, and frozen total.

- [ ] Write database tests for empty baskets, duplicate variants, stale prices, insufficient variant stock, line snapshots, totals, and role denial.
- [ ] Run the database test and confirm failure before the migration.
- [ ] Implement server-authoritative order creation in the migration and canonical schema.
- [ ] Write component tests for variant search, quantity changes, collection ticks, empty baskets, and payment selection.
- [ ] Implement the basket interface and typed order action.
- [ ] Run schema validation, database tests, focused tests, typecheck, lint, and build.
- [ ] Commit `feat: add transactional counter orders`.

### Task 8: Cash payment completion

**Files:**

- Create by running `npx supabase --workdir ../docs migration new cash_payments`: the emitted `cash_payments.sql` file in `docs/supabase/migrations/`.
- Create: `docs/supabase/tests/cash_payments.test.sql`
- Modify: `docs/supabase/main_schema.sql`
- Create: `client-side/features/payments/cash.ts`
- Create: `client-side/features/payments/cash.test.ts`
- Create: `client-side/features/store-manager/cash-payment-form.tsx`

**Interfaces:**

- Produces: `complete_cash_payment(order_id, cash_received_paise)`.
- Produces: `calculateChange(total, received): number`.

- [ ] Test exact cash, excess cash, insufficient cash, duplicate confirmation, variant-stock deduction once, and unauthorized callers.
- [ ] Run focused tests and confirm failure.
- [ ] Implement the idempotent transaction in the migration and canonical schema.
- [ ] Implement the accessible cash confirmation interface.
- [ ] Run schema validation, database tests, unit tests, typecheck, lint, and build.
- [ ] Commit `feat: add cash checkout completion`.

### Task 9: Dodo exact-amount checkout and webhooks

**Files:**

- Create by running `npx supabase --workdir ../docs migration new online_payments`: the emitted `online_payments.sql` file in `docs/supabase/migrations/`.
- Create: `docs/supabase/tests/online_payments.test.sql`
- Modify: `docs/supabase/main_schema.sql`
- Create: `client-side/features/payments/provider.ts`
- Create: `client-side/features/payments/dodo.ts`
- Create: `client-side/features/payments/dodo.test.ts`
- Create: `client-side/app/api/webhooks/dodo/route.ts`
- Create: `client-side/app/(protected)/store-manager/orders/[id]/payment/page.tsx`

**Interfaces:**

- Produces: `PaymentProvider.createCheckout(order): Promise<CheckoutSession>`.
- Produces: `createOnlineCheckout(orderId): Promise<Result<CheckoutSession, AppError>>`.
- Produces: idempotent `confirm_online_payment(...)`.

- [ ] Test that the Dodo request uses one item, quantity one, exact frozen total in paise, INR, internal order metadata, and a server-only key.
- [ ] Test invalid signatures, duplicate events, amount or currency mismatch, success, failure, and variant-stock deduction once.
- [ ] Run focused tests and confirm the expected failures.
- [ ] Implement Checkout Sessions with the configured dynamic-price product and verified raw-body webhooks.
- [ ] Add payment tables and functions to the migration and canonical schema.
- [ ] Run mocked provider tests, schema validation, database tests, typecheck, lint, and build.
- [ ] Commit `feat: add exact amount online checkout`.

### Task 10: Order history, bills, and acceptance coverage

**Files:**

- Create: `client-side/app/(protected)/store-manager/orders/page.tsx`
- Create: `client-side/app/(protected)/store-manager/orders/[id]/page.tsx`
- Create: `client-side/features/orders/bill.tsx`
- Create: `client-side/tests/e2e/auth.spec.ts`
- Create: `client-side/tests/e2e/catalog-manager.spec.ts`
- Create: `client-side/tests/e2e/store-manager-checkout.spec.ts`
- Create: `docs/runbooks/dodo-payments.md`

**Interfaces:**

- Produces: paginated order history, order detail, a print-safe bill, browser acceptance coverage, and operational payment setup instructions.

- [ ] Add browser cases for combined auth, role denial, dynamic category and attribute creation, inherited configuration, product variants, stock adjustment, cash checkout, online pending state, simulated valid webhook, history, and bill printing.
- [ ] Run the browser suite and confirm failure before the pages and flows are complete.
- [ ] Implement filters, order details, activity trail, and print styles.
- [ ] Document the Dodo test product, API key, webhook secret, webhook URL, event subscription, and test-to-live checklist without committing values.
- [ ] Run `pnpm schema:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `npx supabase --workdir ../docs test db`, Supabase advisors, and `pnpm test:e2e`.
- [ ] Commit `feat: complete store manager catalog and counter sales`.

## Plan self-review

- Authentication uses one `/auth` page with explicit login and signup operations.
- Catalog names and configuration are manager-owned data, not fixed enums.
- Categories stop at two levels and products have one category.
- Subcategory inheritance and local override behavior are explicit.
- SKU, price, and stock belong to product variants.
- Department and audience restrictions are absent.
- Every database task updates both its migration and the canonical schema.
- Every Supabase path is under `docs/supabase/`.
- Cash and online payments have separate transactional tests.
- Online payment cannot be confirmed from a redirect or client-submitted total.
- Each implementation task has an independent test and review boundary.
