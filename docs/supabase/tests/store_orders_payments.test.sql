begin;

create extension if not exists pgtap with schema extensions;

select plan(58);

-- ---------------------------------------------------------------------------
-- Schema surface: reservation and handoff records.
-- ---------------------------------------------------------------------------
select has_type(
  'public', 'stock_reservation_status',
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
  'private', 'payment_handoffs', 'order_id', 'each online order has one handoff'
);
select col_is_unique(
  'private', 'payment_handoffs', 'token_sha256', 'stored handoff hashes are unique'
);
select has_column('public', 'orders', 'idempotency_key', 'orders record a submission key');
select has_column('public', 'orders', 'request_fingerprint', 'orders bind keys to inputs');
select has_column('public', 'orders', 'expires_at', 'online orders have a bounded deadline');
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
  'public', 'payment_attempts', 'reconciliation_message', 'reconciliation includes a safe message'
);
select throws_ok(
  $$insert into public.stock_reservations
      (order_id, variant_id, quantity, status, expires_at)
    values (gen_random_uuid(), gen_random_uuid(), 0, 'active', now() + interval '30 minutes')$$,
  '23514', null, 'reservations must reserve a positive quantity'
);
select throws_ok(
  $$insert into private.payment_handoffs
      (order_id, token_sha256, expires_at)
    values (gen_random_uuid(), 'not-a-valid-sha-256-hash', now() + interval '30 minutes')$$,
  '23514', null, 'handoff hashes must be 64 lowercase hex characters'
);
select has_index(
  'public', 'stock_reservations', 'stock_reservations_active_variant_idx',
  'active reservations index available-stock lookups'
);
select has_index(
  'public', 'orders', 'orders_history_idx', 'order history paginates on created_at and id'
);
select has_index(
  'public', 'payment_attempts', 'payment_attempts_history_idx',
  'payment history paginates on created_at and id'
);
select has_index(
  'public', 'payment_attempts', 'payment_attempts_reconciliation_idx',
  'reconciliation codes are indexed'
);
select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity)
   from pg_class c where c.oid in ('public.stock_reservations'::regclass)),
  'stock reservations enable and force row level security'
);
select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity)
   from pg_class c where c.oid in ('private.payment_handoffs'::regclass)),
  'payment handoffs enable and force row level security'
);
select ok(
  not has_table_privilege('authenticated', 'private.payment_handoffs', 'SELECT'),
  'authenticated users cannot read handoffs directly'
);
select ok(
  not has_table_privilege('anon', 'public.stock_reservations', 'SELECT'),
  'anonymous users cannot read reservations'
);

-- ---------------------------------------------------------------------------
-- Behavioral fixtures. Authorization is claim-based, so we set the JWT claim
-- rather than switching database roles (keeping pgTAP functions runnable).
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a1', 'mgr@cs.sjcetpalai.ac.in', now(), now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'stu@cs.sjcetpalai.ac.in', now(), now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'buyer@cs.sjcetpalai.ac.in', now(), now(), now(), 'authenticated', 'authenticated');
insert into private.user_roles (user_id, role)
values ('00000000-0000-0000-0000-0000000000a1', 'store_manager');
insert into public.product_categories (id, slug, name)
values ('00000000-0000-0000-0000-0000000000c1', 'pens', 'Pens');
insert into public.products (id, category_id, name, created_by)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Gel Pen', '00000000-0000-0000-0000-0000000000a1');
insert into public.product_variants (id, product_id, sku, attribute_signature, price_paise, current_stock, created_by)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'PEN-BLUE', 'blue', 1250, 10, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1', 'PEN-ARCH', 'arch', 1250, 5, '00000000-0000-0000-0000-0000000000a1');
update public.product_variants
set is_active = false, archived_at = now()
where id = '00000000-0000-0000-0000-0000000000e2';

-- Act as the manager for the rest of the flow.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- Online order of quantity 3 freezes a 3750 total.
select is(
  (public.create_online_counter_order(
    jsonb_build_array(jsonb_build_object('variantId', '00000000-0000-0000-0000-0000000000e1', 'quantity', 3, 'observedPricePaise', 1250)),
    '00000000-0000-0000-0000-000000000f01', 'fp-online-1', 'dodo', repeat('a', 64), 30
  ) -> 'order' ->> 'totalPaise'),
  '3750',
  'online order freezes the server-calculated total'
);
select is(
  (public.search_sellable_variants('PEN-BLUE', 30) -> 0 ->> 'availableStock'),
  '7',
  'an active reservation reduces available stock'
);
select is(
  (select current_stock from public.product_variants where id = '00000000-0000-0000-0000-0000000000e1'),
  10,
  'a reservation does not change physical stock'
);
select is(
  (select count(*)::int from public.stock_reservations sr
   join public.orders o on o.id = sr.order_id
   where o.idempotency_key = '00000000-0000-0000-0000-000000000f01' and sr.status = 'active'),
  1,
  'online creation inserts one active reservation per line'
);
select is(
  (select status::text from public.orders where idempotency_key = '00000000-0000-0000-0000-000000000f01'),
  'awaiting_payment',
  'a new online order awaits payment'
);
select is(
  (select count(*)::int from public.stock_movements sm
   join public.orders o on o.id = sm.order_id
   where o.idempotency_key = '00000000-0000-0000-0000-000000000f01'),
  0,
  'online creation writes no sale movement'
);

-- Validation failures.
select throws_ok(
  $$select public.create_online_counter_order('[]'::jsonb, gen_random_uuid(), 'f', 'dodo', repeat('b',64), 30)$$,
  '22023', null, 'an empty basket cannot become an order'
);
select throws_ok(
  $$select public.create_online_counter_order(
      jsonb_build_array(
        jsonb_build_object('variantId','00000000-0000-0000-0000-0000000000e1','quantity',1,'observedPricePaise',1250),
        jsonb_build_object('variantId','00000000-0000-0000-0000-0000000000e1','quantity',1,'observedPricePaise',1250)),
      gen_random_uuid(), 'f', 'dodo', repeat('b',64), 30)$$,
  '22023', null, 'a variant cannot appear twice'
);
select throws_ok(
  $$select public.create_online_counter_order(
      jsonb_build_array(jsonb_build_object('variantId', gen_random_uuid(), 'quantity',1,'observedPricePaise',1250)),
      gen_random_uuid(), 'f', 'dodo', repeat('b',64), 30)$$,
  '22023', null, 'a missing variant is rejected'
);
select throws_ok(
  $$select public.create_online_counter_order(
      jsonb_build_array(jsonb_build_object('variantId','00000000-0000-0000-0000-0000000000e2','quantity',1,'observedPricePaise',1250)),
      gen_random_uuid(), 'f', 'dodo', repeat('b',64), 30)$$,
  '22023', null, 'an archived variant cannot be reserved'
);
select throws_ok(
  $$select public.create_online_counter_order(
      jsonb_build_array(jsonb_build_object('variantId','00000000-0000-0000-0000-0000000000e1','quantity',1,'observedPricePaise',999)),
      gen_random_uuid(), 'f', 'dodo', repeat('b',64), 30)$$,
  '22023', null, 'a stale price is rejected'
);
select throws_ok(
  $$select public.create_online_counter_order(
      jsonb_build_array(jsonb_build_object('variantId','00000000-0000-0000-0000-0000000000e1','quantity',999,'observedPricePaise',1250)),
      gen_random_uuid(), 'f', 'dodo', repeat('b',64), 30)$$,
  '22023', null, 'insufficient available stock is rejected'
);

-- Authorization: a student and an anonymous caller are denied.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok(
  $$select public.complete_cash_counter_sale(
      jsonb_build_array(jsonb_build_object('variantId','00000000-0000-0000-0000-0000000000e1','quantity',1,'observedPricePaise',1250)),
      2000, gen_random_uuid(), 'f')$$,
  '42501', null, 'a student cannot complete a counter sale'
);
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$select public.search_sellable_variants('pen', 30)$$,
  '42501', null, 'an anonymous caller cannot search sellable variants'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- Cash completion deducts stock exactly once and returns exact change.
select is(
  (public.complete_cash_counter_sale(
    jsonb_build_array(jsonb_build_object('variantId','00000000-0000-0000-0000-0000000000e1','quantity',2,'observedPricePaise',1250)),
    3000, '00000000-0000-0000-0000-000000000f02', 'fp-cash-1'
  ) ->> 'changeDuePaise'),
  '500',
  'cash completion returns exact change'
);
select is(
  (select current_stock from public.product_variants where id = '00000000-0000-0000-0000-0000000000e1'),
  8,
  'cash completion deducts physical stock once'
);
select is(
  (select count(*)::int from public.stock_movements sm
   join public.orders o on o.id = sm.order_id
   where o.idempotency_key = '00000000-0000-0000-0000-000000000f02' and sm.movement_type = 'sale'),
  1,
  'cash completion writes exactly one sale movement'
);
select is(
  (select status::text from public.orders where idempotency_key = '00000000-0000-0000-0000-000000000f02'),
  'fulfilled',
  'a completed cash order is paid and fulfilled'
);

-- Idempotency: same key and fingerprint returns the same order.
create temp table t_repeat(label text, order_id uuid);
insert into t_repeat
select 'first', (public.create_online_counter_order(
  jsonb_build_array(jsonb_build_object('variantId','00000000-0000-0000-0000-0000000000e1','quantity',1,'observedPricePaise',1250)),
  '00000000-0000-0000-0000-000000000f03', 'fp-online-3', 'dodo', repeat('c',64), 30
) -> 'order' ->> 'id')::uuid;
insert into t_repeat
select 'second', (public.create_online_counter_order(
  jsonb_build_array(jsonb_build_object('variantId','00000000-0000-0000-0000-0000000000e1','quantity',1,'observedPricePaise',1250)),
  '00000000-0000-0000-0000-000000000f03', 'fp-online-3', 'dodo', repeat('d',64), 30
) -> 'order' ->> 'id')::uuid;
select is(
  (select count(distinct order_id)::int from t_repeat),
  1,
  'a repeated idempotent submission returns the same order'
);
select throws_ok(
  $$select public.create_online_counter_order(
      jsonb_build_array(jsonb_build_object('variantId','00000000-0000-0000-0000-0000000000e1','quantity',1,'observedPricePaise',1250)),
      '00000000-0000-0000-0000-000000000f03', 'fp-online-different', 'dodo', repeat('e',64), 30)$$,
  '23505', null, 'reusing a key with a different basket raises a conflict'
);

-- Cancellation releases reservations without changing physical stock.
select public.cancel_online_counter_order(
  (select id from public.orders where idempotency_key = '00000000-0000-0000-0000-000000000f01')
);
select is(
  (select count(*)::int from public.stock_reservations sr
   join public.orders o on o.id = sr.order_id
   where o.idempotency_key = '00000000-0000-0000-0000-000000000f01' and sr.status = 'released'),
  1,
  'cancellation releases the active reservation'
);
select is(
  (select current_stock from public.product_variants where id = '00000000-0000-0000-0000-0000000000e1'),
  8,
  'cancellation does not change physical stock'
);
select is(
  (select status::text from public.orders where idempotency_key = '00000000-0000-0000-0000-000000000f01'),
  'cancelled',
  'a cancelled order is terminal'
);

-- ---------------------------------------------------------------------------
-- Task 8: authenticated QR claim, read-only handoff, redirect, return status.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
create temp table t_handoff(order_id uuid, attempt_id uuid);
insert into t_handoff
select
  (created -> 'order' ->> 'id')::uuid,
  (created ->> 'paymentAttemptId')::uuid
from (
  select public.create_online_counter_order(
    jsonb_build_array(jsonb_build_object('variantId','00000000-0000-0000-0000-0000000000e1','quantity',1,'observedPricePaise',1250)),
    '00000000-0000-0000-0000-000000000f04', 'fp-online-4', 'dodo', repeat('f', 64), 30
  ) as created
) s;
-- Manager attaches a usable provider checkout.
select public.attach_provider_checkout(
  (select order_id from t_handoff), (select attempt_id from t_handoff),
  'dodo', 'sess_task8', 'https://checkout.dodopayments.com/sess_task8', null
);

-- Anonymous and unknown-token claims reveal nothing.
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$select public.claim_payment_handoff(repeat('f', 64))$$,
  '42501', null, 'an anonymous visitor cannot claim a handoff'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select throws_ok(
  $$select public.claim_payment_handoff(repeat('9', 64))$$,
  'P0002', null, 'an unknown token reveals no order'
);

-- First authenticated claim returns a frozen projection.
select is(
  jsonb_array_length(public.claim_payment_handoff(repeat('f', 64)) -> 'lines'),
  1,
  'the first claim returns the frozen order lines'
);
select is(
  (select student_id from public.orders where id = (select order_id from t_handoff)),
  '00000000-0000-0000-0000-0000000000a3'::uuid,
  'claiming sets the order student to the claimant'
);
select lives_ok(
  $$select public.get_payment_handoff(repeat('f', 64))$$,
  'the same claimant can reopen the handoff'
);
select ok(
  not (public.get_payment_handoff(repeat('f', 64)) ? 'id')
    and not (public.get_payment_handoff(repeat('f', 64)) ? 'token_sha256')
    and not (public.get_payment_handoff(repeat('f', 64)) ? 'checkoutUrl'),
  'the claimant projection hides ids, tokens, and checkout urls'
);

-- Redirect and status are available to the claimant.
select is(
  (public.get_payment_redirect(repeat('f', 64)) ->> 'checkoutUrl'),
  'https://checkout.dodopayments.com/sess_task8',
  'the claimant resolves the server-stored checkout url'
);
select is(
  (public.get_payment_return_status((select attempt_id from t_handoff)) ->> 'paymentState'),
  'pending',
  'the claimant reads the current payment state'
);

-- A different authenticated user is denied everywhere.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok(
  $$select public.get_payment_handoff(repeat('f', 64))$$,
  'P0002', null, 'a different user cannot read a claimed handoff'
);
select throws_ok(
  $$select public.get_payment_redirect(repeat('f', 64))$$,
  'P0002', null, 'a different user cannot resolve the checkout url'
);
select throws_ok(
  format($$select public.get_payment_return_status(%L)$$, (select attempt_id from t_handoff)),
  'P0002', null, 'a different user cannot read the return status'
);

select * from finish();
rollback;
