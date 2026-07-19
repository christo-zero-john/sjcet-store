begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- Schema surface: reservation and handoff records.
select has_type(
  'public',
  'stock_reservation_status',
  'reservations move through active, released, and consumed states'
);
select has_table(
  'public', 'stock_reservations',
  'online orders reserve available stock without changing physical stock'
);
select has_table(
  'private', 'payment_handoffs',
  'authenticated QR handoffs are stored privately'
);
select col_is_pk(
  'public', 'stock_reservations', array['order_id', 'variant_id'],
  'one reservation exists per order line'
);
select col_is_unique(
  'private', 'payment_handoffs', 'order_id',
  'each online order has one handoff'
);
select col_is_unique(
  'private', 'payment_handoffs', 'token_sha256',
  'stored handoff hashes are unique'
);

-- Order idempotency and expiry columns.
select has_column('public', 'orders', 'idempotency_key', 'orders record a submission key');
select has_column('public', 'orders', 'request_fingerprint', 'orders bind keys to inputs');
select has_column('public', 'orders', 'expires_at', 'online orders have a bounded deadline');

-- Payment-attempt idempotency and reconciliation columns.
select has_column('public', 'payment_attempts', 'idempotency_key', 'attempts record a submission key');
select has_column('public', 'payment_attempts', 'request_fingerprint', 'attempts bind keys to inputs');
select has_column(
  'public', 'payment_attempts', 'provider_checkout_expires_at',
  'attempts track provider checkout expiry'
);
select has_column(
  'public', 'payment_attempts', 'reconciliation_code',
  'ambiguous outcomes record a reconciliation code'
);
select has_column(
  'public', 'payment_attempts', 'reconciliation_message',
  'reconciliation includes a safe message'
);

-- Constraints reject invalid rows regardless of authorization.
select throws_ok(
  $$insert into public.stock_reservations
      (order_id, variant_id, quantity, status, expires_at)
    values (
      gen_random_uuid(), gen_random_uuid(), 0, 'active',
      now() + interval '30 minutes'
    )$$,
  '23514',
  null,
  'reservations must reserve a positive quantity'
);
select throws_ok(
  $$insert into private.payment_handoffs
      (order_id, token_sha256, expires_at)
    values (gen_random_uuid(), 'not-a-valid-sha-256-hash', now() + interval '30 minutes')$$,
  '23514',
  null,
  'handoff hashes must be 64 lowercase hex characters'
);

-- Supporting indexes.
select has_index(
  'public', 'stock_reservations', 'stock_reservations_active_variant_idx',
  'active reservations index available-stock lookups'
);
select has_index(
  'public', 'orders', 'orders_history_idx',
  'order history paginates on created_at and id'
);
select has_index(
  'public', 'payment_attempts', 'payment_attempts_history_idx',
  'payment history paginates on created_at and id'
);
select has_index(
  'public', 'payment_attempts', 'payment_attempts_reconciliation_idx',
  'reconciliation codes are indexed'
);

-- Row level security is enabled and forced.
select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity)
   from pg_class c
   where c.oid in ('public.stock_reservations'::regclass)),
  'stock reservations enable and force row level security'
);
select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity)
   from pg_class c
   where c.oid in ('private.payment_handoffs'::regclass)),
  'payment handoffs enable and force row level security'
);

-- Handoffs are never granted to authenticated or anonymous roles directly.
select ok(
  not has_table_privilege('authenticated', 'private.payment_handoffs', 'SELECT'),
  'authenticated users cannot read handoffs directly'
);
select ok(
  not has_table_privilege('anon', 'public.stock_reservations', 'SELECT'),
  'anonymous users cannot read reservations'
);

select * from finish();
rollback;
