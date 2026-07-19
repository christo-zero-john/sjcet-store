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

commit;
