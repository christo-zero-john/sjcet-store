# Store Manager Order Basket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `subagent-driven-development` (recommended when explicitly authorized) or
> `executing-plans` to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Deliver the store-manager counter-sale basket, cash completion,
provider-neutral online checkout, authenticated QR handoff, order/payment
history, and paid bill without modifying the student module.

**Architecture:** Store-manager UI composes public `orders`, `payments`, and
`inventory` contracts. Postgres owns frozen totals, reservations,
authorization, idempotency, payment transitions, and one-time stock deduction;
Next.js owns server composition and read-only UI. Dodo is the first
`PaymentProvider` adapter and is isolated from basket, order, inventory, QR,
history, and bill code.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 5.9.3, Supabase
Postgres/Auth/RLS, `@supabase/supabase-js` 2.110.7, Dodo Payments SDK 2.42.2,
`@dodopayments/nextjs` 0.3.6, Zod 4.3.6, `qrcode` 1.5.4, Vitest 4.1.10,
Playwright 1.61.1, and pnpm.

## Global Constraints

- Read `AGENTS.md`, `docs/architecture/project-foundation.md`,
  `docs/requirements/store_manager.md`,
  `docs/team/development-guide.md`,
  `docs/testing/store-manager-order-basket-ui-acceptance.md`,
  `docs/superpowers/specs/2026-07-19-store-manager-order-basket-design.md`,
  `docs/supabase/main_schema.sql`, and this plan before the first task.
- Keep the complete application under `client-side/` and the complete local
  Supabase project under `docs/supabase/`.
- Run application commands from `client-side/`. Run Supabase commands from
  `client-side/` with `--workdir ../docs`.
- Use test-first red, green, refactor, and fresh verification for every
  behavior change.
- Preserve unrelated and uncommitted work. Inspect `git status --short` before
  every task and stage only task-owned paths.
- Do not modify `client-side/features/student/**`,
  `client-side/app/dashboard/**`, or
  `docs/requirements/store_students.md`.
- Do not implement guest authentication or student-store behavior.
- Shared-auth changes are limited to a validated `/pay/` return destination.
- Store all money as non-negative safe integer paise in TypeScript and
  non-negative `bigint` paise in Postgres. Never use floating point for
  business calculations.
- The server and database ignore browser-supplied names, prices, totals, stock,
  actors, roles, provider URLs, and payable amounts.
- Preserve existing inventory functions. Order transactions may consume stock
  only through private inventory transaction logic and append-only movements.
- A reservation changes available stock, not physical
  `product_variants.current_stock`.
- Only a verified, amount-matched, currency-matched, checkout-matched,
  metadata-matched webhook may confirm online payment.
- Keep provider SDK types inside `features/payments/providers/*`.
- Keep secrets out of browser bundles, URLs, logs, documentation values, and
  committed files.
- Every schema change updates both the append-only migration and
  `docs/supabase/main_schema.sql` in the same task.
- Keep `main_schema.sql` as a clean empty-database declaration. Do not append
  migration-history patches or seed data.
- Do not rename or delete an existing migration.
- The new migration path is
  `docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql`.
- Do not make remote Supabase, Dodo, deployment, or production-data changes
  without explicit user authorization.
- Record unavailable Docker, Supabase, provider, or browser gates as
  unverified. A skipped gate is not a pass.

---

## Requirement Authorities

| Authority | Required coverage |
|---|---|
| `docs/requirements/store_manager.md` sections 3, 5–9 | basket, orders, cash, online payment, state, and business rules |
| `docs/testing/store-manager-order-basket-ui-acceptance.md` | every `SM-ORDER-001` through `SM-ORDER-026` scenario |
| `docs/architecture/project-foundation.md` sections 6–10 | feature ownership, provider boundary, RLS, money, idempotency, and stock |
| `docs/runbooks/payments.md` | environment, webhook, reconciliation, provider swap, and live-readiness operations |

## Shared Contracts Touched

- Shared auth: safe post-login return path for an existing authenticated QR
  claimant.
- Catalog read contract: active product/variant name, SKU, barcode, variant
  description, and authoritative price.
- Inventory contract: available-stock calculation, bounded reservation,
  release, consumption, and sale movement.
- Orders contract: basket validation, frozen snapshots, state, history, and
  bill.
- Payments contract: attempts, provider adapter, QR handoff, webhook
  normalization, reconciliation, and payment history.
- Audit contract: append-only order, payment, reservation, and stock events.

## Locked File Structure

| Path | Responsibility |
|---|---|
| `client-side/features/orders/contracts.ts` | provider-independent order and basket types/results |
| `client-side/features/orders/basket.ts` | pure basket reducer and estimated totals |
| `client-side/features/orders/basket.test.ts` | merge, quantity, collection, and total tests |
| `client-side/features/orders/fingerprint.ts` | canonical server-side request fingerprint |
| `client-side/features/orders/fingerprint.test.ts` | ordering and conflict fingerprint tests |
| `client-side/features/orders/queries.ts` | server-only variant, order, detail, and bill reads |
| `client-side/features/orders/actions.ts` | authorized cash/online/cancel/retry actions |
| `client-side/features/orders/bill.tsx` | print-safe frozen bill |
| `client-side/features/orders/bill.test.tsx` | bill-state and snapshot rendering tests |
| `client-side/features/orders/index.ts` | public order exports only |
| `client-side/features/payments/contracts.ts` | checkout and normalized-event contracts |
| `client-side/features/payments/environment.ts` | server-only provider configuration |
| `client-side/features/payments/provider.ts` | server-only provider registry |
| `client-side/features/payments/provider-contract.test.ts` | reusable fake-provider contract suite |
| `client-side/features/payments/providers/dodo.ts` | only Dodo SDK adapter |
| `client-side/features/payments/providers/dodo.test.ts` | exact Dodo request and webhook mapping |
| `client-side/features/payments/handoff.ts` | token generation/hash and safe handoff reads |
| `client-side/features/payments/handoff.test.ts` | token and disclosure tests |
| `client-side/features/payments/actions.ts` | claim/status/redirect orchestration |
| `client-side/features/payments/index.ts` | public payment exports only |
| `client-side/features/auth/return-path.ts` | strict `/pay/` return allowlist |
| `client-side/features/auth/return-path.test.ts` | open-redirect denial tests |
| `client-side/features/store-manager/counter-sale.tsx` | complete interactive manager basket |
| `client-side/features/store-manager/counter-sale.test.tsx` | visible flow and accessibility tests |
| `client-side/features/store-manager/order-history.tsx` | paginated order list |
| `client-side/features/store-manager/order-detail.tsx` | frozen detail/activity UI |
| `client-side/features/store-manager/payment-history.tsx` | payment reconciliation list |
| `client-side/features/store-manager/online-order-result.tsx` | QR/status/cancel/retry result |
| `client-side/app/store-manager/orders/new/page.tsx` | counter-sale route composition |
| `client-side/app/store-manager/orders/page.tsx` | order-history route |
| `client-side/app/store-manager/orders/[id]/page.tsx` | manager order detail |
| `client-side/app/store-manager/orders/[id]/bill/page.tsx` | paid bill route |
| `client-side/app/store-manager/payments/page.tsx` | payment-history route |
| `client-side/app/pay/[token]/page.tsx` | authenticated read-only handoff |
| `client-side/app/pay/[token]/checkout/route.ts` | validated provider redirect |
| `client-side/app/pay/return/[attemptId]/page.tsx` | non-authoritative provider return status |
| `client-side/app/api/webhooks/dodo/route.ts` | raw-body verified Dodo boundary |
| `client-side/tests/e2e/store-manager-checkout.spec.ts` | browser cash/online/history/bill acceptance |
| `client-side/features/store-manager/order-module-boundary.test.ts` | no student imports/changes contract |
| `docs/supabase/tests/store_orders_payments.test.sql` | pgTAP transaction and authorization tests |
| `docs/supabase/main_schema.sql` | canonical clean schema |
| `docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql` | append-only order/payment change |

## Locked TypeScript Interfaces

Use these names and shapes across tasks. Do not invent aliases in later tasks.

```ts
export type PaymentMethod = "cash" | "online";
export type OrderState =
  | "draft"
  | "awaiting_payment"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "voided";
export type PaymentState =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

export type BasketLine = Readonly<{
  variantId: string;
  productName: string;
  sku: string;
  variantDescription: string;
  unitPricePaise: number;
  availableStock: number;
  quantity: number;
  collected: boolean;
}>;

export type CounterOrderItemInput = Readonly<{
  variantId: string;
  quantity: number;
  observedPricePaise: number;
}>;

export type FrozenOrderLine = Readonly<{
  id: string;
  variantId: string;
  productName: string;
  sku: string;
  variantDescription: string;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
}>;

export type FrozenOrder = Readonly<{
  id: string;
  orderNumber: number;
  status: OrderState;
  paymentMethod: PaymentMethod;
  currency: "INR";
  subtotalPaise: number;
  totalPaise: number;
  expiresAt: string | null;
  lines: readonly FrozenOrderLine[];
}>;

export type SellableVariant = Readonly<{
  variantId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  variantDescription: string;
  unitPricePaise: number;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
}>;

export type OnlineOrderResult = Readonly<{
  order: FrozenOrder;
  paymentAttemptId: string;
  handoffUrl: string;
  qrDataUrl: string;
  expiresAt: string;
}>;

export type CashReceipt = Readonly<{
  order: FrozenOrder;
  cashReceivedPaise: number;
  changeDuePaise: number;
}>;

export type CreateOnlineCounterOrderInput = Readonly<{
  items: readonly CounterOrderItemInput[];
  operationId: string;
}>;

export type CompleteCashCounterSaleInput = Readonly<{
  items: readonly CounterOrderItemInput[];
  cashReceivedPaise: number;
  operationId: string;
}>;

export type OrderErrorCode =
  | "EMPTY_BASKET"
  | "INVALID_QUANTITY"
  | "VARIANT_UNAVAILABLE"
  | "PRICE_CHANGED"
  | "INSUFFICIENT_STOCK"
  | "IDEMPOTENCY_CONFLICT"
  | "ORDER_NOT_PAYABLE"
  | "HANDOFF_INVALID"
  | "HANDOFF_CLAIMED"
  | "HANDOFF_EXPIRED"
  | "CHECKOUT_CREATE_FAILED"
  | "PROVIDER_EVENT_INVALID"
  | "PAYMENT_MISMATCH"
  | "UNAUTHORIZED"
  | "UNEXPECTED";

export type OrderResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: OrderErrorCode; message: string };
```

The payment interfaces are:

```ts
export type CreateCheckoutInput = Readonly<{
  idempotencyKey: string;
  orderId: string;
  orderNumber: number;
  amountPaise: number;
  currency: "INR";
  returnUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata: Readonly<Record<string, string>>;
}>;

export type CreatedCheckout = Readonly<{
  provider: string;
  checkoutId: string;
  checkoutUrl: string;
}>;

export type NormalizedPaymentEvent = Readonly<{
  provider: string;
  eventId: string;
  type: "processing" | "succeeded" | "failed" | "cancelled";
  checkoutId: string;
  paymentId?: string;
  amountPaise: number;
  currency: string;
  orderId?: string;
  payloadSha256: string;
  occurredAt: string;
}>;

export interface PaymentProvider {
  readonly id: string;
  createCheckout(input: CreateCheckoutInput): Promise<CreatedCheckout>;
  verifyAndNormalizeWebhook(
    rawBody: string,
    headers: Readonly<Record<string, string>>,
  ): Promise<NormalizedPaymentEvent>;
}

export class ProviderCheckoutError extends Error {
  constructor(
    readonly outcome: "rejected" | "uncertain",
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
```

---

### Task 1: Add safe auth return and payment environment foundations

**Files:**

- Create: `client-side/features/auth/return-path.ts`
- Create: `client-side/features/auth/return-path.test.ts`
- Modify: `client-side/features/auth/actions.ts`
- Modify: `client-side/features/auth/auth-form.tsx`
- Modify: `client-side/app/auth/page.tsx`
- Create: `client-side/features/payments/environment.ts`
- Create: `client-side/features/payments/environment.test.ts`
- Modify: `client-side/.env.example`
- Modify: `client-side/package.json`
- Modify: `client-side/pnpm-lock.yaml`
- Modify: `client-side/playwright.config.ts`

**Interfaces:**

- Produces:
  `safeAuthReturnPath(value: string | null | undefined): string | null`.
- Produces: `getPaymentEnvironment(): PaymentEnvironment`.
- Produces pinned `qrcode@1.5.4` and `@types/qrcode@1.5.6`.
- Preserves every existing role-based destination when no safe return exists.

- [ ] **Step 1: Write failing safe-return tests**

```ts
import { describe, expect, it } from "vitest";
import { safeAuthReturnPath } from "./return-path";

describe("safeAuthReturnPath", () => {
  it("accepts only local payment paths", () => {
    expect(safeAuthReturnPath("/pay/abc_123")).toBe("/pay/abc_123");
    expect(safeAuthReturnPath("/pay/abc?returned=1")).toBe(
      "/pay/abc?returned=1",
    );
  });

  it.each([
    "https://evil.example/pay/x",
    "//evil.example/pay/x",
    "/dashboard",
    "/store-manager/orders",
    "/pay\\evil",
    "javascript:alert(1)",
  ])("rejects %s", (value) => {
    expect(safeAuthReturnPath(value)).toBeNull();
  });
});
```

- [ ] **Step 2: Write failing environment tests**

Test that missing `DODO_PAYMENTS_API_KEY`, `DODO_WEBHOOK_SECRET`,
`DODO_DYNAMIC_PRODUCT_ID`, `NEXT_PUBLIC_SITE_URL`, or an unknown
`PAYMENT_PROVIDER` throws a stable configuration error without echoing secret
values. Test that `PAYMENT_HANDOFF_TTL_MINUTES=30` produces `30` and values
outside `5..120` are rejected.

- [ ] **Step 3: Verify red**

Run:

```powershell
pnpm vitest run features/auth/return-path.test.ts features/payments/environment.test.ts
```

Expected: FAIL because both modules are absent.

- [ ] **Step 4: Implement the allowlist**

Implement exactly one accepted prefix and reject protocol-relative paths,
backslashes, control characters, and cross-origin URLs:

```ts
export function safeAuthReturnPath(
  value: string | null | undefined,
): string | null {
  if (!value || !value.startsWith("/pay/") || value.startsWith("//")) {
    return null;
  }
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/u.test(value)) {
    return null;
  }
  const parsed = new URL(value, "http://local.invalid");
  return parsed.origin === "http://local.invalid" &&
    parsed.pathname.startsWith("/pay/")
    ? `${parsed.pathname}${parsed.search}`
    : null;
}
```

Add `next` as a hidden `AuthForm` value. `signIn` reads and validates it, then
uses it before `destinationForRoles(roles)`. Every auth error preserves only a
validated next value. Signup behavior and confirmation routing remain
unchanged.

- [ ] **Step 5: Implement server-only environment parsing**

Use a frozen `PaymentEnvironment` with:

```ts
type PaymentEnvironment = Readonly<{
  provider: "dodo";
  siteUrl: string;
  handoffTtlMinutes: number;
  dodo: {
    apiKey: string;
    webhookSecret: string;
    environment: "test_mode" | "live_mode";
    dynamicProductId: string;
  };
}>;
```

Do not export raw environment values to client components.

- [ ] **Step 6: Pin the QR dependency**

Run separately from `client-side/`:

```powershell
pnpm add qrcode@1.5.4
pnpm add -D @types/qrcode@1.5.6
```

Change Playwright `webServer.command` from `yarn dev` to `pnpm dev`.

- [ ] **Step 7: Verify green**

Run:

```powershell
pnpm vitest run features/auth/return-path.test.ts features/payments/environment.test.ts features/auth/auth-form.test.tsx features/auth/role-routing.test.ts
pnpm typecheck
pnpm lint
```

Expected: all focused tests pass; typecheck and lint exit `0`.

- [ ] **Step 8: Commit**

```powershell
git add client-side/features/auth/return-path.ts client-side/features/auth/return-path.test.ts client-side/features/auth/actions.ts client-side/features/auth/auth-form.tsx client-side/app/auth/page.tsx client-side/features/payments/environment.ts client-side/features/payments/environment.test.ts client-side/.env.example client-side/package.json client-side/pnpm-lock.yaml client-side/playwright.config.ts
git commit -m "feat: add payment handoff foundations"
```

---

### Task 2: Define pure basket, order, and provider contracts

**Files:**

- Create: `client-side/features/orders/contracts.ts`
- Create: `client-side/features/orders/basket.ts`
- Create: `client-side/features/orders/basket.test.ts`
- Create: `client-side/features/orders/fingerprint.ts`
- Create: `client-side/features/orders/fingerprint.test.ts`
- Create: `client-side/features/orders/index.ts`
- Create: `client-side/features/payments/contracts.ts`
- Create: `client-side/features/payments/provider-contract.test.ts`
- Create: `client-side/features/payments/index.ts`

**Interfaces:**

- Produces every locked type in this plan.
- Produces:
  `addBasketLine`, `setBasketQuantity`, `toggleCollected`,
  `removeBasketLine`, `basketTotalPaise`, `collectedProgress`, and
  `toCounterOrderItems`.
- Produces:
  `fingerprintCounterOrder(method, items, cashReceivedPaise?): string`.
- Produces a fake-provider conformance suite used again by Dodo.

- [ ] **Step 1: Write the failing basket tests**

Cover:

```ts
expect(addBasketLine([], bluePen).at(0)?.quantity).toBe(1);
expect(addBasketLine([bluePen], bluePen)).toHaveLength(1);
expect(addBasketLine([bluePen], bluePen).at(0)?.quantity).toBe(2);
expect(setBasketQuantity([{ ...bluePen, collected: true }], bluePen.variantId, 2)
  .at(0)?.collected).toBe(false);
expect(() =>
  setBasketQuantity([bluePen], bluePen.variantId, bluePen.availableStock + 1),
).toThrow("Only");
expect(basketTotalPaise([{ ...bluePen, quantity: 3 }])).toBe(
  bluePen.unitPricePaise * 3,
);
expect(toCounterOrderItems([bluePen])).toEqual([
  {
    variantId: bluePen.variantId,
    quantity: 1,
    observedPricePaise: bluePen.unitPricePaise,
  },
]);
```

Also test zero removes a line, negative/fractional quantities reject, safe
integer overflow rejects, and collection progress returns `{ collected, total
}`.

- [ ] **Step 2: Write failing fingerprint tests**

Prove the fingerprint is a lowercase SHA-256 value, ignores input item order by
sorting on variant ID, changes when method, variant, quantity, observed price,
or cash received changes, and never contains the raw JSON payload.

- [ ] **Step 3: Write the failing provider contract fixture**

Create a fake `PaymentProvider` whose `createCheckout` records one neutral
input and whose verifier returns one normalized event. Assert the test imports
no Dodo types and can drive orchestration using only `PaymentProvider`.

- [ ] **Step 4: Verify red**

Run:

```powershell
pnpm vitest run features/orders/basket.test.ts features/orders/fingerprint.test.ts features/payments/provider-contract.test.ts
```

Expected: FAIL with missing modules.

- [ ] **Step 5: Implement the minimal pure reducer**

Use immutable arrays, `assertPaise`, safe-integer multiplication, and error
messages that name the variant and available quantity. Do not use React state,
Supabase, or provider code in `basket.ts`.

Implement `fingerprintCounterOrder` in a server-only module. Canonicalize
validated items as sorted tuples and hash:

```ts
JSON.stringify({
  method,
  items: [...items]
    .sort((left, right) => left.variantId.localeCompare(right.variantId))
    .map(({ variantId, quantity, observedPricePaise }) => [
      variantId,
      quantity,
      observedPricePaise,
    ]),
  cashReceivedPaise: cashReceivedPaise ?? null,
});
```

- [ ] **Step 6: Implement public exports**

`orders/index.ts` exports only contracts and pure helpers.
`payments/index.ts` exports only contracts. Do not export provider
configuration, provider registry, or Dodo.

- [ ] **Step 7: Verify green**

Run:

```powershell
pnpm vitest run features/orders/basket.test.ts features/orders/fingerprint.test.ts features/payments/provider-contract.test.ts
pnpm typecheck
pnpm lint
```

Expected: focused tests pass and static gates exit `0`.

- [ ] **Step 8: Commit**

```powershell
git add client-side/features/orders client-side/features/payments/contracts.ts client-side/features/payments/provider-contract.test.ts client-side/features/payments/index.ts
git commit -m "feat: define order and payment contracts"
```

---

### Task 3: Add reservation, handoff, and idempotency schema

**Files:**

- Create:
  `docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql`
- Modify: `docs/supabase/main_schema.sql`
- Create: `docs/supabase/tests/store_orders_payments.test.sql`
- Modify: `client-side/scripts/validate-main-schema.mjs`

**Interfaces:**

- Produces `public.stock_reservation_status` with `active`, `released`, and
  `consumed`.
- Extends `orders` with `idempotency_key`, `request_fingerprint`, and
  `expires_at`.
- Extends `payment_attempts` with `idempotency_key`,
  `request_fingerprint`, `provider_checkout_expires_at`,
  `reconciliation_code`, and `reconciliation_message`.
- Produces `public.stock_reservations`.
- Produces `private.payment_handoffs`.
- Produces supporting constraints, indexes, RLS, revokes, and grants.

- [ ] **Step 1: Create the migration through the CLI workflow**

First discover the available command:

```powershell
npx supabase --workdir ../docs migration new --help
```

Then create:

```powershell
npx supabase --workdir ../docs migration new order_basket_payments
```

Rename only the newly generated file to the required repository path:

```text
docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql
```

Do not rename any existing migration.

- [ ] **Step 2: Add structural assertions and verify red**

Extend `validate-main-schema.mjs` to require:

```js
["stock reservation status", /\bcreate type public\.stock_reservation_status\b/i],
["stock reservations", /\bcreate table public\.stock_reservations\b/i],
["payment handoffs", /\bcreate table private\.payment_handoffs\b/i],
["online order function", /\bcreate function public\.create_online_counter_order\b/i],
["cash order function", /\bcreate function public\.complete_cash_counter_sale\b/i],
["payment event function", /\bcreate function public\.process_online_payment_event\b/i],
```

Run `pnpm schema:check`.

Expected: FAIL because the schema declarations are absent.

- [ ] **Step 3: Write failing pgTAP table tests**

Start `store_orders_payments.test.sql` with transaction rollback and assertions
for tables, columns, constraints, indexes, RLS, and denied direct mutation.
Include:

```sql
select has_table('public', 'stock_reservations');
select has_table('private', 'payment_handoffs');
select col_is_pk('public', 'stock_reservations', array['order_id', 'variant_id']);
select col_is_unique('private', 'payment_handoffs', 'order_id');
select throws_ok(
  $$insert into public.stock_reservations
      (order_id, variant_id, quantity, status, expires_at)
    values (
      gen_random_uuid(), gen_random_uuid(), 0, 'active', now() + interval '30 minutes'
    )$$,
  '23514'
);
```

Test that `anon` and ordinary authenticated users cannot select or mutate
handoffs/reservations and that store operators can read operational rows but
cannot bypass transaction functions with broad direct writes.

- [ ] **Step 4: Implement declarations in migration order**

Add, in dependency order:

1. `stock_reservation_status`;
2. `orders` columns and unique
   `(created_by, idempotency_key)`;
3. `payment_attempts` columns and unique
   `(order_id, idempotency_key)`;
4. `stock_reservations` with positive quantity, consistent state timestamps,
   and order/variant foreign keys;
5. `private.payment_handoffs` with a unique 64-lowercase-hex SHA-256 hash,
   one order, optional `claimed_by`, claim consistency, expiry, and revocation;
6. partial index on active reservation `(variant_id, expires_at)`;
7. order history indexes on `(created_at desc, id desc)`, payment method/state,
   and expiry;
8. payment history indexes on `(created_at desc, id desc)`, status/provider,
   and reconciliation code;
9. trigger-based updated timestamps where records are mutable;
10. RLS, force RLS, explicit revokes, and narrow select grants.

Keep `payment_handoffs` private. Public functions are the only claimant access.
Replace `payment_attempts_select` with a store-operator-only policy.
Authenticated claimants receive a minimal projection through Task 8 functions,
so they cannot query stored checkout URLs or reconciliation internals directly.

- [ ] **Step 5: Rebuild canonical declarations**

Make the same final schema appear in `main_schema.sql` at dependency-correct
locations. Do not paste `alter table` history into the canonical file; rewrite
the affected `create table` declarations with their final columns and add new
objects in final order.

- [ ] **Step 6: Verify schema green**

Run:

```powershell
pnpm schema:check
git diff --check
```

When local Supabase is available:

```powershell
npx supabase --workdir ../docs db reset
npx supabase --workdir ../docs test db
npx supabase --workdir ../docs db lint
```

Expected: structural check and diff check exit `0`; database tests and lint
exit `0` when the local service is available.

- [ ] **Step 7: Commit**

```powershell
git add docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql docs/supabase/main_schema.sql docs/supabase/tests/store_orders_payments.test.sql client-side/scripts/validate-main-schema.mjs
git commit -m "feat: add order reservation schema"
```

---

### Task 4: Implement transactional order and inventory functions

**Files:**

- Modify:
  `docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql`
- Modify: `docs/supabase/main_schema.sql`
- Modify: `docs/supabase/tests/store_orders_payments.test.sql`

**Interfaces:**

- Produces:
  `public.search_sellable_variants(search_query text, result_limit integer)`.
- Produces:
  `public.create_online_counter_order(items jsonb, operation_id uuid, request_fingerprint text, provider_name text, handoff_token_sha256 text, reservation_ttl_minutes integer) returns jsonb`.
- Produces:
  `public.complete_cash_counter_sale(items jsonb, cash_received_paise bigint, operation_id uuid, request_fingerprint text) returns jsonb`.
- Produces:
  `public.attach_provider_checkout(target_order_id uuid, target_attempt_id uuid, provider_name text, provider_checkout_id text, provider_checkout_url text, checkout_expires_at timestamptz) returns jsonb`.
- Produces:
  `public.fail_provider_checkout_creation(target_order_id uuid, target_attempt_id uuid, failure_code text, failure_message text) returns void`.
- Produces:
  `public.record_provider_checkout_uncertain(target_order_id uuid, target_attempt_id uuid, reconciliation_code text, reconciliation_message text) returns void`.
- Produces:
  `public.restart_online_payment(target_order_id uuid, operation_id uuid, request_fingerprint text, provider_name text, handoff_token_sha256 text, reservation_ttl_minutes integer) returns jsonb`.
- Produces:
  `public.cancel_online_counter_order(target_order_id uuid) returns void`.
- Produces:
  `public.rotate_payment_handoff(target_order_id uuid, handoff_token_sha256 text) returns void`.

- [ ] **Step 1: Write failing authorization and validation tests**

Create deterministic manager, super-admin, and student fixtures. Cover:

- manager and super-admin success;
- student and anonymous denial;
- empty basket;
- duplicate variant IDs in JSON;
- missing variant;
- archived product or variant;
- zero, negative, fractional, string, or overflowing quantity;
- observed price mismatch;
- physical stock minus active reservation availability;
- expired reservations ignored and released;
- stable variant locking;
- immutable line snapshots;
- server-calculated totals;
- same idempotency plus same fingerprint returns same order;
- same idempotency plus different fingerprint raises
  `IDEMPOTENCY_CONFLICT`.

Use an item payload shaped exactly as:

```sql
jsonb_build_array(
  jsonb_build_object(
    'variantId', :'variant_id',
    'quantity', 2,
    'observedPricePaise', 1250
  )
)
```

- [ ] **Step 2: Verify red**

Run:

```powershell
npx supabase --workdir ../docs test db docs/supabase/tests/store_orders_payments.test.sql
```

Expected: FAIL because the functions do not exist. If local Supabase is
unavailable, keep this task blocked; do not implement transaction SQL without
an executable red test.

- [ ] **Step 3: Implement one private basket validator**

Create a private helper that:

1. checks `jsonb_typeof(items) = 'array'` and non-empty;
2. uses `jsonb_to_recordset` with camel-case JSON keys mapped explicitly;
3. validates UUID, positive integer quantity, and non-negative observed paise;
4. rejects duplicate variants;
5. selects and locks active variants ordered by `variant.id`;
6. joins active products;
7. sums active, unexpired reservations excluding the current retry order;
8. calculates available stock;
9. raises stable messages prefixed with the machine code;
10. returns product/variant snapshots and authoritative totals.

Put lock-sensitive logic in the database. Do not reimplement it in a Server
Action.

- [ ] **Step 4: Implement online creation**

`create_online_counter_order` must:

1. require `private.is_store_operator()`;
2. normalize and validate provider name and 64-hex handoff hash;
3. resolve idempotent existing orders before inserting;
4. call the private basket validator;
5. insert `orders` with `payment_method='online'`,
   `status='awaiting_payment'`, frozen total, actor, fingerprint, and expiry;
6. insert one immutable `order_lines` snapshot per validated variant;
7. insert one active reservation per line;
8. insert one pending `payment_attempts` row with exact total and provider;
9. insert one private handoff row;
10. write order, attempt, reservation, and handoff audit events; and
11. return order, lines, attempt ID, and expiry as JSON.

Never return the stored token hash.

- [ ] **Step 5: Implement cash completion**

`complete_cash_counter_sale` uses the same validator, checks
`cash_received_paise >= total`, creates frozen order/lines, inserts a succeeded
cash attempt with exact change, calls the private inventory adjustment for
each variant in stable order, creates one sale movement per line, writes paid
then fulfilled state/timestamps and audit events, and returns the receipt
summary.

It must not create reservations or handoffs.

- [ ] **Step 6: Implement attach, fail, retry, and cancel**

Every function uses conditional state checks:

- attach only one checkout to the named pending attempt;
- definitive failure only changes a pending attempt, releases active
  reservations, and revokes the handoff;
- ambiguous creation or post-creation attachment failure records
  reconciliation while retaining the attempt and reservation for an
  idempotent retry;
- retry only an unpaid online order with no active usable attempt, reacquires
  availability, creates a new attempt, rotates the token hash, and extends the
  bounded expiry;
- cancel only an unpaid online order, marks pending attempts cancelled,
  releases reservations, revokes handoff, and writes audit events.
- rotate only an unclaimed, unexpired, awaiting-payment handoff with a usable
  attached checkout; replace its token hash and invalidate the prior QR.

Never claim an external provider checkout was cancelled unless an adapter
actually confirms that capability.

- [ ] **Step 7: Add database tests for stock semantics**

Prove:

- online creation does not change `current_stock`;
- reservations reduce search result `available_stock`;
- cash deducts once;
- online fail/cancel releases without deduction;
- retry reacquires availability;
- archived variants cannot be reserved;
- manual inventory and order functions cannot jointly make stock negative.

- [ ] **Step 8: Verify green**

Run:

```powershell
pnpm schema:check
npx supabase --workdir ../docs db reset
npx supabase --workdir ../docs test db
npx supabase --workdir ../docs db lint
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 9: Commit**

```powershell
git add docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql docs/supabase/main_schema.sql docs/supabase/tests/store_orders_payments.test.sql
git commit -m "feat: add counter order transactions"
```

---

### Task 5: Add order queries and authorized server actions

**Files:**

- Create: `client-side/features/orders/queries.ts`
- Create: `client-side/features/orders/queries.test.ts`
- Create: `client-side/features/orders/actions.ts`
- Create: `client-side/features/orders/actions.test.ts`
- Modify: `client-side/features/orders/index.ts`

**Interfaces:**

- Produces:
  `searchSellableVariants(query: string): Promise<OrderResult<readonly SellableVariant[]>>`.
- Produces:
  `createOnlineCounterOrder(input: CreateOnlineCounterOrderInput): Promise<OrderResult<OnlineOrderResult>>`.
- Produces:
  `completeCashCounterSale(input: CompleteCashCounterSaleInput): Promise<OrderResult<CashReceipt>>`.
- Produces:
  `retryOnlinePayment(input)` and `cancelOnlineOrder(input)`.
- Produces:
  `rotatePaymentHandoff(orderId: string): Promise<OrderResult<OnlineOrderResult>>`.
- Produces server-only paginated order and detail query functions.

- [ ] **Step 1: Write failing action tests**

Test input parsing before Supabase calls:

```ts
expect(await createOnlineCounterOrder({
  items: [],
  operationId: crypto.randomUUID(),
})).toMatchObject({ ok: false, code: "EMPTY_BASKET" });
```

Test malformed UUIDs, duplicate variants, non-integer quantities, invalid
observed prices, unsafe paise, invalid search lengths, and stable mapping from
database error prefixes to `OrderErrorCode`.

Use injected narrow test doubles for RPC/provider dependencies. Do not mock
React or test only mock call counts.

- [ ] **Step 2: Verify red**

Run:

```powershell
pnpm vitest run features/orders/queries.test.ts features/orders/actions.test.ts
```

Expected: FAIL because modules are absent.

- [ ] **Step 3: Implement validated actions**

Use Zod schemas with:

- `items`: 1–100 unique variant IDs;
- `quantity`: integer `1..1000`;
- `observedPricePaise`: safe non-negative integer;
- `operationId`: UUID;
- `cashReceivedPaise`: safe non-negative integer;
- search query: trimmed maximum 100 characters.

Every mutation calls `requireStoreOperator()` before RPC. Map stable database
codes to user-safe messages. Do not return checkout URLs from public action
results except the manager-only online result after provider attachment.

- [ ] **Step 4: Implement server-side queries**

Use the search RPC for at most 30 results. Use server-side pagination with
cursor or `(created_at,id)` ordering for order history. Start independent
summary, order, and payment reads together. Do not load the entire catalog or
history into the browser.

- [ ] **Step 5: Verify green**

Run:

```powershell
pnpm vitest run features/orders/queries.test.ts features/orders/actions.test.ts
pnpm typecheck
pnpm lint
```

Expected: focused tests pass; static gates exit `0`.

- [ ] **Step 6: Commit**

```powershell
git add client-side/features/orders
git commit -m "feat: add counter order services"
```

---

### Task 6: Implement the Dodo adapter and online checkout saga

**Files:**

- Create: `client-side/features/payments/provider.ts`
- Create: `client-side/features/payments/providers/dodo.ts`
- Create: `client-side/features/payments/providers/dodo.test.ts`
- Create: `client-side/features/payments/handoff.ts`
- Create: `client-side/features/payments/handoff.test.ts`
- Create: `client-side/features/payments/actions.ts`
- Create: `client-side/features/payments/actions.test.ts`

**Interfaces:**

- Produces `getPaymentProvider(): PaymentProvider`.
- Produces:
  `createHandoffToken(): { rawToken: string; sha256: string }`.
- Produces the complete create/attach/fail saga used by
  `createOnlineCounterOrder`.

- [ ] **Step 1: Write failing Dodo checkout tests**

Against a fake SDK client, assert the exact request:

```ts
expect(create).toHaveBeenCalledWith(
  {
    product_cart: [
      {
        product_id: "pwyw_product",
        quantity: 1,
        amount: 12500,
      },
    ],
    return_url: "https://store.example/pay/return/attempt-id",
    cancel_url: "https://store.example/pay/return/attempt-id?cancelled=1",
    metadata: {
      order_id: "order-id",
      order_number: "1042",
      module: "store_counter_sale",
    },
    customer: { email: "buyer@cs.sjcetpalai.ac.in" },
  },
  { idempotencyKey: "attempt-id" },
);
```

When no claimant/customer email exists at creation time, omit `customer`.
Assert response mapping from `session_id` and non-null `checkout_url`.

- [ ] **Step 2: Write failing webhook-normalization tests**

Use signed-fixture injection around `client.webhooks.unwrap`. Cover
`payment.processing`, `payment.succeeded`, `payment.failed`, and
`payment.cancelled`. Normalize:

- header `webhook-id` to `eventId`;
- `data.checkout_session_id` to `checkoutId`;
- `data.payment_id` to `paymentId`;
- `data.total_amount` to `amountPaise`;
- `data.currency` to currency;
- `data.metadata.order_id` to `orderId`; and
- SHA-256 of the exact raw body to `payloadSha256`.

Reject missing event ID, missing checkout ID, unsupported event types, invalid
amount, invalid timestamp, and failed signature verification.

- [ ] **Step 3: Write failing handoff tests**

Assert a 32-byte base64url random token, a 64-character lowercase SHA-256, no
raw token in serialized database input, and no order ID/provider URL in the QR
value.

- [ ] **Step 4: Verify red**

Run:

```powershell
pnpm vitest run features/payments/providers/dodo.test.ts features/payments/handoff.test.ts features/payments/actions.test.ts
```

Expected: FAIL because adapter, handoff, and saga modules are absent.

- [ ] **Step 5: Implement the Dodo adapter**

Instantiate Dodo only inside `providers/dodo.ts`:

```ts
const client = new DodoPayments({
  bearerToken: environment.dodo.apiKey,
  environment: environment.dodo.environment,
  webhookKey: environment.dodo.webhookSecret,
});
```

Create checkout with the pinned SDK:

```ts
client.checkoutSessions.create(body, {
  idempotencyKey: input.idempotencyKey,
});
```

Verify webhooks with
`client.webhooks.unwrap(rawBody, { headers, key })`. Never call
`unsafeUnwrap`. Map `BadRequestError`, `AuthenticationError`,
`PermissionDeniedError`, `NotFoundError`, and
`UnprocessableEntityError` to `ProviderCheckoutError("rejected", ...)`.
Map connection, timeout, conflict, rate-limit, and server errors to
`ProviderCheckoutError("uncertain", ...)`.

- [ ] **Step 6: Implement the provider registry**

Use a server-only registry:

```ts
const providers: Record<PaymentEnvironment["provider"], PaymentProvider> = {
  dodo: createDodoProvider(getPaymentEnvironment()),
};
```

Unknown configuration fails closed. No client component imports this module.

- [ ] **Step 7: Implement the saga**

Order:

1. generate raw handoff token and hash;
2. call `create_online_counter_order`;
3. call `provider.createCheckout` using only the returned frozen order/attempt;
4. call `attach_provider_checkout`;
5. return the app-owned handoff URL and frozen order to the manager.

On a definitive provider rejection, call
`fail_provider_checkout_creation`. On a timeout, connection loss, or failure
after the provider returns a checkout, call
`record_provider_checkout_uncertain`, keep the reservation bounded, and retry
the same attempt with the same provider idempotency key. Never release stock
on an ambiguous result. Never log the token or provider URL.

- [ ] **Step 8: Verify green**

Run:

```powershell
pnpm vitest run features/payments/provider-contract.test.ts features/payments/providers/dodo.test.ts features/payments/handoff.test.ts features/payments/actions.test.ts
pnpm typecheck
pnpm lint
```

Expected: focused tests pass; static gates exit `0`.

- [ ] **Step 9: Commit**

```powershell
git add client-side/features/payments client-side/features/orders/actions.ts client-side/features/orders/actions.test.ts
git commit -m "feat: add provider neutral online checkout"
```

---

### Task 7: Build the counter-sale basket UI

**Files:**

- Create: `client-side/features/store-manager/counter-sale.tsx`
- Create: `client-side/features/store-manager/counter-sale.test.tsx`
- Create: `client-side/features/store-manager/online-order-result.tsx`
- Modify: `client-side/app/store-manager/orders/new/page.tsx`
- Modify: `client-side/app/globals.css`

**Interfaces:**

- Consumes pure basket helpers, `searchSellableVariants`,
  `completeCashCounterSale`, and `createOnlineCounterOrder`.
- Produces `SM-ORDER-001` through `SM-ORDER-012` manager UI.

- [ ] **Step 1: Write failing component tests**

Render with injected actions and prove:

- empty checkout disabled;
- search result shows product, variant, SKU, price, and available stock;
- duplicate add merges;
- quantity change resets collection;
- collected progress is announced with `aria-live="polite"`;
- out-of-stock add disabled;
- cash and online are a radio group;
- cash shows received/change and online hides them;
- uncollected warning does not disable checkout;
- pending submission prevents duplicate clicks;
- price/stock errors keep the editable basket;
- online success locks the basket and shows QR result;
- cash success shows receipt and change;
- an unclaimed online order can rotate and redisplay a lost QR after refresh;
- a claimed or terminal handoff cannot rotate.

- [ ] **Step 2: Verify red**

Run:

```powershell
pnpm vitest run features/store-manager/counter-sale.test.tsx
```

Expected: FAIL because the component is absent.

- [ ] **Step 3: Implement the component**

Use one focused client component. Keep:

- `lines: readonly BasketLine[]`;
- `paymentMethod: PaymentMethod`;
- `cashReceivedInput: string`;
- stable `operationId` generated once per new sale;
- async pending/error/result state.

Do not copy server totals into authoritative hidden fields. Send only
`toCounterOrderItems(lines)`, selected method, operation ID, and cash received.

- [ ] **Step 4: Render the QR accessibly**

Generate a QR data URL on the server or in the manager-only result helper with:

```ts
QRCode.toDataURL(handoffUrl, {
  errorCorrectionLevel: "M",
  margin: 2,
  width: 320,
  color: { dark: "#10251A", light: "#FFFFFF" },
});
```

Render a visible copyable URL and meaningful alt text. Never put the provider
checkout URL into QR props or browser storage.

- [ ] **Step 5: Add responsive styling**

Desktop: search/results and sticky basket use two columns. Mobile: search,
results, basket, collection, method, and submit follow DOM order. Preserve
focus-visible styles, minimum touch targets, semantic labels, and WCAG AA
contrast.

- [ ] **Step 6: Verify green**

Run:

```powershell
pnpm vitest run features/store-manager/counter-sale.test.tsx features/orders/basket.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

Expected: focused tests pass and static/build gates exit `0`.

- [ ] **Step 7: Commit**

```powershell
git add client-side/features/store-manager/counter-sale.tsx client-side/features/store-manager/counter-sale.test.tsx client-side/features/store-manager/online-order-result.tsx client-side/app/store-manager/orders/new/page.tsx client-side/app/globals.css
git commit -m "feat: build counter sale basket"
```

---

### Task 8: Add authenticated QR claim and hosted-checkout redirect

**Files:**

- Modify:
  `docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql`
- Modify: `docs/supabase/main_schema.sql`
- Modify: `docs/supabase/tests/store_orders_payments.test.sql`
- Modify: `client-side/features/payments/actions.ts`
- Create: `client-side/app/pay/[token]/page.tsx`
- Create: `client-side/app/pay/[token]/checkout/route.ts`
- Create: `client-side/app/pay/return/[attemptId]/page.tsx`
- Create: `client-side/features/payments/payment-handoff.test.tsx`

**Interfaces:**

- Produces:
  `public.claim_payment_handoff(handoff_token_sha256 text) returns jsonb`.
- Produces:
  `public.get_payment_handoff(handoff_token_sha256 text) returns jsonb`.
- Produces:
  `public.get_payment_redirect(handoff_token_sha256 text) returns jsonb`.
- Produces:
  `public.get_payment_return_status(target_attempt_id uuid) returns jsonb`.

- [ ] **Step 1: Write failing database claim tests**

Cover:

- anonymous denial;
- unknown hash returns one generic invalid error;
- first authenticated claim stores `claimed_by` and `claimed_at`;
- the same claim sets `orders.student_id`;
- same user can reopen;
- different user gets generic claimed/invalid response with no details;
- expired or revoked handoff reveals no details;
- response contains frozen display fields but no UUIDs, token hash, checkout
  URL, audit metadata, or provider payload;
- redirect function returns URL only to the claimant and only while payable.

- [ ] **Step 2: Verify database red**

Run the focused pgTAP file.

Expected: FAIL because handoff functions are absent.

- [ ] **Step 3: Implement handoff functions**

All functions are `security definer`, `set search_path = ''`, validate
`auth.uid()`, revoke default `PUBLIC` execute, and grant only to
`authenticated` and `service_role` as required.

On read:

1. hash is already computed by server code;
2. lock handoff;
3. reject/revoke expired records;
4. claim only when `claimed_by is null`;
5. set `orders.student_id = auth.uid()` in the same first-claim transaction;
6. require `claimed_by = auth.uid()` and the same order student afterward;
7. return a purpose-built JSON projection.

Do not grant direct claimant access to `private.payment_handoffs`.

- [ ] **Step 4: Write failing page and route tests**

Prove:

- unauthenticated page redirects to
  `/auth?next=<encoded /pay/token>`;
- authenticated valid claimant sees order number, lines, total, state, and
  **Pay securely**;
- manager controls are absent;
- invalid tokens use one generic message;
- checkout route never accepts a URL query/form field;
- return page never calls a success mutation.

- [ ] **Step 5: Implement the handoff page**

Call `requireAuthenticatedUser()`, hash the route token server-side, call claim
or get RPC, and render read-only semantic order content. Add
`robots: { index: false, follow: false }` and a no-referrer policy for the
handoff surface.

- [ ] **Step 6: Implement the redirect Route Handler**

On `GET`, authenticate, hash the route token, call
`get_payment_redirect`, and return `NextResponse.redirect(serverUrl)` only for
an HTTPS URL and an allowed attempt state. Set `Referrer-Policy: no-referrer`
and `Cache-Control: no-store`. Any failure returns to the same handoff with a
safe status code; it does not redirect to an arbitrary browser value.

- [ ] **Step 7: Implement provider return status**

Use attempt ID only as a lookup key. Require authentication and claimed
handoff ownership in the database. Show `pending`, `processing`, `succeeded`,
`failed`, or `cancelled`. Poll or refresh authoritative status. Do not infer
success from `cancelled=1` or any provider query parameter.

- [ ] **Step 8: Verify green**

Run:

```powershell
pnpm schema:check
npx supabase --workdir ../docs test db
pnpm vitest run features/payments/handoff.test.ts features/payments/payment-handoff.test.tsx
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every available gate exits `0`.

- [ ] **Step 9: Commit**

```powershell
git add docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql docs/supabase/main_schema.sql docs/supabase/tests/store_orders_payments.test.sql client-side/features/payments client-side/app/pay
git commit -m "feat: add authenticated payment handoff"
```

---

### Task 9: Process provider webhooks and deduct stock once

**Files:**

- Modify:
  `docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql`
- Modify: `docs/supabase/main_schema.sql`
- Modify: `docs/supabase/tests/store_orders_payments.test.sql`
- Create: `client-side/app/api/webhooks/dodo/route.ts`
- Create: `client-side/app/api/webhooks/dodo/route.test.ts`

**Interfaces:**

- Produces:
  `public.process_online_payment_event(provider_name text, provider_event_id text, event_type text, provider_checkout_id text, provider_payment_id text, event_amount_paise bigint, event_currency text, event_order_id uuid, payload_sha256 text, occurred_at timestamptz) returns jsonb`.
- Function execute is revoked from `public`, `anon`, and `authenticated`; only
  `service_role` may call it.

- [ ] **Step 1: Write failing pgTAP event tests**

Cover:

- service-role-only execution;
- processing transition;
- succeeded exact match;
- invalid amount;
- invalid currency;
- checkout mismatch;
- metadata order mismatch;
- unknown attempt;
- duplicate event ID;
- failed/cancelled transition;
- late success after cancellation/expiry;
- reservation consumption;
- exactly one physical stock deduction and movement;
- paid then fulfilled timestamps;
- audit events;
- no deduction on any mismatch.

- [ ] **Step 2: Verify database red**

Run the focused database test.

Expected: FAIL because the processing function is absent.

- [ ] **Step 3: Implement the database event transaction**

Order the logic:

1. require service role;
2. validate non-blank provider/event/type and 64-hex payload hash;
3. insert `private.processed_webhooks` with `on conflict do nothing`;
4. for an existing event ID, require the same payload hash and event type;
5. return duplicate success only for an exact replay, otherwise record a
   provider-event collision and reject it;
6. lock attempt, order, reservations, and variants;
7. verify checkout, order metadata, amount, and currency;
8. for mismatch, set reconciliation code/message and audit without success;
9. for processing, conditionally set attempt processing;
10. for failed/cancelled, conditionally transition attempt and release;
11. for success, require payable order and active reservations;
12. decrement each variant once in stable order;
13. insert one sale movement per line with event-derived idempotency;
14. consume reservations;
15. mark attempt succeeded with provider payment ID;
16. mark order paid, then fulfilled, with timestamps;
17. audit all transitions; and
18. return a stable JSON result.

- [ ] **Step 4: Write failing Route Handler tests**

Test raw `request.text()`, original headers, adapter verification before admin
client construction/RPC, supported normalized event mapping, `400` for invalid
payload, `401` for signature failure, retryable `500` for unexpected internal
failure, and `200` for processed or duplicate valid events.

- [ ] **Step 5: Implement the Dodo route**

The route:

```ts
const rawBody = await request.text();
const headers = Object.fromEntries(request.headers.entries());
const event = await provider.verifyAndNormalizeWebhook(rawBody, headers);
const admin = createSupabaseAdminClient();
const { data, error } = await admin.rpc("process_online_payment_event", {
  // normalized fields only
});
```

Never parse JSON before verification. Never log raw body, signature, secret,
customer payment data, or full URLs.

- [ ] **Step 6: Verify green**

Run:

```powershell
pnpm schema:check
npx supabase --workdir ../docs db reset
npx supabase --workdir ../docs test db
npx supabase --workdir ../docs db lint
pnpm vitest run app/api/webhooks/dodo/route.test.ts features/payments/providers/dodo.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all available gates exit `0`.

- [ ] **Step 7: Commit**

```powershell
git add docs/supabase/migrations/20260719171626_007-19-07-2026-order-basket-payments.sql docs/supabase/main_schema.sql docs/supabase/tests/store_orders_payments.test.sql client-side/app/api/webhooks/dodo
git commit -m "feat: process verified payment events"
```

---

### Task 10: Build order history, payment history, details, and bills

**Files:**

- Create: `client-side/features/store-manager/order-history.tsx`
- Create: `client-side/features/store-manager/order-history.test.tsx`
- Create: `client-side/features/store-manager/order-detail.tsx`
- Create: `client-side/features/store-manager/payment-history.tsx`
- Create: `client-side/features/store-manager/payment-history.test.tsx`
- Create: `client-side/features/orders/bill.tsx`
- Create: `client-side/features/orders/bill.test.tsx`
- Modify: `client-side/app/store-manager/orders/page.tsx`
- Create: `client-side/app/store-manager/orders/[id]/page.tsx`
- Create: `client-side/app/store-manager/orders/[id]/bill/page.tsx`
- Modify: `client-side/app/store-manager/payments/page.tsx`
- Modify: `client-side/app/globals.css`

**Interfaces:**

- Produces `SM-ORDER-022` through `SM-ORDER-024`.
- Consumes server-paginated order/payment reads and frozen snapshots.

- [ ] **Step 1: Write failing history tests**

Assert order search/date/method/payment-state/order-state controls, pagination,
empty state, stable order-number links, and no client-side full-dataset
filtering.

Assert payment history shows safe provider/attempt/reconciliation fields but
not raw webhook payload, secret, token hash, or full checkout URL.

- [ ] **Step 2: Write failing bill tests**

Prove a paid/fulfilled order renders frozen names, SKUs, variants, quantities,
unit prices, totals, order number, payment method, and paid time. Prove unpaid
or cancelled state returns a not-printable message and no paid label.

- [ ] **Step 3: Verify red**

Run:

```powershell
pnpm vitest run features/store-manager/order-history.test.tsx features/store-manager/payment-history.test.tsx features/orders/bill.test.tsx
```

Expected: FAIL because components are absent.

- [ ] **Step 4: Implement server-first pages**

Parse allowlisted query parameters. Call `requireStoreOperator()` in every
route. Pass minimal serializable data to components. Use URL search params for
filters and pagination. Details show frozen lines, attempts, actor/claim IDs as
safe identities, timestamps, and audit activity.

- [ ] **Step 5: Implement print layout**

Use semantic receipt markup and `@media print` to hide manager navigation,
buttons, filters, and notices. Do not query current product names or prices for
the bill.

- [ ] **Step 6: Verify green**

Run:

```powershell
pnpm vitest run features/store-manager/order-history.test.tsx features/store-manager/payment-history.test.tsx features/orders/bill.test.tsx
pnpm typecheck
pnpm lint
pnpm build
```

Expected: focused tests pass and static/build gates exit `0`.

- [ ] **Step 7: Commit**

```powershell
git add client-side/features/store-manager/order-history.tsx client-side/features/store-manager/order-history.test.tsx client-side/features/store-manager/order-detail.tsx client-side/features/store-manager/payment-history.tsx client-side/features/store-manager/payment-history.test.tsx client-side/features/orders/bill.tsx client-side/features/orders/bill.test.tsx client-side/app/store-manager/orders client-side/app/store-manager/payments/page.tsx client-side/app/globals.css
git commit -m "feat: add order and payment records"
```

---

### Task 11: Add module-boundary and end-to-end acceptance coverage

**Files:**

- Create:
  `client-side/features/store-manager/order-module-boundary.test.ts`
- Create: `client-side/tests/e2e/store-manager-checkout.spec.ts`
- Modify: `client-side/tests/fixtures/*` only if existing fixture conventions
  require an order builder

**Interfaces:**

- Produces automated evidence for `SM-ORDER-001` through `SM-ORDER-026`.
- Proves the student-module exclusion.

- [ ] **Step 1: Write the source-boundary test**

Read all files under `features/orders`, `features/payments`,
`features/store-manager`, `app/store-manager`, `app/pay`, and the Dodo route.
Fail if any import path contains `/student`, `features/student`, or
`app/dashboard`.

Also assert Dodo imports occur only in:

```text
client-side/features/payments/providers/dodo.ts
client-side/features/payments/providers/dodo.test.ts
```

- [ ] **Step 2: Write the failing Playwright flow**

Use deterministic local fixtures. Cover in visible order:

1. manager sign-in;
2. counter-sale open;
3. search/add two variants;
4. quantity and collected state;
5. online selection and submit;
6. QR and copyable app URL;
7. separate authenticated claimant browser context;
8. frozen handoff summary;
9. provider redirect interception;
10. verified webhook fixture;
11. paid/fulfilled refresh;
12. exactly one stock deduction;
13. order history/detail/bill;
14. exact-cash sale;
15. excess-cash/change sale;
16. unauthorized manager mutation denial;
17. duplicate webhook;
18. stale price;
19. insufficient available stock; and
20. cancellation/release.

Tag provider-dashboard-dependent coverage separately. The default deterministic
suite must not call live Dodo.

- [ ] **Step 3: Verify red**

Run:

```powershell
pnpm vitest run features/store-manager/order-module-boundary.test.ts
pnpm test:e2e tests/e2e/store-manager-checkout.spec.ts
```

Expected: boundary test or browser scenarios fail before the complete
integration exists.

- [ ] **Step 4: Add only required fixtures/hooks**

Use database fixtures or documented test-only external boundaries. Do not add
test-only production endpoints or methods. Mock the provider at the adapter
boundary, not basket/order/inventory behavior.

- [ ] **Step 5: Verify green**

Run:

```powershell
pnpm vitest run features/store-manager/order-module-boundary.test.ts
pnpm test:e2e tests/e2e/store-manager-checkout.spec.ts
```

Expected: all deterministic scenarios pass with zero unexpected skips.

- [ ] **Step 6: Commit**

```powershell
git add client-side/features/store-manager/order-module-boundary.test.ts client-side/tests/e2e/store-manager-checkout.spec.ts client-side/tests/fixtures
git commit -m "test: cover store manager checkout"
```

---

### Task 12: Synchronize documentation and run the completion gate

**Files:**

- Verify/update: `docs/requirements/store_manager.md`
- Verify/update: `docs/architecture/project-foundation.md`
- Verify/update:
  `docs/testing/store-manager-order-basket-ui-acceptance.md`
- Verify/update:
  `docs/superpowers/specs/2026-07-19-store-manager-order-basket-design.md`
- Verify/update: `docs/runbooks/payments.md`
- Verify/update: `client-side/.env.example`
- Do not modify: `docs/requirements/store_students.md`

**Interfaces:**

- Produces complete requirement/design/test/runbook/implementation
  traceability.

- [ ] **Step 1: Build the final traceability checklist**

For each `SM-ORDER-001` through `SM-ORDER-026`, record the exact component,
unit/integration test, database test, and Playwright scenario that proves it.
No scenario may be marked covered by a generic suite name alone.

- [ ] **Step 2: Review provider and operational documentation**

Confirm the runbook includes:

- all environment names without values;
- Dodo test Pay-What-You-Want product setup;
- exact checkout item/metadata mapping;
- webhook subscriptions and signature verification;
- reconciliation conditions;
- cancellation/expiration limits;
- provider replacement steps;
- local verification;
- test-to-live checks; and
- explicit remote-change authorization.

- [ ] **Step 3: Run the complete fresh gate**

From `client-side/`:

```powershell
pnpm schema:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
npx supabase --workdir ../docs db reset
npx supabase --workdir ../docs test db
npx supabase --workdir ../docs db lint
pnpm test:e2e
git diff --check
```

Read every exit code and test summary. Do not infer one gate from another.

- [ ] **Step 4: Prove excluded paths are untouched**

Run from the repository root:

```powershell
git diff --name-only -- client-side/features/student client-side/app/dashboard docs/requirements/store_students.md
```

Expected: no output.

Run:

```powershell
git diff --name-only
git status --short
```

Review every path and separate unrelated pre-existing work from this feature.

- [ ] **Step 5: Perform manual responsive acceptance**

Inspect counter sale, QR result, pay handoff, order history, payment history,
detail, and bill at desktop and mobile widths. Verify keyboard-only use,
visible focus, labels, live status announcements, print preview, QR scanning,
and no horizontal trapping.

- [ ] **Step 6: Record environmental limitations honestly**

If Docker, local Supabase, Dodo test credentials, email confirmation, or a
browser is unavailable, list the exact commands/scenarios not executed. Do not
call the feature complete until required gates have fresh evidence.

- [ ] **Step 7: Commit documentation synchronization**

```powershell
git add docs/requirements/store_manager.md docs/architecture/project-foundation.md docs/testing/store-manager-order-basket-ui-acceptance.md docs/superpowers/specs/2026-07-19-store-manager-order-basket-design.md docs/runbooks/payments.md client-side/.env.example
git commit -m "docs: document store manager checkout"
```

## Plan Self-Review

### Spec coverage

- `SM-ORDER-001`–`006`: Tasks 2, 5, and 7.
- `SM-ORDER-007`–`009`: Tasks 3 and 4.
- `SM-ORDER-010`–`012`: Tasks 6 and 7.
- `SM-ORDER-013`–`017`: Tasks 1 and 8.
- `SM-ORDER-018`–`021`: Tasks 4 and 9.
- `SM-ORDER-022`–`024`: Task 10.
- `SM-ORDER-025`: Tasks 2 and 6.
- `SM-ORDER-026`: Tasks 11 and 12.

### Locked consistency

- Handoff tokens are random 32-byte base64url values; only 64-character
  lowercase SHA-256 hashes are stored.
- Reservations use a validated 30-minute default and never mutate physical
  stock before payment success.
- Cash has no reservation or provider step.
- QR always contains an application URL, never a provider URL.
- Provider return is status-only.
- `PaymentProvider` and normalized event types have one spelling throughout.
- The Dodo adapter is the only production Dodo import.
- Webhook database processing is service-role-only.
- Student-owned files are excluded by scope, source test, and final diff.

## Execution Handoff

Implement tasks in dependency order. A task is complete only after its focused
red/green evidence and listed verification pass. Mark each checkbox
immediately after evidence is recorded; do not batch status updates at the end.

Recommended execution when delegation is explicitly authorized:
`subagent-driven-development`, one implementation task at a time with
requirements review followed by code-quality review. Otherwise use
`executing-plans` inline with review checkpoints after Tasks 4, 8, 9, and 12.
