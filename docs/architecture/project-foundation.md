# SJCET Store Shared Project Foundation

## 1. Scope

This document is the architecture authority for the shared platform used by:

- store manager;
- store students;
- print admin;
- print students; and
- super admin.

Module requirement documents define module behavior. This document defines the
shared contracts those modules must use.

## 2. Technology baseline

- Next.js `16.2.10`, App Router, React `19.2.7`, and TypeScript `5.9.3`
- Supabase Postgres, Auth, and Row Level Security
- `@supabase/supabase-js` `2.110.7` and `@supabase/ssr` `0.12.3`
- Dodo Payments SDK `2.42.2` and `@dodopayments/nextjs` `0.3.6`
- Vitest `4.1.10` for unit/integration tests
- Playwright `1.61.1` for browser acceptance tests
- An exact `pnpm-lock.yaml`

Versions are npm registry values checked on 2026-07-17 and are pinned to
currently compatible peer ranges. Dependency upgrades must be reviewed and
committed separately.

## 3. Repository shape

```text
client-side/
  app/
    auth/                 combined login, signup, and confirmation
    (protected)/          authenticated application shell and module routes
    api/webhooks/dodo/    Dodo webhook boundary
  components/shared/      cross-module UI primitives
  features/
    auth/                 auth actions, validation, role gates
    catalog/              categories, attributes, products, and variants
    inventory/            variant stock operations
    orders/               order creation and history
    payments/             provider-neutral payment, QR, and webhook contracts
    store-manager/        counter-sale composition
  lib/
    env/                  validated server/client environment
    money/                integer-paise helpers
    supabase/             browser, server, and privileged clients
    validation/           shared schemas
  tests/
    e2e/                  role and end-to-end flows
    fixtures/             test builders
docs/
  requirements/           product requirements by module
  architecture/           cross-module technical authority
  decisions/              architecture decision records
  supabase/
    config.toml           local Supabase configuration
    main_schema.sql       canonical empty-database setup
    migrations/           ordered schema migrations
    tests/                database tests
    seed.sql              deterministic local seed data
  plans/                  active delivery plans
  team/                   collaboration rules
```

`client-side/` is the web-application root. `docs/supabase/` is the complete
local Supabase project. Run package-manager and application test commands from
`client-side/`. Run Supabase CLI commands there with `--workdir ../docs` so the
CLI resolves `docs/supabase/config.toml`.

## 4. Authentication and signup policy

Supabase Auth is the identity provider. Next.js uses cookie-backed SSR through
`@supabase/ssr`; protected server paths validate the user with `getClaims()`.

Public signup accepts only email addresses whose domain has at least one valid
subdomain before `sjcetpalai.ac.in`.

Accepted examples:

- `student@cs.sjcetpalai.ac.in`
- `student@2026.cse.sjcetpalai.ac.in`

Rejected examples:

- `student@sjcetpalai.ac.in`
- `student@gmail.com`
- `student@fake-sjcetpalai.ac.in`
- `student@sjcetpalai.ac.in.example.com`

The canonical TypeScript predicate is:

```ts
const COLLEGE_EMAIL =
  /^[^@\s]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+sjcetpalai\.ac\.in$/i;
```

Enforcement is defense in depth:

1. the signup form gives immediate validation feedback;
2. the signup server action rejects an invalid address; and
3. a Supabase Before User Created Postgres hook rejects invalid signups,
   including direct Auth API calls.

Email confirmation is required. Anonymous signup is disabled.

## 5. Authorization model

Roles:

- `student`
- `store_manager`
- `print_admin`
- `super_admin`

Authorization data lives in a private profile/role table and trusted
`app_metadata`, never user-editable `user_metadata`.

| Capability | student | store_manager | print_admin | super_admin |
|---|---:|---:|---:|---:|
| Use student store | yes | no | no | yes |
| Use student printing | yes | no | no | yes |
| Manage store inventory/orders | no | yes | no | yes |
| Manage print jobs/config | no | no | yes | yes |
| Assign roles/shared settings | no | no | no | yes |

Every exposed table has RLS enabled. Policies express capability and ownership,
not merely `TO authenticated`. Service-role credentials are server-only and
used only at narrow, audited boundaries such as verified webhook processing.

Initial super administrators are configured with the server-only,
comma-separated `INITIAL_SUPER_ADMIN_EMAILS` environment value. When a listed,
email-confirmed account enters a protected route, the server uses
`SUPABASE_SECRET_KEY` to call one service-only authorization function. That
function idempotently assigns `super_admin` when configured, writes an audit
event, and returns the authoritative role array in the same transaction.
Neither environment value is exposed to the browser. Removing an address from
the list does not implicitly revoke a previously assigned role.

Role-aware destinations are authoritative after every login and confirmation:

- `super_admin` -> `/super-admin`;
- `store_manager` -> `/store-manager/products`; and
- every other authenticated role -> `/dashboard`.

Super admins manage store-manager access through the dedicated dashboard.
Existing Auth users receive the role immediately; unknown users receive a
tracked invitation and are assigned after confirmation. Privileged Auth calls
remain in server-only actions, while the database authorizes and audits every
role transition.

## 6. Shared data ownership

Shared tables:

- `profiles`: one application profile per Auth user;
- `user_roles`: trusted role assignments;
- `audit_events`: append-only actor/action/entity trail;
- `payment_attempts`: provider-neutral payment lifecycle, including idempotency
  key, provider-checkout expiry, and reconciliation code/message;
- `processed_webhooks`: idempotency ledger for provider events;
- `private.payment_handoffs`: authenticated QR handoff, storing only the
  SHA-256 token hash, the claiming user, expiry, claim, and revocation.

Store-owned tables:

- `product_categories`;
- `attribute_types`;
- `attribute_values`;
- `category_attributes`;
- `products`;
- `product_attribute_values`;
- `product_variants`;
- `variant_attribute_values`;
- `stock_movements`;
- `orders` (with idempotency key, request fingerprint, and bounded
  online-payment expiry);
- `order_lines`; and
- `stock_reservations`: bounded online-order reservations that reduce available
  stock without changing physical `current_stock`.

Catalog category, attribute, and value names are manager-owned data. The schema
must not hardcode names such as stationery, uniforms, size, or color. Catalog
categories have at most two levels, each product belongs to one category, and
stock and price belong to sellable variants. The catalog has no department or
audience visibility restrictions.

Print-owned tables will be defined by the print module without duplicating
identity, role, payment, webhook, or audit tables.

Cross-module reads use documented views or service functions. A module must not
write another module's tables directly.

### Store module boundaries

- `catalog` owns category configuration and product/variant definitions,
  including SKU, selling price, and lifecycle state.
- `inventory` owns stock status, append-only movements, and the transactional
  stock-adjustment contract. Application code never writes `current_stock`
  directly.
- `orders` consumes active catalog variants and asks inventory operations to
  validate, reserve, release, or deduct quantities. It does not edit catalog
  definitions.
- `payments` consumes a frozen order total, creates provider-neutral checkout
  attempts, owns the authenticated QR handoff, and reports verified payment
  state. It does not edit catalog or stock tables directly.
- `store-manager` composes these capabilities into manager screens without
  taking ownership of their data rules.

These boundaries keep each feature cohesive while coupling features only
through IDs, typed operations, and database functions.

## 7. Payment contract

The application owns orders and totals. Dodo Payments only collects money.

For dynamic store totals:

1. create and freeze order-line price snapshots;
2. calculate the total in a database transaction using integer paise;
3. reserve available stock for the bounded online-payment window without
   changing physical current stock;
4. create a hosted checkout through a provider-neutral server interface;
5. let the initial Dodo adapter pass one Pay-What-You-Want product-cart item
   with `quantity: 1` and `amount: order.total_paise`;
6. attach `order_id`, order number, and module metadata;
7. render an application-owned QR whose opaque handoff token resolves to a
   shared authenticated order-summary page;
8. resolve the provider checkout URL only at a validated server redirect;
9. verify the provider webhook signature on the raw request body;
10. insert the provider event ID into `processed_webhooks`;
11. compare provider checkout reference, order metadata, amount, and currency
    with the frozen attempt and order; and
12. atomically transition payment/order, consume reservations, and deduct
    stock once.

The return URL never confirms payment. It shows a waiting state and asks the
server for the current order status.

Provider-specific SDK types, request fields, webhook payloads, and signature
verification stay inside the provider adapter. Basket, order, QR, inventory,
history, and bill code consume provider-neutral contracts so a later provider
can be introduced without changing those features.

## 8. API and server-operation conventions

- Prefer Server Components for reads and Server Actions for authenticated form
  mutations.
- Use Route Handlers for external HTTP boundaries such as webhooks.
- Validate every input with a shared schema.
- Return typed result unions: `{ ok: true, data } | { ok: false, error }`.
- Use stable machine error codes and separate user-safe messages.
- Never accept actor ID, role, unit price, total, or payment amount from the
  browser as authoritative.
- Every retryable mutation has an idempotency key or conditional state update.
- Log identifiers and state transitions, never secrets or full payment payloads.
- Authentication return destinations are relative, allowlisted application
  paths. Payment handoffs may preserve only `/pay/` destinations.

## 9. Data and transaction rules

- UUID primary keys.
- `timestamptz` timestamps stored in UTC.
- Money stored as non-negative `bigint` paise with `INR` currency.
- Human order numbers are separate from primary keys.
- Historical line descriptions/prices are snapshots.
- Product, variant, and category removal is archival when referenced.
- Attribute types, attribute values, and category-attribute configuration
  cannot be removed while products or variants reference them. Unreferenced
  records may be deleted after confirmation; these records do not use an
  archive state.
- Stock changes occur through one database function that locks affected variant
  rows in a stable order and rejects negative stock.
- Online reservations reduce available stock but do not change
  `product_variants.current_stock`. Successful payment consumes reservations;
  cancellation, checkout failure, or expiration releases them.
- Webhook processing is idempotent through a unique provider event ID.
- All public-schema tables enable RLS in the migration that creates them.

### Canonical schema and migration history

`docs/supabase/main_schema.sql` is the database source of truth. It
declares the complete current schema in dependency order and must run against an
empty Supabase database.

Migrations remain the ordered deployment history. Every schema change updates
both the incremental migration and the canonical script in the same pull
request. The canonical script must not contain historical patches, obsolete
objects, data backfills, rollbacks, or seed data. Rebuild the declaration
instead of appending an update statement.

Run `pnpm schema:check` for every database change. When Docker is available,
also execute the complete script against a fresh local Supabase database and
run database tests and advisors.

## 10. Non-functional requirements

- Accessibility: keyboard operation, visible focus, labelled controls, and
  WCAG AA contrast.
- Performance: common authenticated page reads target p95 under 500 ms,
  excluding third-party checkout.
- Reliability: duplicate webhook and action submissions are safe.
- Security: no secret is exposed through `NEXT_PUBLIC_*`.
- Auditability: role, stock, payment, and order-state changes are attributable.
- Maintainability: features expose public contracts through a single
  `index.ts`; other modules do not deep-import internals.

## 11. Source-of-truth order

When documents conflict, use this priority:

1. accepted architecture decision records;
2. this shared foundation;
3. module requirement documents;
4. active implementation plan;
5. code comments.

Update the affected documents in the same change whenever a shared contract
changes.
