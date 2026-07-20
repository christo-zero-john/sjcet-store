# Store Manager Order Basket Design

## Status

Approved scope. The natural-language behavior authority is
`docs/testing/store-manager-order-basket-ui-acceptance.md`.

## Goal

Implement the store-manager counter-sale basket, cash checkout, online QR
handoff, order history, payment history, and paid bill while preserving the
existing inventory implementation and keeping the hosted payment provider
replaceable.

## Scope boundary

### In scope

- Store-manager counter-sale UI.
- Shared order creation and immutable order-line snapshots.
- Cash completion.
- Provider-neutral online checkout orchestration.
- Dodo Checkout Sessions adapter and verified webhook adapter.
- Application-owned QR and authenticated read-only payment handoff.
- Order and payment history for store operators.
- Paid bill rendering.
- Stock reservation, release, and single successful-payment deduction.
- Required schema, RLS, database functions, audit records, tests, and runbooks.
- A narrow shared-auth safe-return contract for `/pay/<token>`.

### Out of scope

- Student storefront, dashboard, basket, or order-history UI.
- Guest account creation or guest authentication.
- Changes to student requirements.
- Refunds, returns, discounts, partial payments, or void workflows.
- Remote Supabase, Dodo, deployment, or production-data changes.

The implementation must not modify:

- `client-side/features/student/**`;
- `client-side/app/dashboard/**`; or
- `docs/requirements/store_students.md`.

## Architecture

The store-manager feature composes three public feature contracts:

- `orders` owns basket validation, immutable snapshots, state transitions,
  reservations, order reads, and bills;
- `payments` owns payment attempts, provider-neutral checkout and webhook
  contracts, handoff authorization, and payment reads; and
- `inventory` remains the only owner of physical stock changes.

The basket UI may calculate estimated totals, but database functions calculate
authoritative totals and lock variants in stable UUID order. Online checkout
uses a short saga because a Postgres transaction cannot include Dodo:

1. create the frozen awaiting-payment order, attempt, handoff hash, and stock
   reservations transactionally;
2. call the configured provider through `PaymentProvider`;
3. attach the provider checkout ID and URL transactionally; or
4. mark creation failed and release reservations.

Provider checkout creation uses the payment-attempt ID as the provider
idempotency key. A definitive provider rejection may fail the attempt and
release reservations. An ambiguous network result keeps the attempt and
reservation pending so retry can request the same provider checkout. Once the
provider returns a checkout, attachment failure enters reconciliation and does
not pretend that checkout creation failed.

Cash checkout is one database transaction because there is no external
provider call.

The QR contains an application URL such as
`https://store.example/pay/<random-token>`. Only a SHA-256 token hash is stored.
The first authenticated user to present a valid token claims the handoff.
The claim transaction also assigns `orders.student_id` to that identity.
Subsequent reads require the same authenticated user. The handoff page is owned
by orders/payments and uses shared authentication; it is not part of the
student feature.

## Provider-neutral payment contract

Core code depends on this conceptual interface:

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

Only `features/payments/providers/dodo.ts` imports `dodopayments`. The Dodo
adapter creates one product-cart item using the configured one-time
Pay-What-You-Want product, `quantity: 1`, and
`amount: input.amountPaise`. Dodo metadata contains the internal order ID,
order number, and module identifier. Dodo redirects are never payment proof.
The adapter maps provider errors into `ProviderCheckoutError`. Validation,
authentication, permission, not-found, and unprocessable responses are
definitive rejections. Connection, timeout, conflict, rate-limit, and server
errors are uncertain and retain bounded reservation state for idempotent retry.

## Data model changes

The existing `orders`, `order_lines`, `payment_attempts`,
`stock_movements`, and `private.processed_webhooks` tables remain canonical.
The schema change extends them and adds focused records:

- `stock_reservations`: one row per order line, with quantity, active/released/
  consumed state, expiry, and timestamps;
- `payment_handoffs`: one per online order, with token hash, optional claiming
  user, expiry, claim time, and revocation time;
- payment-attempt idempotency, provider-checkout expiry, and reconciliation
  fields;
- order idempotency and expiry fields; and
- indexes supporting available-stock calculation, history filters, token
  lookup, provider reconciliation, and expiry cleanup.

Raw handoff tokens and raw webhook payloads are not stored. Provider event IDs
and payload hashes are stored for idempotency and traceability.

Because the raw handoff token is returned only once, a store operator may
rotate an unclaimed awaiting-payment handoff after a refresh or lost response.
Rotation replaces the stored hash and invalidates the old QR. Claimed,
expired, revoked, paid, or terminal handoffs cannot rotate.

## Transaction boundaries

### Online order creation

`create_online_counter_order` authenticates a store operator, validates one
non-empty JSON basket, locks variants in stable order, subtracts active
reservations from physical stock, rejects stale prices or insufficient
availability, creates immutable snapshots, creates reservations with a
30-minute deadline, creates the payment attempt and handoff hash, writes audit
events, and returns the frozen order summary.

### Provider attachment or failure

`attach_provider_checkout` conditionally attaches one provider checkout to the
pending attempt. `fail_provider_checkout_creation` conditionally marks a
definitively rejected attempt failed and releases its order reservations.
`record_provider_checkout_uncertain` retains a bounded reservation and records
an ambiguous creation or attachment result for idempotent retry. All three are
idempotent and store-operator-only.

### Cash completion

`complete_cash_counter_sale` performs basket validation, order and line
creation, cash validation, payment success, stock deduction, stock movements,
audit writes, and paid/fulfilled timestamps in one store-operator-authorized
transaction.

### Online success

The webhook route verifies the raw request before using a server-only Supabase
client. `process_online_payment_event` is callable only by `service_role`. It
inserts the provider event ID first, verifies attempt/order/amount/currency,
locks reservations and variants, transitions the attempt and order, consumes
reservations, deducts stock once, writes movements/audits, and finishes the
counter order. Duplicate event IDs return the already-processed result.

Invalid but authentic events record a reconciliation code without mutating
stock or falsely marking payment successful.

## UI composition

`/store-manager/orders/new` is a responsive two-column workspace on desktop
and a single ordered flow on small screens:

- left/top: search and variant results;
- right/bottom: basket lines, collected progress, totals, method, and checkout;
- online result: locked order summary, QR, copy action, status, cancel, and
  start-another-sale;
- cash result: receipt summary, cash received, change, paid state, print, and
  start-another-sale.

`/pay/[token]` is a minimal authenticated read-only page outside the manager
layout. It never exposes manager controls. A server-owned redirect endpoint
validates the handoff again before redirecting to a provider URL.

Order and payment history use server-side pagination and filters rather than
loading all records and filtering in the browser.

## Error behavior

Errors use stable codes and user-safe messages. At minimum:

- `EMPTY_BASKET`;
- `INVALID_QUANTITY`;
- `VARIANT_UNAVAILABLE`;
- `PRICE_CHANGED`;
- `INSUFFICIENT_STOCK`;
- `IDEMPOTENCY_CONFLICT`;
- `ORDER_NOT_PAYABLE`;
- `HANDOFF_INVALID`;
- `HANDOFF_CLAIMED`;
- `HANDOFF_EXPIRED`;
- `CHECKOUT_CREATE_FAILED`;
- `PROVIDER_EVENT_INVALID`;
- `PAYMENT_MISMATCH`; and
- `UNAUTHORIZED`.

No error includes API keys, webhook secrets, raw payloads, checkout URLs, or
database implementation details.

## Security and privacy

- Store mutations call `requireStoreOperator()` and database functions also
  enforce `private.is_store_operator()`.
- The pay page calls `requireAuthenticatedUser()` and database handoff
  functions bind reads to `auth.uid()`.
- Safe return destinations accept only relative `/pay/` paths with no scheme,
  host, backslash, or protocol-relative prefix.
- Public/anonymous roles receive no table or function access to orders,
  attempts, reservations, or handoffs.
- Authenticated claimants read payment status through purpose-built handoff
  functions. They do not receive direct `payment_attempts` table access or its
  stored provider URL.
- Webhook processing uses the raw body and verified provider signature.
- `SUPABASE_SECRET_KEY`, Dodo API key, and webhook secret stay server-only.
- Checkout URLs are read only at validated server redirect boundaries.
- RLS, explicit revokes, narrow grants, and service-role-only webhook
  functions are tested.

## Performance

- Search queries are server-filtered and bounded.
- Independent page reads start together and use `Promise.all`.
- History and payment lists are paginated.
- Supporting indexes cover active reservations, order history, payment
  filters, handoff hashes, and provider references.
- The QR encoder is imported only by the manager QR component/server helper,
  not the global application shell.

## Documentation

The implementation updates:

- `docs/requirements/store_manager.md`;
- `docs/architecture/project-foundation.md`;
- `docs/testing/store-manager-order-basket-ui-acceptance.md`;
- `docs/runbooks/payments.md`;
- `docs/supabase/main_schema.sql`; and
- the new append-only migration and database tests.

The runbook documents provider registration, required environment variables,
Dodo test-product setup, webhook setup, test-to-live checks, provider swap
steps, reconciliation signals, and the explicit ban on committed credentials.

## Verification

Execution uses test-first red/green cycles. Completion requires focused unit
and component tests, database tests, schema validation, typecheck, lint, build,
Playwright acceptance, a provider-contract test with fake and Dodo adapters,
source-boundary checks, and a final diff proving student-owned files were not
changed.
