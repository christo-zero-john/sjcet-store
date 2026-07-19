# Store Payments Runbook

## Purpose

This runbook covers the provider-neutral payment boundary and the initial Dodo
Payments adapter for store-manager counter sales. It does not authorize remote
changes. A human must explicitly approve Dodo dashboard, remote Supabase,
deployment, or production-data mutations.

## Ownership

- Orders own frozen lines, totals, state, and stock reservations.
- Inventory owns physical stock deduction and movements.
- Payments own attempts, provider adapters, QR handoffs, verified events, and
  reconciliation state.
- Store manager composes these contracts into counter-sale screens.
- Student and guest authentication are outside this module.

## Environment variables

Keep these server-side unless the name explicitly begins with `NEXT_PUBLIC_`:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DODO_PAYMENTS_API_KEY=
DODO_WEBHOOK_SECRET=
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_DYNAMIC_PRODUCT_ID=
PAYMENT_PROVIDER=dodo
PAYMENT_HANDOFF_TTL_MINUTES=30
```

Rules:

- Never commit values.
- Never introduce `NEXT_PUBLIC_DODO_*`.
- `NEXT_PUBLIC_SITE_URL` must be the canonical origin used in QR and return
  URLs.
- `PAYMENT_PROVIDER` selects a registered server adapter. Unknown values fail
  closed.
- The configured handoff TTL must match the bounded reservation policy.

## Initial Dodo test setup

These are dashboard preparation steps for an authorized human:

1. Select Dodo test mode.
2. Create one Single Payment product.
3. Enable Pay What You Want.
4. Set a minimum compatible with the smallest allowed store total.
5. Do not configure discounts or a subscription.
6. Copy its product ID into `DODO_DYNAMIC_PRODUCT_ID` in the local secret
   environment.
7. Create a webhook endpoint for
   `${NEXT_PUBLIC_SITE_URL}/api/webhooks/dodo`.
8. Subscribe to `payment.processing`, `payment.succeeded`, `payment.failed`,
   and `payment.cancelled`.
9. Store the webhook signing secret as `DODO_WEBHOOK_SECRET`.
10. Keep test and live credentials in separate deployment environments.

The adapter creates one item:

```ts
{
  product_id: DODO_DYNAMIC_PRODUCT_ID,
  quantity: 1,
  amount: frozenOrder.totalPaise,
}
```

The checkout metadata schema is:

```ts
{
  order_id: frozenOrder.id,
  order_number: String(frozenOrder.orderNumber),
  module: "store_counter_sale",
}
```

Official references:

- [Create a Dodo Checkout Session](https://docs.dodopayments.com/api-reference/checkout-sessions/create)
- [Configure Dodo dynamic pricing](https://docs.dodopayments.com/developer-resources/dynamic-pricing-checkout)
- [Verify Dodo webhooks](https://docs.dodopayments.com/developer-resources/webhooks)

## Local verification

From `client-side/`:

```powershell
pnpm schema:check
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

When local Supabase prerequisites are installed and Docker is available:

```powershell
npx supabase --workdir ../docs start
npx supabase --workdir ../docs db reset
npx supabase --workdir ../docs test db
npx supabase --workdir ../docs db lint
```

If a command is unavailable, record it as an unverified environmental gate.
Do not report a skipped database or browser gate as passing.

## Webhook processing checklist

For every received webhook:

1. Read the request body as text exactly once.
2. Pass the raw body and original headers to the configured provider adapter.
3. Reject signature failures before database mutation.
4. Normalize only supported payment events.
5. Require an event ID.
6. Hash the raw payload with SHA-256 for traceability.
7. Compare provider, checkout ID, payment ID, order metadata, amount, and
   currency with the frozen attempt.
8. Insert the provider event ID idempotently.
9. Deduct stock only inside the verified-success database transaction.
10. Return a successful duplicate response for an already processed event.

Never log the raw body, signature, secret, complete checkout URL, or customer
payment details.

## Reconciliation conditions

The payments page and operational logs must surface these stable conditions:

- `amount_mismatch`;
- `currency_mismatch`;
- `checkout_mismatch`;
- `order_metadata_mismatch`;
- `order_not_payable`;
- `reservation_expired`;
- `late_success`;
- `unknown_attempt`; and
- `provider_payload_invalid`.

No reconciliation condition silently marks an order paid. A late success may
mean money was collected after the reservation expired; keep the event and
identifiers for manual review. Refund automation is outside this MVP.

## Cancelling and expiring unpaid orders

- Only unpaid, non-terminal online orders can be cancelled.
- Cancellation revokes the handoff and releases active reservations.
- Expiration uses the same release semantics.
- Neither operation changes physical stock.
- Do not claim that an external checkout was cancelled unless the configured
  provider adapter supports and confirms that operation.
- A late provider event still goes through signature verification and
  reconciliation.

## Recovering checkout creation

- Use the internal payment-attempt ID as the provider idempotency key.
- Retry a timeout, connection loss, conflict, rate limit, or provider server
  error with the same attempt and idempotency key.
- Treat validation, authentication, permission, not-found, and unprocessable
  responses as definitive rejection.
- Do not release reservations after an ambiguous provider result.
- Do not expose a QR until the application stores the provider checkout ID and
  URL.
- If the manager loses an unclaimed QR token, rotate the handoff hash and show
  a new application URL. Never rotate a claimed or terminal handoff.

## Provider replacement procedure

To add Razorpay, Stripe, or another provider:

1. Implement `PaymentProvider` in
   `client-side/features/payments/providers/<provider>.ts`.
2. Map the neutral checkout request to the provider API.
3. Verify provider webhooks from the raw request.
4. Normalize supported events into `NormalizedPaymentEvent`.
5. Register the adapter in the server-only provider registry.
6. Add provider contract tests using the shared fixture suite.
7. Add environment validation and runbook setup.
8. Run the complete payment, webhook, inventory, order, QR, and browser gates.

Do not change the basket reducer, order RPC inputs, stock transaction, QR
payload, handoff UI, history pages, or bill renderer to add a provider.

## Test-to-live checklist

Before an explicitly authorized live rollout:

- all automated gates pass from fresh invocations;
- Dodo test success, failure, cancellation, duplicate, and mismatch cases have
  evidence;
- the live Pay-What-You-Want product is a one-time product;
- live URL and webhook endpoint use HTTPS;
- live API and webhook secrets are stored only in deployment secrets;
- webhook subscriptions are limited to required events;
- return and cancel URLs use the production origin;
- an operator can identify and investigate reconciliation rows;
- a low-value live transaction is approved and observed end to end; and
- rollback disables new online checkout without modifying historical orders.
