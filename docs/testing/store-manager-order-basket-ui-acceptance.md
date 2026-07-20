# Store Manager Order Basket UI Acceptance

## Purpose

This document is the natural-language test authority for the store-manager
counter-sale, order, and payment flow. Implementation starts from these tests.
Automated component, database, integration, and browser tests must preserve the
same order of events and the same module boundaries.

The flow is owned by the store-manager, orders, payments, and inventory
contracts. It must not add student-store behavior or modify:

- `client-side/features/student/**`;
- `client-side/app/dashboard/**`; or
- `docs/requirements/store_students.md`.

The authenticated QR handoff page is a shared orders/payments surface. It is
not a student-module page.

## Terms

- **Basket**: unsaved client-side counter-sale composition.
- **Collected**: a temporary manager-only checkbox showing that the physical
  item has been picked. It never changes stock.
- **Available stock**: physical current stock minus active, unexpired online
  order reservations.
- **Frozen order**: an order whose names, SKUs, variant descriptions, unit
  prices, quantities, and totals are immutable snapshots.
- **Handoff URL**: an application-owned URL encoded in the QR.
- **Provider checkout URL**: the hosted payment URL returned by the configured
  payment provider. It is never encoded directly into the QR.

## Ordered acceptance scenarios

### `SM-ORDER-001`: Open the counter-sale workspace

Given an authenticated `store_manager` or `super_admin`, when the actor opens
`/store-manager/orders/new`, then the page shows product search, a basket,
collected-item progress, an estimated basket total, cash and online payment
choices, and a disabled checkout action while the basket is empty. The page
labels the estimate and replaces it with the server-frozen total at checkout.

Given any other authenticated role, opening the route or invoking one of its
mutations must be denied by the existing store-operator authorization
boundary.

### `SM-ORDER-002`: Find an active sellable variant

Given active, archived, in-stock, and out-of-stock variants, when the manager
searches by product name, SKU, barcode, or variant description, then results
show product name, variant description, SKU, current price, and available
stock. Archived products, archived variants, and out-of-stock variants are not
addable.

### `SM-ORDER-003`: Add and merge basket lines

When the manager adds an available variant, it appears in the basket with
quantity one. Adding the same variant again increments the existing line
instead of creating a duplicate line.

### `SM-ORDER-004`: Change quantities safely

When the manager changes a quantity, the line total and basket total update
immediately for feedback. Quantity must remain a positive integer and may not
exceed the latest displayed available stock. Reducing a quantity to zero
removes the line.

Client totals are estimates only. The server must later ignore all
browser-supplied names, prices, totals, stock values, actor IDs, and payment
amounts.

### `SM-ORDER-005`: Track physical collection

When the manager picks an item from the shop or store room, the manager can
mark its basket line collected. Collected and uncollected lines are visibly
different, and the page announces `N of M items collected`.

Changing a line quantity resets that line to uncollected. Removing a line
removes its collected state. Collection status is not stored in inventory,
does not reserve or deduct stock, and does not change payment state.

Consistent with `docs/requirements/store_manager.md`, uncollected lines show a
warning but do not block checkout.

### `SM-ORDER-006`: Choose exactly one payment method

The manager must choose exactly one method: `cash` or `online`.

Choosing cash displays cash-received and change-due controls and does not
create a QR or provider checkout. Choosing online displays the QR-oriented
flow and hides cash controls. Switching methods before submission must not
leave an order or payment attempt behind.

### `SM-ORDER-007`: Revalidate on the server

When the manager submits checkout, the server reloads all requested variants,
locks them in a stable order, verifies active product and variant state,
verifies positive integer quantities, calculates available stock, and
recalculates every amount from database prices in integer paise.

If a price changed, no order is silently created at the stale price. The
manager sees the affected line and refreshed total and must review and submit
again.

If stock is insufficient, no payable order is created. The manager sees the
affected variant and available quantity.

### `SM-ORDER-008`: Create an immutable online order

Given a valid online basket, one database transaction creates the order,
human-readable order number, immutable line snapshots, frozen INR total,
pending online payment attempt, secure payment-handoff record, and bounded
stock reservations.

The order becomes `awaiting_payment`. Replaying the same manager submission
with the same idempotency key returns the same order and never creates
duplicate lines, attempts, or reservations.

### `SM-ORDER-009`: Reserve without deducting stock

An online order reservation reduces available stock but does not change
`product_variants.current_stock` and does not create a sale movement.

Successful payment consumes the reservation and deducts physical stock once.
Cancellation, provider checkout failure, or expiration releases the
reservation without changing physical stock.

### `SM-ORDER-010`: Create checkout through a provider-neutral contract

Payment orchestration calls a provider-neutral adapter with the internal order
ID, human order number, frozen amount, currency, return URL, customer email
when available, and provider-neutral metadata.

The orders feature, basket UI, QR UI, order history, and bill code must not
import Dodo SDK types or Dodo-specific property names.

The Dodo adapter translates the neutral request into one configured
Pay-What-You-Want product-cart item with quantity one, the exact frozen amount
in paise, INR, and internal order metadata.

### `SM-ORDER-011`: Recover from checkout-creation failure

If the provider definitively rejects checkout creation, the order stays
unpaid, the attempt records a safe failure code, reservations are released,
and no QR is shown.

If checkout creation has an ambiguous result, such as a network timeout after
the provider may have accepted the request, the attempt keeps its reservation
until retry or expiry. A retry uses the same provider idempotency key and
attaches the same checkout instead of creating a duplicate. Retrying never
changes frozen lines or totals.

### `SM-ORDER-012`: Display an application-owned QR

After a usable provider checkout is attached, the manager sees the order
number, frozen item summary, frozen total, current payment state, QR, copyable
handoff URL, refresh control, and permitted cancellation control.

The QR contains only an HTTPS application handoff URL with a high-entropy
opaque token. It contains no raw order lines, internal order UUID, provider
checkout URL, API key, webhook secret, or provider payload.

If the manager loses or refreshes the one-time raw token before it is claimed,
the manager can rotate the unclaimed handoff and display a new QR. Rotation
invalidates the old token. A claimed handoff cannot be rotated.

### `SM-ORDER-013`: Require shared authentication after scanning

When an unauthenticated person scans the QR, the existing shared
authentication surface opens with a validated return destination. After
successful authentication, the user returns to the same handoff URL.

This work consumes shared authentication. It does not implement student or
guest authentication and does not modify any student-owned file.

### `SM-ORDER-014`: Claim the handoff once

On the first authenticated open, the server hashes and validates the opaque
token and claims the handoff for the authenticated user if it is unclaimed.
The same transaction sets the order's `student_id` to that user. The same user
can reopen it. A different user cannot take over an already claimed handoff.

Invalid, revoked, expired, and unknown tokens reveal no order information.

### `SM-ORDER-015`: Show the read-only payment handoff

The authorized claimant sees the human order number, immutable line
descriptions, quantities, unit prices, line totals, final INR total, current
payment state, and a provider-neutral **Pay securely** action.

The page does not show manager controls, inventory controls, internal UUIDs,
audit metadata, secrets, or raw provider data.

### `SM-ORDER-016`: Redirect to a hosted checkout safely

When the claimant selects **Pay securely**, the server revalidates ownership,
order state, attempt state, reservation validity, and the server-stored
checkout URL before redirecting.

The browser never submits a provider URL. Paid, cancelled, expired, or
otherwise unpayable orders do not redirect to a provider.

### `SM-ORDER-017`: Treat provider return as status only

When the provider returns the user to the application, the return page shows a
waiting or current-status view. Query parameters and redirects never mark an
order paid.

### `SM-ORDER-018`: Confirm online payment from a verified webhook

Given a correctly signed, previously unseen success event, the provider
adapter normalizes it. The application verifies the payment attempt, provider
checkout reference, order metadata, exact amount, and INR currency.

One database transaction records the provider event, marks the attempt
`succeeded`, transitions the order through `paid`, consumes reservations,
deducts variant stock once, creates sale movements, records audit events, and
then marks the counter order `fulfilled`.

### `SM-ORDER-019`: Reject unsafe or duplicate webhooks

An invalid signature changes nothing. A valid event with the wrong amount,
currency, order metadata, or checkout reference does not mark the order paid
or deduct stock and records a safe reconciliation failure.

Replaying the same provider event returns an idempotent success response
without duplicating payment, order, audit, or stock changes.

### `SM-ORDER-020`: Complete a cash sale atomically

Cash received must be whole non-negative paise and at least the server-frozen
total. Change due equals cash received minus total on both client and server.

After explicit manager confirmation, one transaction revalidates stock,
creates the frozen order and cash payment, stores cash received and change,
deducts stock once, writes sale movements, and marks the order paid and
fulfilled. Repeating the idempotent submission cannot repeat payment or stock
deduction.

### `SM-ORDER-021`: Cancel or expire an unpaid online order

An authorized manager may cancel an unpaid online order. An abandoned order
may expire at the documented deadline. Cancellation or expiration revokes the
handoff, prevents future provider redirects, releases active reservations, and
leaves physical stock unchanged.

A late provider success for a cancelled or expired order enters
reconciliation handling and must never silently consume unavailable stock.

### `SM-ORDER-022`: Review order history and details

`/store-manager/orders` lists paginated orders and supports search plus date,
payment-method, payment-state, and order-state filters.

The detail page shows frozen lines, totals, payment attempts, manager identity,
claim identity when present, timestamps, and an activity trail. Paid order
content cannot be silently edited.

### `SM-ORDER-023`: Review payments

`/store-manager/payments` lists payment attempts with method, provider, state,
amount, order, created time, success time, and safe failure information.
Provider IDs may be shown for reconciliation, but raw webhook payloads and SDK
objects are never UI contracts.

### `SM-ORDER-024`: Print a paid bill

A paid order has a print-safe bill made from frozen snapshots. Later product,
variant, SKU, or price edits do not change it. Unpaid or cancelled orders
cannot be represented as paid bills.

### `SM-ORDER-025`: Prove provider replaceability

The same orchestration contract tests must pass with a fake provider.
Replacing Dodo with Razorpay, Stripe, or another provider may require a new
adapter, provider configuration, and provider webhook verification and
normalization. It must not require changes to basket rules, order totals, QR
generation, payment handoff UI, inventory transactions, order history, or
bills.

### `SM-ORDER-026`: Prove the student-module exclusion

A source-boundary test and final diff review prove that the implementation
does not modify or import from:

- `client-side/features/student/**`;
- `client-side/app/dashboard/**`; or
- `docs/requirements/store_students.md`.

## Manual UI sequence

The browser acceptance test follows this exact visible order:

1. Sign in as a store manager.
2. Open **Counter sale**.
3. Search for a variant and add it.
4. Add a second variant.
5. Change quantities.
6. mark physical items collected;
7. choose online;
8. submit checkout;
9. observe the frozen order summary and QR;
10. scan or open the handoff URL in a separate authenticated browser context;
11. verify the read-only order;
12. select **Pay securely**;
13. simulate a verified provider success;
14. observe paid/fulfilled status on both handoff and manager pages;
15. verify exactly one stock deduction per line;
16. open order history and the paid bill; and
17. repeat with cash, including exact cash and excess cash/change.

## Automated evidence traceability

| Scenario | Automated evidence |
|---|---|
| `SM-ORDER-001` | `tests/e2e/store-manager-checkout.spec.ts` (anonymous denial); `features/store-manager/counter-sale.test.tsx` |
| `SM-ORDER-002` | `features/orders/basket.test.ts`; `search_sellable_variants` in `docs/supabase/tests/store_orders_payments.test.sql` |
| `SM-ORDER-003`–`005` | `features/orders/basket.test.ts`; `features/store-manager/counter-sale.test.tsx` |
| `SM-ORDER-006` | `features/store-manager/counter-sale.test.tsx` |
| `SM-ORDER-007` | `validate_counter_basket` price/stock cases in `store_orders_payments.test.sql`; `features/orders/actions.test.ts` |
| `SM-ORDER-008`–`009` | `create_online_counter_order` reservation/immutability cases in `store_orders_payments.test.sql` |
| `SM-ORDER-010` | `features/payments/provider-contract.test.ts`; `features/payments/providers/dodo.test.ts` |
| `SM-ORDER-011` | `fail_provider_checkout_creation` / `record_provider_checkout_uncertain` cases in `store_orders_payments.test.sql`; `features/payments/actions.test.ts` |
| `SM-ORDER-012` | `features/store-manager/counter-sale.test.tsx`; `features/payments/handoff.test.ts` |
| `SM-ORDER-013` | `tests/e2e/store-manager-checkout.spec.ts` (safe return); `features/auth/return-path.test.ts` |
| `SM-ORDER-014`–`016` | `claim_payment_handoff` / `get_payment_redirect` cases in `store_orders_payments.test.sql`; `features/payments/payment-handoff.test.tsx` |
| `SM-ORDER-017` | `features/payments/payment-handoff.test.tsx` (return page is status-only) |
| `SM-ORDER-018`–`019` | `process_online_payment_event` cases in `store_orders_payments.test.sql`; `app/api/webhooks/dodo/route.test.ts` |
| `SM-ORDER-020` | `complete_cash_counter_sale` cases in `store_orders_payments.test.sql`; `features/orders/actions.test.ts` |
| `SM-ORDER-021` | `cancel_online_counter_order` cases in `store_orders_payments.test.sql` |
| `SM-ORDER-022`–`024` | `features/store-manager/order-history.test.tsx`; `features/orders/bill.test.tsx` |
| `SM-ORDER-025` | `features/payments/provider-contract.test.ts` run against fake and Dodo adapters |
| `SM-ORDER-026` | `features/store-manager/order-module-boundary.test.ts` |
