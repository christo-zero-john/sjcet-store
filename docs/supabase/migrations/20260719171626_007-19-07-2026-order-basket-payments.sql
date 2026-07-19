-- Order basket, reservation, handoff, idempotency, and payment-event schema.
-- Canonical declarations live in docs/supabase/main_schema.sql; this migration
-- is the append-only deployment history that reaches the same final schema.

begin;

-- Reservation lifecycle.
create type public.stock_reservation_status as enum (
  'active',
  'released',
  'consumed'
);

-- Order idempotency and bounded online expiry.
alter table public.orders
  add column idempotency_key uuid,
  add column request_fingerprint text,
  add column expires_at timestamptz;

alter table public.orders
  add constraint orders_request_fingerprint_present check (
    idempotency_key is null or request_fingerprint is not null
  );

create unique index orders_created_by_idempotency_unique
  on public.orders (created_by, idempotency_key)
  where idempotency_key is not null;

create index orders_history_idx
  on public.orders (created_at desc, id desc);

create index orders_payment_method_status_idx
  on public.orders (payment_method, status);

create index orders_expires_at_idx
  on public.orders (expires_at)
  where expires_at is not null;

-- Payment-attempt idempotency, provider expiry, and reconciliation.
alter table public.payment_attempts
  add column idempotency_key uuid,
  add column request_fingerprint text,
  add column provider_checkout_expires_at timestamptz,
  add column reconciliation_code text,
  add column reconciliation_message text;

alter table public.payment_attempts
  add constraint payment_attempts_reconciliation_code_not_blank check (
    reconciliation_code is null or btrim(reconciliation_code) <> ''
  );

create unique index payment_attempts_order_idempotency_unique
  on public.payment_attempts (order_id, idempotency_key)
  where idempotency_key is not null;

create index payment_attempts_history_idx
  on public.payment_attempts (created_at desc, id desc);

create index payment_attempts_status_provider_idx
  on public.payment_attempts (status, provider);

create index payment_attempts_reconciliation_idx
  on public.payment_attempts (reconciliation_code)
  where reconciliation_code is not null;

-- Bounded online-order reservations. Reservations reduce available stock only.
create table public.stock_reservations (
  order_id uuid not null references public.orders (id) on delete restrict,
  variant_id uuid not null
    references public.product_variants (id) on delete restrict,
  quantity integer not null,
  status public.stock_reservation_status not null default 'active',
  expires_at timestamptz not null,
  released_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (order_id, variant_id),
  constraint stock_reservations_quantity_positive check (quantity > 0),
  constraint stock_reservations_status_timestamps check (
    (status = 'active' and released_at is null and consumed_at is null)
    or (status = 'released' and released_at is not null and consumed_at is null)
    or (status = 'consumed' and consumed_at is not null and released_at is null)
  )
);

create index stock_reservations_active_variant_idx
  on public.stock_reservations (variant_id, expires_at)
  where status = 'active';

create index stock_reservations_variant_idx
  on public.stock_reservations (variant_id);

-- Private authenticated QR handoffs. Only a token hash is stored.
create table private.payment_handoffs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique
    references public.orders (id) on delete restrict,
  token_sha256 text not null unique,
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_handoffs_hash_format
    check (token_sha256 ~ '^[a-f0-9]{64}$'),
  constraint payment_handoffs_claim_consistent check (
    (claimed_by is null and claimed_at is null)
    or (claimed_by is not null and claimed_at is not null)
  )
);

create index payment_handoffs_expires_at_idx
  on private.payment_handoffs (expires_at);

create trigger stock_reservations_set_updated_at
before update on public.stock_reservations
for each row
execute function private.set_updated_at();

create trigger payment_handoffs_set_updated_at
before update on private.payment_handoffs
for each row
execute function private.set_updated_at();

alter table public.stock_reservations enable row level security;
alter table public.stock_reservations force row level security;

alter table private.payment_handoffs enable row level security;
alter table private.payment_handoffs force row level security;

create policy stock_reservations_select
on public.stock_reservations
for select
to authenticated
using ((select private.is_store_operator()));

-- Authenticated claimants read payment status only through purpose-built
-- handoff functions; direct attempt reads become store-operator-only.
drop policy if exists payment_attempts_select on public.payment_attempts;
create policy payment_attempts_select
on public.payment_attempts
for select
to authenticated
using ((select private.is_store_operator()));

revoke all on public.stock_reservations from public, anon, authenticated;
grant select on public.stock_reservations to authenticated;

-- Task 4: transactional order, inventory, and payment-attempt functions.
create function private.variant_description(target_variant_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    string_agg(av.value, ' / ' order by at.name, av.value),
    ''
  )
  from public.variant_attribute_values vav
  join public.attribute_values av
    on av.id = vav.attribute_value_id
  join public.attribute_types at
    on at.id = vav.attribute_type_id
  where vav.variant_id = target_variant_id;
$$;

create function private.frozen_order_json(target_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'status', o.status,
    'paymentMethod', o.payment_method,
    'currency', o.currency,
    'subtotalPaise', o.subtotal_paise,
    'totalPaise', o.total_paise,
    'expiresAt', o.expires_at,
    'lines', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'variantId', l.variant_id,
            'productName', l.product_name,
            'sku', l.product_sku,
            'variantDescription', l.variant_description,
            'unitPricePaise', l.unit_price_paise,
            'quantity', l.quantity,
            'lineTotalPaise', l.line_total_paise
          )
          order by l.product_name, l.id
        ),
        '[]'::jsonb
      )
      from public.order_lines l
      where l.order_id = o.id
    )
  )
  from public.orders o
  where o.id = target_order_id;
$$;

create function private.validate_counter_basket(
  items jsonb,
  retry_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_count integer;
  distinct_count integer;
  resolved jsonb;
  subtotal bigint;
begin
  if jsonb_typeof(items) is distinct from 'array'
    or jsonb_array_length(items) = 0 then
    raise exception using errcode = '22023',
      message = 'EMPTY_BASKET: Add at least one product before checkout.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(items) as it
    where jsonb_typeof(it) <> 'object'
      or nullif(btrim(it->>'variantId'), '') is null
      or (it->>'variantId') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(it->'quantity') <> 'number'
      or (it->>'quantity')::numeric <> trunc((it->>'quantity')::numeric)
      or (it->>'quantity')::numeric < 1
      or (it->>'quantity')::numeric > 1000
      or jsonb_typeof(it->'observedPricePaise') <> 'number'
      or (it->>'observedPricePaise')::numeric
        <> trunc((it->>'observedPricePaise')::numeric)
      or (it->>'observedPricePaise')::numeric < 0
  ) then
    raise exception using errcode = '22023',
      message = 'INVALID_QUANTITY: Each line needs a valid variant, whole quantity, and observed price.';
  end if;

  select count(*), count(distinct (it->>'variantId'))
  into item_count, distinct_count
  from jsonb_array_elements(items) as it;

  if item_count <> distinct_count then
    raise exception using errcode = '22023',
      message = 'INVALID_QUANTITY: A variant cannot appear more than once.';
  end if;

  -- Lock the requested variants in a stable order to serialize checkouts.
  perform 1
  from public.product_variants
  where id in (
    select (it->>'variantId')::uuid
    from jsonb_array_elements(items) as it
  )
  order by id
  for update;

  with requested as (
    select
      (it->>'variantId')::uuid as variant_id,
      (it->>'quantity')::integer as quantity,
      (it->>'observedPricePaise')::bigint as observed_price
    from jsonb_array_elements(items) as it
  ),
  reserved as (
    select sr.variant_id, sum(sr.quantity)::bigint as reserved_quantity
    from public.stock_reservations sr
    where sr.status = 'active'
      and sr.expires_at > now()
      and (retry_order_id is null or sr.order_id <> retry_order_id)
      and sr.variant_id in (select variant_id from requested)
    group by sr.variant_id
  ),
  resolved_rows as (
    select
      r.variant_id,
      r.quantity,
      r.observed_price,
      v.id as found_variant,
      v.is_active as variant_active,
      v.price_paise,
      v.current_stock,
      v.product_id,
      v.sku,
      p.name as product_name,
      p.is_active as product_active,
      coalesce(res.reserved_quantity, 0) as reserved_quantity,
      v.current_stock - coalesce(res.reserved_quantity, 0) as available_stock
    from requested r
    left join public.product_variants v on v.id = r.variant_id
    left join public.products p on p.id = v.product_id
    left join reserved res on res.variant_id = r.variant_id
  )
  select
    coalesce(sum(rr.observed_price * rr.quantity), 0),
    jsonb_agg(
      jsonb_build_object(
        'variant_id', rr.variant_id,
        'product_id', rr.product_id,
        'product_name', rr.product_name,
        'sku', rr.sku,
        'variant_description', private.variant_description(rr.variant_id),
        'unit_price_paise', rr.price_paise,
        'quantity', rr.quantity,
        'line_total_paise', rr.price_paise * rr.quantity,
        'available_stock', rr.available_stock
      )
      order by rr.variant_id
    )
  into subtotal, resolved
  from resolved_rows rr;

  if exists (
    select 1
    from jsonb_array_elements(items) as it
    left join public.product_variants v on v.id = (it->>'variantId')::uuid
    left join public.products p on p.id = v.product_id
    where v.id is null or not v.is_active or p.id is null or not p.is_active
  ) then
    raise exception using errcode = '22023',
      message = 'VARIANT_UNAVAILABLE: A requested product is no longer available.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(items) as it
    join public.product_variants v on v.id = (it->>'variantId')::uuid
    where v.price_paise <> (it->>'observedPricePaise')::bigint
  ) then
    raise exception using errcode = '22023',
      message = 'PRICE_CHANGED: A product price changed. Review the basket and try again.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(resolved) as line
    where (line->>'quantity')::integer > (line->>'available_stock')::bigint
  ) then
    raise exception using errcode = '22023',
      message = 'INSUFFICIENT_STOCK: Not enough stock is available for a requested product.';
  end if;

  return jsonb_build_object('subtotal_paise', subtotal, 'lines', resolved);
end;
$$;

create function private.deduct_variant_sale(
  target_variant_id uuid,
  sale_quantity integer,
  target_order_id uuid,
  actor uuid,
  movement_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stock_before integer;
  stock_after integer;
begin
  select current_stock
  into stock_before
  from public.product_variants
  where id = target_variant_id
  for update;

  if not found then
    raise exception using errcode = '22023',
      message = 'VARIANT_UNAVAILABLE: A requested product is no longer available.';
  end if;

  stock_after := stock_before - sale_quantity;

  if stock_after < 0 then
    raise exception using errcode = '22023',
      message = 'INSUFFICIENT_STOCK: Not enough stock is available for a requested product.';
  end if;

  update public.product_variants
  set current_stock = stock_after
  where id = target_variant_id;

  insert into public.stock_movements (
    variant_id, order_id, movement_type,
    quantity_before, quantity_delta, quantity_after,
    reason, actor_id
  ) values (
    target_variant_id, target_order_id, 'sale',
    stock_before, -sale_quantity, stock_after,
    movement_reason, actor
  );
end;
$$;

create function public.search_sellable_variants(
  search_query text,
  result_limit integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  normalized text := nullif(btrim(search_query), '');
  bounded_limit integer := least(greatest(coalesce(result_limit, 20), 1), 30);
  pattern text;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'UNAUTHORIZED: Store-manager access is required.';
  end if;

  pattern := case
    when normalized is null then null
    else '%' || normalized || '%'
  end;

  return (
    select coalesce(
      jsonb_agg(row_to_json(matched) order by matched.product_name, matched.sku),
      '[]'::jsonb
    )
    from (
      select
        v.id as "variantId",
        p.name as "productName",
        p.name as product_name,
        v.sku,
        v.barcode,
        private.variant_description(v.id) as "variantDescription",
        v.price_paise as "unitPricePaise",
        v.current_stock as "physicalStock",
        coalesce((
          select sum(sr.quantity)::integer
          from public.stock_reservations sr
          where sr.variant_id = v.id
            and sr.status = 'active'
            and sr.expires_at > now()
        ), 0) as "reservedStock",
        v.current_stock - coalesce((
          select sum(sr.quantity)::integer
          from public.stock_reservations sr
          where sr.variant_id = v.id
            and sr.status = 'active'
            and sr.expires_at > now()
        ), 0) as "availableStock"
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.is_active
        and p.is_active
        and (
          pattern is null
          or p.name ilike pattern
          or v.sku ilike pattern
          or coalesce(v.barcode, '') ilike pattern
          or private.variant_description(v.id) ilike pattern
        )
      order by p.name, v.sku
      limit bounded_limit
    ) matched
  );
end;
$$;

create function public.create_online_counter_order(
  items jsonb,
  operation_id uuid,
  request_fingerprint text,
  provider_name text,
  handoff_token_sha256 text,
  reservation_ttl_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  ttl integer := least(greatest(coalesce(reservation_ttl_minutes, 30), 5), 120);
  validated jsonb;
  total bigint;
  new_order_id uuid;
  attempt_id uuid;
  expires timestamptz;
  existing record;
  line jsonb;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'UNAUTHORIZED: Store-manager access is required.';
  end if;

  if nullif(btrim(provider_name), '') is null then
    raise exception using errcode = '22023',
      message = 'CHECKOUT_CREATE_FAILED: A payment provider is required.';
  end if;

  if handoff_token_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023',
      message = 'CHECKOUT_CREATE_FAILED: An invalid handoff token was supplied.';
  end if;

  if operation_id is not null then
    select o.id, o.request_fingerprint into existing
    from public.orders o
    where o.created_by = actor and o.idempotency_key = operation_id;

    if found then
      if existing.request_fingerprint is distinct from request_fingerprint then
        raise exception using errcode = '23505',
          message = 'IDEMPOTENCY_CONFLICT: This submission key was already used for a different basket.';
      end if;

      select pa.id, o.expires_at into attempt_id, expires
      from public.orders o
      join public.payment_attempts pa
        on pa.order_id = o.id and pa.method = 'online'
      where o.id = existing.id
      order by pa.created_at
      limit 1;

      return jsonb_build_object(
        'order', private.frozen_order_json(existing.id),
        'paymentAttemptId', attempt_id,
        'expiresAt', expires
      );
    end if;
  end if;

  validated := private.validate_counter_basket(items, null);
  total := (validated->>'subtotal_paise')::bigint;
  expires := now() + make_interval(mins => ttl);

  insert into public.orders (
    created_by, status, payment_method, subtotal_paise, total_paise,
    idempotency_key, request_fingerprint, expires_at
  ) values (
    actor, 'awaiting_payment', 'online', total, total,
    operation_id, request_fingerprint, expires
  )
  returning id into new_order_id;

  for line in select * from jsonb_array_elements(validated->'lines')
  loop
    insert into public.order_lines (
      order_id, product_id, variant_id, product_name, product_sku,
      variant_description, unit_price_paise, quantity, line_total_paise
    ) values (
      new_order_id,
      (line->>'product_id')::uuid,
      (line->>'variant_id')::uuid,
      line->>'product_name',
      line->>'sku',
      line->>'variant_description',
      (line->>'unit_price_paise')::bigint,
      (line->>'quantity')::integer,
      (line->>'line_total_paise')::bigint
    );

    insert into public.stock_reservations (
      order_id, variant_id, quantity, status, expires_at
    ) values (
      new_order_id, (line->>'variant_id')::uuid,
      (line->>'quantity')::integer, 'active', expires
    );
  end loop;

  insert into public.payment_attempts (
    order_id, method, status, provider, amount_paise,
    idempotency_key, request_fingerprint
  ) values (
    new_order_id, 'online', 'pending', provider_name, total,
    operation_id, request_fingerprint
  )
  returning id into attempt_id;

  insert into private.payment_handoffs (order_id, token_sha256, expires_at)
  values (new_order_id, handoff_token_sha256, expires);

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values
    (actor, 'order.created', 'order', new_order_id,
      jsonb_build_object('payment_method', 'online', 'total_paise', total)),
    (actor, 'payment.attempt_created', 'payment_attempt', attempt_id,
      jsonb_build_object('order_id', new_order_id, 'provider', provider_name)),
    (actor, 'order.reservations_created', 'order', new_order_id,
      jsonb_build_object('expires_at', expires));

  return jsonb_build_object(
    'order', private.frozen_order_json(new_order_id),
    'paymentAttemptId', attempt_id,
    'expiresAt', expires
  );
end;
$$;

create function public.complete_cash_counter_sale(
  items jsonb,
  cash_received_paise bigint,
  operation_id uuid,
  request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  validated jsonb;
  total bigint;
  change_due bigint;
  new_order_id uuid;
  attempt_id uuid;
  existing record;
  line jsonb;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'UNAUTHORIZED: Store-manager access is required.';
  end if;

  if cash_received_paise is null or cash_received_paise < 0 then
    raise exception using errcode = '22023',
      message = 'INVALID_QUANTITY: Cash received must be a whole non-negative amount.';
  end if;

  if operation_id is not null then
    select o.id, o.request_fingerprint into existing
    from public.orders o
    where o.created_by = actor and o.idempotency_key = operation_id;

    if found then
      if existing.request_fingerprint is distinct from request_fingerprint then
        raise exception using errcode = '23505',
          message = 'IDEMPOTENCY_CONFLICT: This submission key was already used for a different basket.';
      end if;

      select pa.cash_received_paise, pa.change_due_paise
      into cash_received_paise, change_due
      from public.payment_attempts pa
      where pa.order_id = existing.id and pa.method = 'cash'
      order by pa.created_at
      limit 1;

      return jsonb_build_object(
        'order', private.frozen_order_json(existing.id),
        'cashReceivedPaise', cash_received_paise,
        'changeDuePaise', change_due
      );
    end if;
  end if;

  validated := private.validate_counter_basket(items, null);
  total := (validated->>'subtotal_paise')::bigint;

  if cash_received_paise < total then
    raise exception using errcode = '22023',
      message = 'INVALID_QUANTITY: Cash received must be at least the order total.';
  end if;

  change_due := cash_received_paise - total;

  insert into public.orders (
    created_by, status, payment_method, subtotal_paise, total_paise,
    idempotency_key, request_fingerprint, paid_at
  ) values (
    actor, 'paid', 'cash', total, total,
    operation_id, request_fingerprint, now()
  )
  returning id into new_order_id;

  for line in select * from jsonb_array_elements(validated->'lines')
  loop
    insert into public.order_lines (
      order_id, product_id, variant_id, product_name, product_sku,
      variant_description, unit_price_paise, quantity, line_total_paise
    ) values (
      new_order_id,
      (line->>'product_id')::uuid,
      (line->>'variant_id')::uuid,
      line->>'product_name',
      line->>'sku',
      line->>'variant_description',
      (line->>'unit_price_paise')::bigint,
      (line->>'quantity')::integer,
      (line->>'line_total_paise')::bigint
    );

    perform private.deduct_variant_sale(
      (line->>'variant_id')::uuid,
      (line->>'quantity')::integer,
      new_order_id,
      actor,
      'Counter cash sale'
    );
  end loop;

  update public.orders
  set status = 'fulfilled', fulfilled_at = now()
  where id = new_order_id;

  insert into public.payment_attempts (
    order_id, method, status, amount_paise,
    cash_received_paise, change_due_paise, succeeded_at,
    idempotency_key, request_fingerprint
  ) values (
    new_order_id, 'cash', 'succeeded', total,
    cash_received_paise, change_due, now(),
    operation_id, request_fingerprint
  )
  returning id into attempt_id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values
    (actor, 'order.created', 'order', new_order_id,
      jsonb_build_object('payment_method', 'cash', 'total_paise', total)),
    (actor, 'order.paid', 'order', new_order_id,
      jsonb_build_object('payment_attempt_id', attempt_id)),
    (actor, 'order.fulfilled', 'order', new_order_id, '{}'::jsonb),
    (actor, 'payment.succeeded', 'payment_attempt', attempt_id,
      jsonb_build_object('method', 'cash', 'amount_paise', total));

  return jsonb_build_object(
    'order', private.frozen_order_json(new_order_id),
    'cashReceivedPaise', cash_received_paise,
    'changeDuePaise', change_due
  );
end;
$$;

create function public.attach_provider_checkout(
  target_order_id uuid,
  target_attempt_id uuid,
  provider_name text,
  provider_checkout_id text,
  provider_checkout_url text,
  checkout_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  current_attempt record;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'UNAUTHORIZED: Store-manager access is required.';
  end if;

  select id, status, provider_checkout_id
  into current_attempt
  from public.payment_attempts
  where id = target_attempt_id and order_id = target_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'ORDER_NOT_PAYABLE: The payment attempt was not found.';
  end if;

  if current_attempt.provider_checkout_id is not null then
    if current_attempt.provider_checkout_id = provider_checkout_id then
      return jsonb_build_object('order', private.frozen_order_json(target_order_id));
    end if;
    raise exception using errcode = '23505',
      message = 'CHECKOUT_CREATE_FAILED: A different checkout is already attached.';
  end if;

  if current_attempt.status <> 'pending' then
    raise exception using errcode = '22023',
      message = 'ORDER_NOT_PAYABLE: The payment attempt is no longer pending.';
  end if;

  update public.payment_attempts
  set provider = provider_name,
      provider_checkout_id = provider_checkout_id,
      checkout_url = provider_checkout_url,
      provider_checkout_expires_at = checkout_expires_at,
      reconciliation_code = null,
      reconciliation_message = null
  where id = target_attempt_id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'payment.checkout_attached', 'payment_attempt', target_attempt_id,
    jsonb_build_object('order_id', target_order_id, 'provider', provider_name));

  return jsonb_build_object('order', private.frozen_order_json(target_order_id));
end;
$$;

create function public.fail_provider_checkout_creation(
  target_order_id uuid,
  target_attempt_id uuid,
  failure_code text,
  failure_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  updated_count integer := 0;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'UNAUTHORIZED: Store-manager access is required.';
  end if;

  update public.payment_attempts
  set status = 'failed',
      failure_code = coalesce(nullif(btrim(failure_code), ''), 'checkout_create_failed'),
      failure_message = failure_message
  where id = target_attempt_id
    and order_id = target_order_id
    and status = 'pending';

  get diagnostics updated_count = row_count;

  if updated_count = 0 then
    return;
  end if;

  update public.stock_reservations
  set status = 'released', released_at = now()
  where order_id = target_order_id and status = 'active';

  update private.payment_handoffs
  set revoked_at = now()
  where order_id = target_order_id and revoked_at is null;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'payment.checkout_failed', 'payment_attempt', target_attempt_id,
    jsonb_build_object('order_id', target_order_id, 'failure_code', failure_code));
end;
$$;

create function public.record_provider_checkout_uncertain(
  target_order_id uuid,
  target_attempt_id uuid,
  reconciliation_code text,
  reconciliation_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'UNAUTHORIZED: Store-manager access is required.';
  end if;

  update public.payment_attempts
  set reconciliation_code = coalesce(nullif(btrim(reconciliation_code), ''), 'checkout_uncertain'),
      reconciliation_message = reconciliation_message
  where id = target_attempt_id
    and order_id = target_order_id
    and status = 'pending';

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'payment.checkout_uncertain', 'payment_attempt', target_attempt_id,
    jsonb_build_object('order_id', target_order_id, 'reconciliation_code', reconciliation_code));
end;
$$;

create function public.cancel_online_counter_order(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  order_row record;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'UNAUTHORIZED: Store-manager access is required.';
  end if;

  select id, status, payment_method
  into order_row
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'ORDER_NOT_PAYABLE: The order was not found.';
  end if;

  if order_row.payment_method <> 'online' then
    raise exception using errcode = '22023',
      message = 'ORDER_NOT_PAYABLE: Only online orders can be cancelled.';
  end if;

  if order_row.status in ('cancelled', 'voided') then
    return;
  end if;

  if order_row.status <> 'awaiting_payment' then
    raise exception using errcode = '22023',
      message = 'ORDER_NOT_PAYABLE: Only an unpaid online order can be cancelled.';
  end if;

  update public.orders
  set status = 'cancelled', cancelled_at = now()
  where id = target_order_id;

  update public.payment_attempts
  set status = 'cancelled'
  where order_id = target_order_id and status in ('pending', 'processing');

  update public.stock_reservations
  set status = 'released', released_at = now()
  where order_id = target_order_id and status = 'active';

  update private.payment_handoffs
  set revoked_at = now()
  where order_id = target_order_id and revoked_at is null;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'order.cancelled', 'order', target_order_id, '{}'::jsonb);
end;
$$;

create function public.restart_online_payment(
  target_order_id uuid,
  operation_id uuid,
  request_fingerprint text,
  provider_name text,
  handoff_token_sha256 text,
  reservation_ttl_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  ttl integer := least(greatest(coalesce(reservation_ttl_minutes, 30), 5), 120);
  order_row record;
  items jsonb;
  new_expires timestamptz;
  attempt_id uuid;
  rotated_count integer := 0;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'UNAUTHORIZED: Store-manager access is required.';
  end if;

  if handoff_token_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023',
      message = 'CHECKOUT_CREATE_FAILED: An invalid handoff token was supplied.';
  end if;

  select id, status, payment_method, total_paise
  into order_row
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'ORDER_NOT_PAYABLE: The order was not found.';
  end if;

  if order_row.payment_method <> 'online' or order_row.status <> 'awaiting_payment' then
    raise exception using errcode = '22023',
      message = 'ORDER_NOT_PAYABLE: Only an unpaid online order can be retried.';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'variantId', variant_id,
      'quantity', quantity,
      'observedPricePaise', unit_price_paise
    )
  )
  into items
  from public.order_lines
  where order_id = target_order_id;

  perform private.validate_counter_basket(items, target_order_id);

  new_expires := now() + make_interval(mins => ttl);

  update public.stock_reservations
  set status = 'active', expires_at = new_expires,
      released_at = null, consumed_at = null
  where order_id = target_order_id;

  update public.orders
  set expires_at = new_expires
  where id = target_order_id;

  update public.payment_attempts
  set status = 'cancelled'
  where order_id = target_order_id and method = 'online'
    and status in ('pending', 'processing');

  insert into public.payment_attempts (
    order_id, method, status, provider, amount_paise,
    idempotency_key, request_fingerprint
  ) values (
    target_order_id, 'online', 'pending', provider_name, order_row.total_paise,
    operation_id, request_fingerprint
  )
  returning id into attempt_id;

  update private.payment_handoffs
  set token_sha256 = handoff_token_sha256,
      expires_at = new_expires,
      revoked_at = null
  where order_id = target_order_id and claimed_by is null;

  get diagnostics rotated_count = row_count;

  if rotated_count = 0 then
    raise exception using errcode = '22023',
      message = 'HANDOFF_CLAIMED: A claimed handoff cannot be reissued.';
  end if;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'payment.restarted', 'order', target_order_id,
    jsonb_build_object('payment_attempt_id', attempt_id, 'expires_at', new_expires));

  return jsonb_build_object(
    'order', private.frozen_order_json(target_order_id),
    'paymentAttemptId', attempt_id,
    'expiresAt', new_expires
  );
end;
$$;

create function public.rotate_payment_handoff(
  target_order_id uuid,
  handoff_token_sha256 text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  rotated_count integer := 0;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'UNAUTHORIZED: Store-manager access is required.';
  end if;

  if handoff_token_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023',
      message = 'HANDOFF_INVALID: An invalid handoff token was supplied.';
  end if;

  if not exists (
    select 1 from public.orders
    where id = target_order_id
      and payment_method = 'online'
      and status = 'awaiting_payment'
  ) then
    raise exception using errcode = '22023',
      message = 'ORDER_NOT_PAYABLE: Only an unpaid online order handoff can be rotated.';
  end if;

  if not exists (
    select 1 from public.payment_attempts
    where order_id = target_order_id
      and status = 'pending'
      and provider_checkout_id is not null
  ) then
    raise exception using errcode = '22023',
      message = 'ORDER_NOT_PAYABLE: No usable checkout is attached to rotate.';
  end if;

  update private.payment_handoffs
  set token_sha256 = handoff_token_sha256
  where order_id = target_order_id
    and claimed_by is null
    and revoked_at is null
    and expires_at > now();

  get diagnostics rotated_count = row_count;

  if rotated_count = 0 then
    raise exception using errcode = '22023',
      message = 'HANDOFF_CLAIMED: A claimed or expired handoff cannot be rotated.';
  end if;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'payment.handoff_rotated', 'order', target_order_id, '{}'::jsonb);
end;
$$;


grant execute on function public.search_sellable_variants(text, integer)
  to authenticated, service_role;
grant execute on function public.create_online_counter_order(
  jsonb, uuid, text, text, text, integer
) to authenticated, service_role;
grant execute on function public.complete_cash_counter_sale(
  jsonb, bigint, uuid, text
) to authenticated, service_role;
grant execute on function public.attach_provider_checkout(
  uuid, uuid, text, text, text, timestamptz
) to authenticated, service_role;
grant execute on function public.fail_provider_checkout_creation(
  uuid, uuid, text, text
) to authenticated, service_role;
grant execute on function public.record_provider_checkout_uncertain(
  uuid, uuid, text, text
) to authenticated, service_role;
grant execute on function public.cancel_online_counter_order(uuid)
  to authenticated, service_role;
grant execute on function public.restart_online_payment(
  uuid, uuid, text, text, text, integer
) to authenticated, service_role;
grant execute on function public.rotate_payment_handoff(uuid, text)
  to authenticated, service_role;

revoke execute on function public.search_sellable_variants(text, integer)
  from public, anon;
revoke execute on function public.create_online_counter_order(
  jsonb, uuid, text, text, text, integer
) from public, anon;
revoke execute on function public.complete_cash_counter_sale(
  jsonb, bigint, uuid, text
) from public, anon;
revoke execute on function public.attach_provider_checkout(
  uuid, uuid, text, text, text, timestamptz
) from public, anon;
revoke execute on function public.fail_provider_checkout_creation(
  uuid, uuid, text, text
) from public, anon;
revoke execute on function public.record_provider_checkout_uncertain(
  uuid, uuid, text, text
) from public, anon;
revoke execute on function public.cancel_online_counter_order(uuid)
  from public, anon;
revoke execute on function public.restart_online_payment(
  uuid, uuid, text, text, text, integer
) from public, anon;
revoke execute on function public.rotate_payment_handoff(uuid, text)
  from public, anon;

commit;
