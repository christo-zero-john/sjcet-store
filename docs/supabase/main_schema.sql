-- SJCET Store canonical Supabase schema
--
-- Purpose:
--   Create the current application database from an empty Supabase project.
--
-- Rules:
--   1. Keep this file as a clean declaration of the current database.
--   2. Do not add migration-history patches, obsolete objects, or seed data.
--   3. Update this file in the same change as every schema migration.
--   4. Run the complete file against an empty local Supabase database.

begin;

create extension if not exists pgcrypto with schema extensions;

create schema private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role, supabase_auth_admin;

create type public.app_role as enum (
  'student',
  'store_manager',
  'print_admin',
  'super_admin'
);

create type public.order_status as enum (
  'draft',
  'awaiting_payment',
  'paid',
  'fulfilled',
  'cancelled',
  'voided'
);

create type public.payment_method as enum (
  'cash',
  'online'
);

create type public.payment_status as enum (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled'
);

create type public.stock_movement_type as enum (
  'initial',
  'restock',
  'sale',
  'correction',
  'return'
);

create type public.stock_reservation_status as enum (
  'active',
  'released',
  'consumed'
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.product_categories (id) on delete restrict,
  slug text not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint product_categories_name_not_blank check (btrim(name) <> ''),
  constraint product_categories_not_self_parent check (id <> parent_id),
  constraint product_categories_sibling_slug_unique unique (parent_id, slug)
);

create unique index product_categories_root_slug_unique
  on public.product_categories (slug)
  where parent_id is null;

create table public.attribute_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attribute_types_name_not_blank check (btrim(name) <> ''),
  constraint attribute_types_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.attribute_values (
  id uuid primary key default gen_random_uuid(),
  attribute_type_id uuid not null
    references public.attribute_types (id) on delete restrict,
  value text not null,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attribute_values_value_not_blank check (btrim(value) <> ''),
  constraint attribute_values_type_value_unique
    unique (attribute_type_id, value),
  constraint attribute_values_type_id_pair_unique
    unique (attribute_type_id, id)
);

create table public.category_attributes (
  category_id uuid not null
    references public.product_categories (id) on delete restrict,
  attribute_type_id uuid not null
    references public.attribute_types (id) on delete restrict,
  is_required boolean not null default false,
  is_variant_axis boolean not null default false,
  sort_order integer not null default 0,
  required_from timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_id, attribute_type_id)
);

create table private.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_not_blank check (btrim(email) <> '')
);

create table private.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table private.store_manager_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  state text not null default 'pending',
  invited_by uuid not null references auth.users (id) on delete restrict,
  accepted_user_id uuid references auth.users (id) on delete set null,
  invited_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_manager_invitations_email_normalized
    check (email = lower(btrim(email))),
  constraint store_manager_invitations_email_allowed check (
    email ~ '^[^@[:space:]]+@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+sjcetpalai\.ac\.in$'
  ),
  constraint store_manager_invitations_state_allowed check (
    state in ('pending', 'accepted', 'cancelled', 'failed')
  ),
  constraint store_manager_invitations_display_name_not_blank check (
    display_name is null or btrim(display_name) <> ''
  ),
  constraint store_manager_invitations_failure_code_not_blank check (
    failure_code is null or btrim(failure_code) <> ''
  )
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_action_not_blank check (btrim(action) <> ''),
  constraint audit_events_entity_type_not_blank
    check (btrim(entity_type) <> ''),
  constraint audit_events_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_number bigint generated by default as identity not null,
  category_id uuid not null
    references public.product_categories (id) on delete restrict,
  name text not null,
  brand text,
  description text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_brand_not_blank
    check (brand is null or btrim(brand) <> ''),
  constraint products_product_number_unique unique (product_number),
  constraint products_archive_consistent check (
    (is_active and archived_at is null)
    or (not is_active and archived_at is not null)
  )
);

create table public.product_options (
  product_id uuid not null
    references public.products (id) on delete cascade,
  attribute_type_id uuid not null
    references public.attribute_types (id) on delete restrict,
  is_required boolean not null default true,
  is_variant_axis boolean not null default true,
  sort_order integer not null default 0,
  required_from timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, attribute_type_id),
  constraint product_options_sort_order_nonnegative check (sort_order >= 0)
);

create table public.product_attribute_values (
  product_id uuid not null references public.products (id) on delete cascade,
  attribute_type_id uuid not null
    references public.attribute_types (id) on delete restrict,
  attribute_value_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (product_id, attribute_type_id),
  foreign key (attribute_type_id, attribute_value_id)
    references public.attribute_values (attribute_type_id, id) on delete restrict
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  barcode text,
  attribute_signature text not null,
  price_paise bigint not null,
  current_stock integer not null default 0,
  low_stock_threshold integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint product_variants_sku_not_blank check (btrim(sku) <> ''),
  constraint product_variants_barcode_not_blank
    check (barcode is null or btrim(barcode) <> ''),
  constraint product_variants_signature_not_blank
    check (btrim(attribute_signature) <> ''),
  constraint product_variants_product_id_pair_unique unique (product_id, id),
  constraint product_variants_combination_unique
    unique (product_id, attribute_signature),
  constraint product_variants_price_nonnegative check (price_paise >= 0),
  constraint product_variants_stock_nonnegative check (current_stock >= 0),
  constraint product_variants_threshold_nonnegative
    check (low_stock_threshold >= 0),
  constraint product_variants_archive_consistent check (
    (is_active and archived_at is null)
    or (not is_active and archived_at is not null)
  )
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid,
  storage_path text not null unique,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, variant_id)
    references public.product_variants (product_id, id) on delete cascade,
  constraint product_images_path_not_blank check (btrim(storage_path) <> ''),
  constraint product_images_sort_order_nonnegative check (sort_order >= 0),
  constraint product_images_variant_not_primary
    check (variant_id is null or not is_primary)
);

create table public.variant_attribute_values (
  variant_id uuid not null
    references public.product_variants (id) on delete cascade,
  attribute_type_id uuid not null
    references public.attribute_types (id) on delete restrict,
  attribute_value_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (variant_id, attribute_type_id),
  foreign key (attribute_type_id, attribute_value_id)
    references public.attribute_values (attribute_type_id, id) on delete restrict
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  student_id uuid references auth.users (id) on delete set null,
  status public.order_status not null default 'draft',
  payment_method public.payment_method not null,
  currency text not null default 'INR',
  subtotal_paise bigint not null,
  total_paise bigint not null,
  idempotency_key uuid,
  request_fingerprint text,
  expires_at timestamptz,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_currency_inr check (currency = 'INR'),
  constraint orders_request_fingerprint_present check (
    idempotency_key is null or request_fingerprint is not null
  ),
  constraint orders_subtotal_nonnegative check (subtotal_paise >= 0),
  constraint orders_total_nonnegative check (total_paise >= 0),
  constraint orders_total_matches_subtotal
    check (total_paise = subtotal_paise),
  constraint orders_paid_timestamp_consistent check (
    (status in ('paid', 'fulfilled') and paid_at is not null)
    or (status not in ('paid', 'fulfilled') and paid_at is null)
  ),
  constraint orders_fulfilled_timestamp_consistent check (
    (status = 'fulfilled' and fulfilled_at is not null)
    or (status <> 'fulfilled' and fulfilled_at is null)
  ),
  constraint orders_cancelled_timestamp_consistent check (
    (status in ('cancelled', 'voided') and cancelled_at is not null)
    or (status not in ('cancelled', 'voided') and cancelled_at is null)
  )
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  variant_id uuid not null
    references public.product_variants (id) on delete restrict,
  product_name text not null,
  product_sku text not null,
  variant_description text not null,
  unit_price_paise bigint not null,
  quantity integer not null,
  line_total_paise bigint not null,
  created_at timestamptz not null default now(),
  constraint order_lines_order_variant_unique unique (order_id, variant_id),
  constraint order_lines_product_name_not_blank
    check (btrim(product_name) <> ''),
  constraint order_lines_product_sku_not_blank check (btrim(product_sku) <> ''),
  constraint order_lines_unit_price_nonnegative check (unit_price_paise >= 0),
  constraint order_lines_quantity_positive check (quantity > 0),
  constraint order_lines_total_matches check (
    line_total_paise = unit_price_paise * quantity
  )
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null
    references public.product_variants (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,
  movement_type public.stock_movement_type not null,
  quantity_before integer not null,
  quantity_delta integer not null,
  quantity_after integer not null,
  reason text not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  idempotency_key uuid,
  request_fingerprint text,
  created_at timestamptz not null default now(),
  constraint stock_movements_delta_nonzero check (quantity_delta <> 0),
  constraint stock_movements_before_nonnegative check (quantity_before >= 0),
  constraint stock_movements_after_nonnegative check (quantity_after >= 0),
  constraint stock_movements_quantity_matches check (
    quantity_after = quantity_before + quantity_delta
  ),
  constraint stock_movements_reason_not_blank check (btrim(reason) <> ''),
  constraint stock_movements_sale_has_order check (
    movement_type <> 'sale' or order_id is not null
  )
);

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

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  provider text,
  provider_checkout_id text,
  provider_payment_id text,
  checkout_url text,
  amount_paise bigint not null,
  currency text not null default 'INR',
  cash_received_paise bigint,
  change_due_paise bigint,
  idempotency_key uuid,
  request_fingerprint text,
  provider_checkout_expires_at timestamptz,
  reconciliation_code text,
  reconciliation_message text,
  failure_code text,
  failure_message text,
  succeeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_amount_nonnegative check (amount_paise >= 0),
  constraint payment_attempts_reconciliation_code_not_blank check (
    reconciliation_code is null or btrim(reconciliation_code) <> ''
  ),
  constraint payment_attempts_currency_inr check (currency = 'INR'),
  constraint payment_attempts_cash_fields check (
    (
      method = 'cash'
      and provider is null
      and provider_checkout_id is null
      and provider_payment_id is null
      and checkout_url is null
      and cash_received_paise is not null
      and change_due_paise is not null
      and cash_received_paise >= amount_paise
      and change_due_paise = cash_received_paise - amount_paise
    )
    or (
      method = 'online'
      and provider is not null
      and cash_received_paise is null
      and change_due_paise is null
    )
  ),
  constraint payment_attempts_success_timestamp check (
    (status = 'succeeded' and succeeded_at is not null)
    or (status <> 'succeeded' and succeeded_at is null)
  )
);

create table private.processed_webhooks (
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload_sha256 text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id),
  constraint processed_webhooks_provider_not_blank check (btrim(provider) <> ''),
  constraint processed_webhooks_event_id_not_blank check (btrim(event_id) <> ''),
  constraint processed_webhooks_event_type_not_blank
    check (btrim(event_type) <> ''),
  constraint processed_webhooks_hash_format
    check (payload_sha256 ~ '^[a-f0-9]{64}$')
);

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

create index user_roles_role_user_idx
  on private.user_roles (role, user_id);

create index product_categories_parent_sort_idx
  on public.product_categories (parent_id, sort_order, name);

create index attribute_values_type_sort_idx
  on public.attribute_values (attribute_type_id, sort_order, value);

create index category_attributes_category_sort_idx
  on public.category_attributes (category_id, sort_order);

create index category_attributes_type_idx
  on public.category_attributes (attribute_type_id, category_id);

create index audit_events_actor_created_idx
  on public.audit_events (actor_id, created_at desc);

create index audit_events_entity_created_idx
  on public.audit_events (entity_type, entity_id, created_at desc);

create index products_active_name_idx
  on public.products (is_active, name);

create index products_category_active_idx
  on public.products (category_id, is_active, name);

create index product_attribute_values_value_idx
  on public.product_attribute_values (attribute_type_id, attribute_value_id);

create index product_variants_product_active_idx
  on public.product_variants (product_id, is_active, sku);

create unique index product_variants_barcode_unique
  on public.product_variants (barcode)
  where barcode is not null;

create index product_variants_low_stock_idx
  on public.product_variants (current_stock, low_stock_threshold)
  where is_active;

create unique index product_images_one_primary
  on public.product_images (product_id)
  where is_primary and variant_id is null;

create unique index product_images_one_per_variant
  on public.product_images (variant_id)
  where variant_id is not null;

create index product_images_product_sort_idx
  on public.product_images (product_id, sort_order, created_at);

create index variant_attribute_values_value_idx
  on public.variant_attribute_values (attribute_type_id, attribute_value_id);

create index orders_created_by_created_idx
  on public.orders (created_by, created_at desc);

create index orders_student_created_idx
  on public.orders (student_id, created_at desc)
  where student_id is not null;

create index orders_status_created_idx
  on public.orders (status, created_at desc);

create index order_lines_order_idx
  on public.order_lines (order_id);

create index order_lines_variant_idx
  on public.order_lines (variant_id);

create index stock_movements_variant_created_idx
  on public.stock_movements (variant_id, created_at desc);

create index stock_movements_order_idx
  on public.stock_movements (order_id)
  where order_id is not null;

create unique index stock_movements_idempotency_key_unique
  on public.stock_movements (idempotency_key)
  where idempotency_key is not null;

create index payment_attempts_order_created_idx
  on public.payment_attempts (order_id, created_at desc);

create unique index payment_attempts_provider_checkout_unique
  on public.payment_attempts (provider, provider_checkout_id)
  where provider_checkout_id is not null;

create unique index payment_attempts_provider_payment_unique
  on public.payment_attempts (provider, provider_payment_id)
  where provider_payment_id is not null;

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

create index stock_reservations_active_variant_idx
  on public.stock_reservations (variant_id, expires_at)
  where status = 'active';

create index stock_reservations_variant_idx
  on public.stock_reservations (variant_id);

create index payment_handoffs_expires_at_idx
  on private.payment_handoffs (expires_at);

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.is_allowed_college_email(candidate text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select candidate ~* (
    '^[^@[:space:]]+@'
    '([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+'
    'sjcetpalai\.ac\.in$'
  );
$$;

create function private.hook_restrict_college_signup(event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate_email text := event -> 'user' ->> 'email';
begin
  if candidate_email is null
    or not private.is_allowed_college_email(candidate_email)
  then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code',
        403,
        'message',
        'Use an approved SJCET college email address.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.profiles (
    user_id,
    email,
    display_name
  )
  values (
    new.id,
    new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '')
  );

  insert into private.user_roles (
    user_id,
    role,
    assigned_by
  )
  values (
    new.id,
    'student'::public.app_role,
    null
  );

  return new;
end;
$$;

create function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles
    where user_id = (select auth.uid())
      and role = required_role
  );
$$;

create function private.is_store_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_role('store_manager'::public.app_role)
    or private.has_role('super_admin'::public.app_role);
$$;

create function public.current_user_roles()
returns public.app_role[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(role order by role),
    '{}'::public.app_role[]
  )
  from private.user_roles
  where user_id = (select auth.uid())
  ;
$$;

create function public.authorize_user_roles(
  target_user_id uuid,
  grant_configured_super_admin boolean
)
returns public.app_role[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
  invitation_record record;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Service-role access is required.';
  end if;

  if not exists (
    select 1
    from auth.users
    where users.id = target_user_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Authenticated user not found.';
  end if;

  if grant_configured_super_admin then
    if not exists (
      select 1
      from auth.users
      where users.id = target_user_id
        and users.email_confirmed_at is not null
    ) then
      raise exception using
        errcode = '23514',
        message = 'A confirmed user account is required.';
    end if;

    insert into private.user_roles (
      user_id,
      role,
      assigned_by
    )
    values (
      target_user_id,
      'super_admin'::public.app_role,
      null
    )
    on conflict (user_id, role) do nothing;

    get diagnostics inserted_count = row_count;

    if inserted_count = 1 then
      insert into public.audit_events (
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values (
        target_user_id,
        'role.configured_super_admin',
        'user',
        target_user_id,
        jsonb_build_object(
          'role',
          'super_admin',
          'source',
          'server_environment'
        )
      );
    end if;
  end if;

  select invitations.id, invitations.invited_by
  into invitation_record
  from private.store_manager_invitations as invitations
  join auth.users as users
    on lower(users.email) = invitations.email
  where users.id = target_user_id
    and users.email_confirmed_at is not null
    and invitations.state = 'pending'
  for update of invitations;

  if found then
    insert into private.user_roles (
      user_id,
      role,
      assigned_by
    )
    values (
      target_user_id,
      'store_manager'::public.app_role,
      invitation_record.invited_by
    )
    on conflict (user_id, role) do nothing;

    get diagnostics inserted_count = row_count;

    update private.store_manager_invitations
    set state = 'accepted',
        accepted_user_id = target_user_id,
        accepted_at = now(),
        cancelled_at = null,
        failed_at = null,
        failure_code = null
    where id = invitation_record.id;

    if inserted_count = 1 then
      insert into public.audit_events (
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values (
        invitation_record.invited_by,
        'store_manager.assigned',
        'user',
        target_user_id,
        jsonb_build_object(
          'source',
          'confirmed_invitation',
          'invitation_id',
          invitation_record.id
        )
      );
    end if;
  end if;

  return array(
    select user_roles.role
    from private.user_roles
    where user_roles.user_id = target_user_id
    order by user_roles.role
  );
end;
$$;

create function public.request_store_manager_access(
  target_email text,
  target_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  normalized_email text := lower(btrim(target_email));
  normalized_display_name text := nullif(btrim(target_display_name), '');
  target_user record;
  invitation_record record;
  inserted_count integer := 0;
begin
  if actor is null
    or not private.has_role('super_admin'::public.app_role) then
    raise exception using
      errcode = '42501',
      message = 'Super-admin access is required.';
  end if;

  if normalized_email is null
    or normalized_email !~ '^[^@[:space:]]+@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+sjcetpalai\.ac\.in$' then
    raise exception using
      errcode = '22023',
      message = 'Use an approved SJCET college email address.';
  end if;

  select users.id, users.email_confirmed_at
  into target_user
  from auth.users as users
  where lower(users.email) = normalized_email
  order by users.created_at
  limit 1;

  if found and target_user.email_confirmed_at is not null then
    insert into private.user_roles (user_id, role, assigned_by)
    values (
      target_user.id,
      'store_manager'::public.app_role,
      actor
    )
    on conflict (user_id, role) do nothing;

    get diagnostics inserted_count = row_count;

    update private.store_manager_invitations
    set state = 'accepted',
        accepted_user_id = target_user.id,
        accepted_at = coalesce(accepted_at, now()),
        cancelled_at = null,
        failed_at = null,
        failure_code = null
    where email = normalized_email;

    if inserted_count = 1 then
      insert into public.audit_events (
        actor_id, action, entity_type, entity_id, metadata
      )
      values (
        actor,
        'store_manager.assigned',
        'user',
        target_user.id,
        jsonb_build_object('source', 'existing_account')
      );
    end if;

    return jsonb_build_object(
      'state', 'active',
      'user_id', target_user.id,
      'requires_auth_invite', false
    );
  end if;

  select *
  into invitation_record
  from private.store_manager_invitations
  where email = normalized_email
  for update;

  if found and invitation_record.state = 'pending' then
    return jsonb_build_object(
      'state', 'pending',
      'email', normalized_email,
      'requires_auth_invite', false
    );
  end if;

  insert into private.store_manager_invitations (
    email,
    display_name,
    state,
    invited_by,
    invited_at,
    last_sent_at,
    accepted_user_id,
    accepted_at,
    cancelled_at,
    failed_at,
    failure_code
  )
  values (
    normalized_email,
    normalized_display_name,
    'pending',
    actor,
    now(),
    now(),
    null,
    null,
    null,
    null,
    null
  )
  on conflict (email) do update
  set display_name = coalesce(
        excluded.display_name,
        private.store_manager_invitations.display_name
      ),
      state = 'pending',
      invited_by = excluded.invited_by,
      invited_at = excluded.invited_at,
      last_sent_at = excluded.last_sent_at,
      accepted_user_id = null,
      accepted_at = null,
      cancelled_at = null,
      failed_at = null,
      failure_code = null
  returning * into invitation_record;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    actor,
    'store_manager.invited',
    'store_manager_invitation',
    invitation_record.id,
    jsonb_build_object('email', normalized_email)
  );

  return jsonb_build_object(
    'state', 'pending',
    'email', normalized_email,
    'requires_auth_invite', target_user.id is null
  );
end;
$$;

create function public.list_store_manager_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  active_managers jsonb;
  pending_invitations jsonb;
begin
  if actor is null
    or not private.has_role('super_admin'::public.app_role) then
    raise exception using
      errcode = '42501',
      message = 'Super-admin access is required.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', profiles.user_id,
        'email', profiles.email,
        'display_name', profiles.display_name,
        'assigned_at', user_roles.assigned_at
      )
      order by profiles.email
    ),
    '[]'::jsonb
  )
  into active_managers
  from private.user_roles
  join private.profiles
    on profiles.user_id = user_roles.user_id
  where user_roles.role = 'store_manager'::public.app_role;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'email', email,
        'display_name', display_name,
        'state', state,
        'invited_at', invited_at,
        'last_sent_at', last_sent_at,
        'failure_code', failure_code
      )
      order by email
    ),
    '[]'::jsonb
  )
  into pending_invitations
  from private.store_manager_invitations
  where state in ('pending', 'failed');

  return jsonb_build_object(
    'active', active_managers,
    'pending', pending_invitations
  );
end;
$$;

create function public.remove_store_manager_access(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null
    or not private.has_role('super_admin'::public.app_role) then
    raise exception using
      errcode = '42501',
      message = 'Super-admin access is required.';
  end if;

  delete from private.user_roles
  where user_id = target_user_id
    and role = 'store_manager'::public.app_role;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Store manager access was not found.';
  end if;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id
  )
  values (
    actor, 'store_manager.removed', 'user', target_user_id
  );
end;
$$;

create function public.cancel_store_manager_invitation(target_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  invitation_id uuid;
  normalized_email text := lower(btrim(target_email));
begin
  if actor is null
    or not private.has_role('super_admin'::public.app_role) then
    raise exception using
      errcode = '42501',
      message = 'Super-admin access is required.';
  end if;

  update private.store_manager_invitations
  set state = 'cancelled',
      cancelled_at = now(),
      failed_at = null,
      failure_code = null
  where email = normalized_email
    and state in ('pending', 'failed')
  returning id into invitation_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pending store manager invitation was not found.';
  end if;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    actor,
    'store_manager.invitation_cancelled',
    'store_manager_invitation',
    invitation_id,
    jsonb_build_object('email', normalized_email)
  );
end;
$$;

create function public.mark_store_manager_invitation_resent(target_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  invitation_id uuid;
  normalized_email text := lower(btrim(target_email));
begin
  if actor is null
    or not private.has_role('super_admin'::public.app_role) then
    raise exception using
      errcode = '42501',
      message = 'Super-admin access is required.';
  end if;

  update private.store_manager_invitations
  set state = 'pending',
      last_sent_at = now(),
      failed_at = null,
      failure_code = null
  where email = normalized_email
    and state in ('pending', 'failed')
  returning id into invitation_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pending store manager invitation was not found.';
  end if;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    actor,
    'store_manager.invitation_resent',
    'store_manager_invitation',
    invitation_id,
    jsonb_build_object('email', normalized_email)
  );
end;
$$;

create function public.mark_store_manager_invitation_failed(
  target_email text,
  failure_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  invitation_id uuid;
  normalized_email text := lower(btrim(target_email));
  normalized_failure_code text := coalesce(
    nullif(btrim(failure_code), ''),
    'provider_error'
  );
begin
  if actor is null
    or not private.has_role('super_admin'::public.app_role) then
    raise exception using
      errcode = '42501',
      message = 'Super-admin access is required.';
  end if;

  update private.store_manager_invitations
  set state = 'failed',
      failed_at = now(),
      failure_code = normalized_failure_code
  where email = normalized_email
    and state = 'pending'
  returning id into invitation_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Pending store manager invitation was not found.';
  end if;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    actor,
    'store_manager.invitation_failed',
    'store_manager_invitation',
    invitation_id,
    jsonb_build_object(
      'email', normalized_email,
      'failure_code', normalized_failure_code
    )
  );
end;
$$;

create function private.prevent_row_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = format('%I is append-only', tg_table_name);
end;
$$;

create function private.enforce_category_depth()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_parent_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select parent_id
  into parent_parent_id
  from public.product_categories
  where id = new.parent_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Parent category does not exist.';
  end if;

  if parent_parent_id is not null then
    raise exception using
      errcode = '23514',
      message = 'Category nesting cannot exceed two levels.';
  end if;

  if exists (
    select 1
    from public.product_categories
    where parent_id = new.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'A category with children cannot become a subcategory.';
  end if;

  return new;
end;
$$;

create function private.set_category_attribute_required_from()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.is_required then
    new.required_from := null;
  elsif tg_op = 'INSERT' or not old.is_required then
    new.required_from := coalesce(new.required_from, now());
  else
    new.required_from := old.required_from;
  end if;

  return new;
end;
$$;

create function private.protect_category_attribute_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.products
    left join public.product_attribute_values
      on product_attribute_values.product_id = products.id
     and product_attribute_values.attribute_type_id = old.attribute_type_id
    left join public.product_variants
      on product_variants.product_id = products.id
    left join public.variant_attribute_values
      on variant_attribute_values.variant_id = product_variants.id
     and variant_attribute_values.attribute_type_id = old.attribute_type_id
    where (
      products.category_id = old.category_id
      or exists (
        select 1
        from public.product_categories
        where product_categories.id = products.category_id
          and product_categories.parent_id = old.category_id
      )
    )
      and (
        product_attribute_values.product_id is not null
        or variant_attribute_values.variant_id is not null
      )
  ) then
    raise exception using
      errcode = '23503',
      message = 'This category parameter is used by a product and cannot be removed.';
  end if;

  return old;
end;
$$;

create function public.get_catalog_option_usage(
  target_attribute_type_id uuid,
  target_attribute_value_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  product_count integer;
  variant_count integer;
  category_count integer;
  product_ids jsonb;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if target_attribute_value_id is not null
     and not exists (
       select 1
       from public.attribute_values
       where attribute_values.id = target_attribute_value_id
         and attribute_values.attribute_type_id = target_attribute_type_id
     ) then
    raise exception using
      errcode = 'P0002',
      message = 'Catalog parameter value not found.';
  end if;

  with referenced_products as (
    select product_attribute_values.product_id
    from public.product_attribute_values
    where product_attribute_values.attribute_type_id = target_attribute_type_id
      and (
        target_attribute_value_id is null
        or product_attribute_values.attribute_value_id = target_attribute_value_id
      )
    union
    select product_variants.product_id
    from public.variant_attribute_values
    join public.product_variants
      on product_variants.id = variant_attribute_values.variant_id
    where variant_attribute_values.attribute_type_id = target_attribute_type_id
      and (
        target_attribute_value_id is null
        or variant_attribute_values.attribute_value_id = target_attribute_value_id
      )
  )
  select
    count(*)::integer,
    coalesce(jsonb_agg(product_id order by product_id), '[]'::jsonb)
  into product_count, product_ids
  from referenced_products;

  select count(*)::integer
  into variant_count
  from public.variant_attribute_values
  where variant_attribute_values.attribute_type_id = target_attribute_type_id
    and (
      target_attribute_value_id is null
      or variant_attribute_values.attribute_value_id = target_attribute_value_id
    );

  select case
    when target_attribute_value_id is null then count(*)::integer
    else 0
  end
  into category_count
  from public.category_attributes
  where category_attributes.attribute_type_id = target_attribute_type_id;

  return jsonb_build_object(
    'product_count', product_count,
    'variant_count', variant_count,
    'category_count', category_count,
    'total_count', product_count + variant_count + category_count,
    'product_ids', product_ids
  );
end;
$$;

create function public.get_category_option_usage(
  target_category_id uuid,
  target_attribute_type_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  product_count integer;
  variant_count integer;
  product_ids jsonb;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;
  if not exists (
    select 1 from public.category_attributes
    where category_id = target_category_id
      and attribute_type_id = target_attribute_type_id
  ) then
    raise exception using errcode = 'P0002',
      message = 'Category option not found.';
  end if;

  with category_scope as (
    select target_category_id as category_id
    union all
    select id from public.product_categories
    where parent_id = target_category_id
  ),
  referenced_products as (
    select distinct products.id
    from public.products
    join category_scope
      on category_scope.category_id = products.category_id
    left join public.product_attribute_values
      on product_attribute_values.product_id = products.id
     and product_attribute_values.attribute_type_id =
       target_attribute_type_id
    left join public.product_variants
      on product_variants.product_id = products.id
    left join public.variant_attribute_values
      on variant_attribute_values.variant_id = product_variants.id
     and variant_attribute_values.attribute_type_id =
       target_attribute_type_id
    where product_attribute_values.product_id is not null
       or variant_attribute_values.variant_id is not null
  )
  select count(*)::integer,
    coalesce(jsonb_agg(id order by id), '[]'::jsonb)
  into product_count, product_ids
  from referenced_products;

  with category_scope as (
    select target_category_id as category_id
    union all
    select id from public.product_categories
    where parent_id = target_category_id
  )
  select count(*)::integer
  into variant_count
  from public.variant_attribute_values
  join public.product_variants
    on product_variants.id = variant_attribute_values.variant_id
  join public.products
    on products.id = product_variants.product_id
  join category_scope
    on category_scope.category_id = products.category_id
  where variant_attribute_values.attribute_type_id =
    target_attribute_type_id;

  return jsonb_build_object(
    'product_count', product_count,
    'variant_count', variant_count,
    'product_ids', product_ids
  );
end;
$$;

create function public.update_category_inline(
  target_category_id uuid,
  category_name text,
  parent_category_id uuid,
  category_description text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  normalized_name text := nullif(btrim(category_name), '');
  normalized_description text :=
    nullif(btrim(category_description), '');
  category_slug text;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;
  if normalized_name is null then
    raise exception using errcode = '22023',
      message = 'Category name is required.';
  end if;
  category_slug := trim(both '-' from regexp_replace(
    lower(normalized_name), '[^a-z0-9]+', '-', 'g'
  ));
  if category_slug = '' then
    raise exception using errcode = '22023',
      message = 'Category name needs at least one letter or number.';
  end if;
  perform id from public.product_categories
  where id = target_category_id for update;
  if not found then
    raise exception using errcode = 'P0002',
      message = 'Category not found.';
  end if;
  update public.product_categories
  set name = normalized_name,
      slug = category_slug,
      parent_id = parent_category_id,
      description = normalized_description
  where id = target_category_id;
  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor, 'catalog.category_updated', 'category', target_category_id,
    jsonb_build_object('parent_id', parent_category_id)
  );
  return jsonb_build_object(
    'id', target_category_id,
    'name', normalized_name,
    'parent_id', parent_category_id,
    'description', normalized_description
  );
end;
$$;

create function public.update_catalog_option_inline(
  target_category_id uuid,
  target_attribute_type_id uuid,
  option_name text,
  allowed_values jsonb,
  option_is_required boolean,
  option_is_variant_axis boolean,
  option_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  normalized_name text := nullif(btrim(option_name), '');
  option_slug text;
  value_payload jsonb;
  payload_id uuid;
  payload_value text;
  payload_sort_order integer;
  category_count integer;
  inserted_value_count integer := 0;
  updated_value_count integer := 0;
  removed_value_count integer := 0;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;
  if normalized_name is null then
    raise exception using errcode = '22023',
      message = 'Option name is required.';
  end if;
  if option_sort_order is null or option_sort_order < 0 then
    raise exception using errcode = '22023',
      message = 'Option display order must be zero or greater.';
  end if;
  if jsonb_typeof(coalesce(allowed_values, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(allowed_values, '[]'::jsonb)) = 0 then
    raise exception using errcode = '22023',
      message = 'At least one allowed option value is required.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(allowed_values) as item
    where jsonb_typeof(item) <> 'object'
      or nullif(btrim(item->>'value'), '') is null
      or (item->>'sort_order') is null
      or (item->>'sort_order')::integer < 0
  ) then
    raise exception using errcode = '22023',
      message = 'Every option value needs a label and display order.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(allowed_values) as item
    group by lower(btrim(item->>'value'))
    having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'Option values must be unique.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(allowed_values) as item
    where nullif(item->>'id', '') is not null
    group by item->>'id'
    having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'An option value cannot appear more than once.';
  end if;
  perform 1 from public.category_attributes
  where category_id = target_category_id
    and attribute_type_id = target_attribute_type_id
  for update;
  if not found then
    raise exception using errcode = 'P0002',
      message = 'Category option not found.';
  end if;
  perform 1 from public.attribute_types
  where id = target_attribute_type_id for update;
  perform id from public.attribute_values
  where attribute_type_id = target_attribute_type_id
  order by id for update;
  if exists (
    select 1 from jsonb_array_elements(allowed_values) as item
    where nullif(item->>'id', '') is not null
      and not exists (
        select 1 from public.attribute_values
        where id = (item->>'id')::uuid
          and attribute_type_id = target_attribute_type_id
      )
  ) then
    raise exception using errcode = '23514',
      message = 'An option value does not belong to this option.';
  end if;
  if exists (
    select 1 from public.attribute_values
    where attribute_type_id = target_attribute_type_id
      and not exists (
        select 1 from jsonb_array_elements(allowed_values) as item
        where nullif(item->>'id', '')::uuid = attribute_values.id
      )
      and (
        exists (
          select 1 from public.product_attribute_values
          where attribute_value_id = attribute_values.id
        )
        or exists (
          select 1 from public.variant_attribute_values
          where attribute_value_id = attribute_values.id
        )
      )
  ) then
    raise exception using errcode = '23503',
      message = 'A removed option value is used by a product.';
  end if;
  delete from public.attribute_values
  where attribute_type_id = target_attribute_type_id
    and not exists (
      select 1 from jsonb_array_elements(allowed_values) as item
      where nullif(item->>'id', '')::uuid = attribute_values.id
    );
  get diagnostics removed_value_count = row_count;
  update public.attribute_values
  set value = '__catalog_edit__' || id::text
  where attribute_type_id = target_attribute_type_id;
  option_slug := trim(both '-' from regexp_replace(
    lower(normalized_name), '[^a-z0-9]+', '-', 'g'
  ));
  if option_slug = '' then
    raise exception using errcode = '22023',
      message = 'Option name needs at least one letter or number.';
  end if;
  update public.attribute_types
  set name = normalized_name, slug = option_slug
  where id = target_attribute_type_id;
  for value_payload in
    select value from jsonb_array_elements(allowed_values)
  loop
    payload_id := nullif(value_payload->>'id', '')::uuid;
    payload_value := btrim(value_payload->>'value');
    payload_sort_order := (value_payload->>'sort_order')::integer;
    if payload_id is null then
      insert into public.attribute_values (
        attribute_type_id, value, sort_order, created_by
      ) values (
        target_attribute_type_id, payload_value,
        payload_sort_order, actor
      );
      inserted_value_count := inserted_value_count + 1;
    else
      update public.attribute_values
      set value = payload_value, sort_order = payload_sort_order
      where id = payload_id;
      updated_value_count := updated_value_count + 1;
    end if;
  end loop;
  update public.category_attributes
  set is_required = option_is_required,
      is_variant_axis = option_is_variant_axis,
      sort_order = option_sort_order
  where category_id = target_category_id
    and attribute_type_id = target_attribute_type_id;
  select count(*)::integer into category_count
  from public.category_attributes
  where attribute_type_id = target_attribute_type_id;
  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor, 'catalog.option_updated', 'attribute_type',
    target_attribute_type_id,
    jsonb_build_object(
      'category_id', target_category_id,
      'category_count', category_count,
      'inserted_value_count', inserted_value_count,
      'updated_value_count', updated_value_count,
      'removed_value_count', removed_value_count
    )
  );
  return jsonb_build_object(
    'attribute_type', jsonb_build_object(
      'id', target_attribute_type_id, 'name', normalized_name
    ),
    'attribute_values', (
      select coalesce(
        jsonb_agg(jsonb_build_object(
          'id', id,
          'attribute_type_id', attribute_type_id,
          'value', value,
          'sort_order', sort_order
        ) order by sort_order, value),
        '[]'::jsonb
      )
      from public.attribute_values
      where attribute_type_id = target_attribute_type_id
    ),
    'category_attribute', jsonb_build_object(
      'category_id', target_category_id,
      'attribute_type_id', target_attribute_type_id,
      'is_required', option_is_required,
      'is_variant_axis', option_is_variant_axis,
      'sort_order', option_sort_order
    ),
    'category_count', category_count
  );
end;
$$;

create function public.remove_attribute_value(target_attribute_value_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_type_id uuid;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  select attribute_type_id
  into target_type_id
  from public.attribute_values
  where id = target_attribute_value_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Catalog parameter value not found.';
  end if;

  if exists (
    select 1
    from public.product_attribute_values
    where attribute_value_id = target_attribute_value_id
    union all
    select 1
    from public.variant_attribute_values
    where attribute_value_id = target_attribute_value_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'This parameter value is used by a product and cannot be removed.';
  end if;

  delete from public.attribute_values
  where id = target_attribute_value_id;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor,
    'catalog.attribute_value_removed',
    'attribute_value',
    target_attribute_value_id,
    jsonb_build_object('attribute_type_id', target_type_id)
  );
end;
$$;

create function public.remove_category_attribute(
  target_category_id uuid,
  target_attribute_type_id uuid
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
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  delete from public.category_attributes
  where category_id = target_category_id
    and attribute_type_id = target_attribute_type_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Category parameter not found.';
  end if;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor,
    'catalog.category_attribute_removed',
    'category',
    target_category_id,
    jsonb_build_object('attribute_type_id', target_attribute_type_id)
  );
end;
$$;

create function public.remove_attribute_type(target_attribute_type_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_store_operator() then
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  perform 1
  from public.attribute_types
  where id = target_attribute_type_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Catalog parameter not found.';
  end if;

  if exists (
    select 1
    from public.category_attributes
    where attribute_type_id = target_attribute_type_id
    union all
    select 1
    from public.product_attribute_values
    where attribute_type_id = target_attribute_type_id
    union all
    select 1
    from public.variant_attribute_values
    where attribute_type_id = target_attribute_type_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'This parameter is in use and cannot be removed.';
  end if;

  delete from public.attribute_values
  where attribute_type_id = target_attribute_type_id;

  delete from public.attribute_types
  where id = target_attribute_type_id;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id
  ) values (
    actor,
    'catalog.attribute_type_removed',
    'attribute_type',
    target_attribute_type_id
  );
end;
$$;

create function public.create_category_with_parameters(
  category_name text,
  parent_category_id uuid,
  category_description text,
  parameter_configurations jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  new_category_id uuid;
  category_slug text;
  configuration jsonb;
  target_attribute_type_id uuid;
  parameter_name text;
  parameter_slug text;
  parameter_value text;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if nullif(btrim(category_name), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Category name is required.';
  end if;

  if jsonb_typeof(coalesce(parameter_configurations, '[]'::jsonb)) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Category parameters must be an array.';
  end if;

  category_slug := trim(
    both '-' from regexp_replace(
      lower(btrim(category_name)),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );

  insert into public.product_categories (
    parent_id,
    slug,
    name,
    description
  ) values (
    parent_category_id,
    category_slug,
    btrim(category_name),
    nullif(btrim(category_description), '')
  )
  returning id into new_category_id;

  for configuration in
    select value
    from jsonb_array_elements(coalesce(parameter_configurations, '[]'::jsonb))
  loop
    target_attribute_type_id := nullif(
      configuration->>'attribute_type_id',
      ''
    )::uuid;

    if target_attribute_type_id is null then
      parameter_name := nullif(btrim(configuration->>'name'), '');
      if parameter_name is null then
        raise exception using
          errcode = '22023',
          message = 'Every new parameter needs a name.';
      end if;
      if jsonb_typeof(coalesce(configuration->'values', '[]'::jsonb))
          <> 'array'
        or not exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(configuration->'values', '[]'::jsonb)
          )
          where nullif(btrim(value), '') is not null
        ) then
        raise exception using
          errcode = '22023',
          message = 'Every new parameter needs at least one allowed value.';
      end if;

      parameter_slug := trim(
        both '-' from regexp_replace(
          lower(parameter_name),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      );

      insert into public.attribute_types (name, slug, created_by)
      values (parameter_name, parameter_slug, actor)
      returning id into target_attribute_type_id;

      for parameter_value in
        select btrim(value)
        from jsonb_array_elements_text(
          coalesce(configuration->'values', '[]'::jsonb)
        )
      loop
        if parameter_value <> '' then
          insert into public.attribute_values (
            attribute_type_id,
            value,
            created_by
          ) values (
            target_attribute_type_id,
            parameter_value,
            actor
          );
        end if;
      end loop;
    elsif not exists (
      select 1
      from public.attribute_types
      where id = target_attribute_type_id
    ) then
      raise exception using
        errcode = 'P0002',
        message = 'Selected catalog parameter not found.';
    end if;
    if not exists (
      select 1
      from public.attribute_values
      where attribute_type_id = target_attribute_type_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Every category parameter needs an allowed value.';
    end if;

    insert into public.category_attributes (
      category_id,
      attribute_type_id,
      is_required,
      is_variant_axis,
      sort_order,
      created_by
    ) values (
      new_category_id,
      target_attribute_type_id,
      coalesce((configuration->>'is_required')::boolean, false),
      coalesce((configuration->>'is_variant_axis')::boolean, false),
      coalesce((configuration->>'sort_order')::integer, 0),
      actor
    );
  end loop;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor,
    'catalog.category_created',
    'category',
    new_category_id,
    jsonb_build_object(
      'parent_category_id', parent_category_id,
      'parameter_count', jsonb_array_length(parameter_configurations)
    )
  );

  return jsonb_build_object(
    'id', new_category_id,
    'name', btrim(category_name),
    'parent_id', parent_category_id
  );
end;
$$;

create function public.add_product_option_to_category(
  target_category_id uuid,
  target_attribute_type_id uuid,
  new_parameter_name text,
  new_allowed_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  selected_parent_id uuid;
  resolved_attribute_type_id uuid := target_attribute_type_id;
  parameter_name text;
  parameter_slug text;
  parameter_value text;
  parameter_sort_order integer;
  next_sort_order integer;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  select parent_id
  into selected_parent_id
  from public.product_categories
  where id = target_category_id
    and is_active;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Selected active category not found.';
  end if;

  if resolved_attribute_type_id is null then
    parameter_name := nullif(btrim(new_parameter_name), '');
    if parameter_name is null then
      raise exception using
        errcode = '22023',
        message = 'Option name is required.';
    end if;
    if jsonb_typeof(coalesce(new_allowed_values, '[]'::jsonb)) <> 'array'
      or not exists (
        select 1
        from jsonb_array_elements_text(
          coalesce(new_allowed_values, '[]'::jsonb)
        )
        where nullif(btrim(value), '') is not null
      ) then
      raise exception using
        errcode = '22023',
        message = 'At least one allowed option value is required.';
    end if;

    parameter_slug := trim(
      both '-' from regexp_replace(
        lower(parameter_name),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    );

    insert into public.attribute_types (name, slug, created_by)
    values (parameter_name, parameter_slug, actor)
    returning id into resolved_attribute_type_id;

    for parameter_value, parameter_sort_order in
      select btrim(value), min(ordinality)::integer - 1
      from jsonb_array_elements_text(new_allowed_values)
        with ordinality as allowed(value, ordinality)
      where nullif(btrim(value), '') is not null
      group by btrim(value)
      order by min(ordinality)
    loop
      insert into public.attribute_values (
        attribute_type_id,
        value,
        sort_order,
        created_by
      ) values (
        resolved_attribute_type_id,
        parameter_value,
        parameter_sort_order,
        actor
      );
    end loop;
  elsif not exists (
    select 1
    from public.attribute_types
    where id = resolved_attribute_type_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Selected catalog option not found.';
  end if;

  if not exists (
    select 1
    from public.attribute_values
    where attribute_type_id = resolved_attribute_type_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'A product option needs at least one allowed value.';
  end if;

  if exists (
    select 1
    from public.category_attributes
    where attribute_type_id = resolved_attribute_type_id
      and category_id in (target_category_id, selected_parent_id)
  ) then
    raise exception using
      errcode = '23505',
      message = 'This option is already configured for the selected category.';
  end if;

  select coalesce(max(sort_order), -1) + 1
  into next_sort_order
  from public.category_attributes
  where category_id = target_category_id;

  insert into public.category_attributes (
    category_id,
    attribute_type_id,
    is_required,
    is_variant_axis,
    sort_order,
    created_by
  ) values (
    target_category_id,
    resolved_attribute_type_id,
    true,
    true,
    next_sort_order,
    actor
  );

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    actor,
    'catalog.product_option_added_to_category',
    'category',
    target_category_id,
    jsonb_build_object(
      'attribute_type_id', resolved_attribute_type_id,
      'created_inline', target_attribute_type_id is null
    )
  );

  return resolved_attribute_type_id;
end;
$$;

create function public.add_category_parameter_inline(
  target_category_id uuid,
  target_attribute_type_id uuid,
  new_parameter_name text,
  new_allowed_values jsonb,
  option_is_required boolean,
  option_is_variant_axis boolean,
  option_sort_order integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  resolved_attribute_type_id uuid;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if option_sort_order is null or option_sort_order < 0 then
    raise exception using
      errcode = '22023',
      message = 'Option display order must be zero or greater.';
  end if;

  resolved_attribute_type_id :=
    public.add_product_option_to_category(
      target_category_id,
      target_attribute_type_id,
      new_parameter_name,
      new_allowed_values
    );

  update public.category_attributes
  set is_required = option_is_required,
      is_variant_axis = option_is_variant_axis,
      sort_order = option_sort_order
  where category_id = target_category_id
    and attribute_type_id = resolved_attribute_type_id;

  return resolved_attribute_type_id;
end;
$$;

create function public.set_primary_product_image(
  target_product_id uuid,
  target_image_id uuid
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
      message = 'Store-manager access is required.';
  end if;

  perform id
  from public.product_images
  where product_id = target_product_id
  order by id
  for update;

  if not exists (
    select 1
    from public.product_images
    where id = target_image_id
      and product_id = target_product_id
      and variant_id is null
  ) then
    raise exception using errcode = 'P0002',
      message = 'Choose a product gallery image.';
  end if;

  update public.product_images
  set is_primary = (id = target_image_id)
  where product_id = target_product_id
    and variant_id is null;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor,
    'catalog.primary_image_changed',
    'product',
    target_product_id,
    jsonb_build_object('image_id', target_image_id)
  );
end;
$$;

create function private.adjust_stock_internal(
  target_variant_id uuid,
  stock_delta integer,
  adjustment_reason text,
  adjustment_type public.stock_movement_type
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  stock_before integer;
  stock_after integer;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if stock_delta = 0 then
    raise exception using
      errcode = '22023',
      message = 'Stock adjustment must be nonzero.';
  end if;

  if adjustment_type not in (
    'initial'::public.stock_movement_type,
    'restock'::public.stock_movement_type,
    'correction'::public.stock_movement_type,
    'return'::public.stock_movement_type
  ) then
    raise exception using
      errcode = '22023',
      message = 'Use the payment workflow for sale deductions.';
  end if;

  if nullif(btrim(adjustment_reason), '') is null then
    raise exception using
      errcode = '22023',
      message = 'A stock-adjustment reason is required.';
  end if;

  select current_stock
  into stock_before
  from public.product_variants
  where id = target_variant_id
    and is_active
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Choose an active product variant.';
  end if;

  stock_after := stock_before + stock_delta;

  if stock_after < 0 then
    raise exception using
      errcode = '23514',
      message = 'Stock cannot become negative.';
  end if;

  update public.product_variants
  set current_stock = stock_after
  where id = target_variant_id;

  insert into public.stock_movements (
    variant_id,
    movement_type,
    quantity_before,
    quantity_delta,
    quantity_after,
    reason,
    actor_id
  )
  values (
    target_variant_id,
    adjustment_type,
    stock_before,
    stock_delta,
    stock_after,
    btrim(adjustment_reason),
    actor
  );

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    actor,
    'stock.adjusted',
    'product_variant',
    target_variant_id,
    jsonb_build_object(
      'quantity_before',
      stock_before,
      'quantity_delta',
      stock_delta,
      'quantity_after',
      stock_after,
      'movement_type',
      adjustment_type
    )
  );

  return stock_after;
end;
$$;

create function public.adjust_stock(
  variant_id uuid,
  quantity_delta integer,
  reason text,
  movement_type public.stock_movement_type
)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.adjust_stock_internal(
    variant_id,
    quantity_delta,
    reason,
    movement_type
  );
$$;

create function private.manual_stock_operation(
  operation_name text,
  target_variant_id uuid,
  requested_quantity integer,
  operation_reason text,
  operation_idempotency_key uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  normalized_reason text := nullif(btrim(operation_reason), '');
  fingerprint text;
  existing_movement record;
  stock_before integer;
  stock_delta integer;
  stock_after integer;
  movement_type public.stock_movement_type;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if operation_name not in ('add_to_count', 'reduce_by') then
    raise exception using
      errcode = '22023',
      message = 'Unknown manual stock operation.';
  end if;

  if operation_idempotency_key is null then
    raise exception using
      errcode = '22023',
      message = 'An idempotency key is required.';
  end if;

  if normalized_reason is null then
    raise exception using
      errcode = '22023',
      message = 'A stock reason is required.';
  end if;

  fingerprint := encode(
    extensions.digest(
      concat_ws(
        '|',
        operation_name,
        target_variant_id,
        requested_quantity,
        normalized_reason,
        actor
      ),
      'sha256'
    ),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(operation_idempotency_key::text, 0)
  );

  select request_fingerprint, quantity_after
  into existing_movement
  from public.stock_movements
  where idempotency_key = operation_idempotency_key;

  if found then
    if existing_movement.request_fingerprint = fingerprint then
      return existing_movement.quantity_after;
    end if;

    raise exception using
      errcode = '23505',
      message = 'This stock request key was already used for another operation.';
  end if;

  select current_stock
  into stock_before
  from public.product_variants
  where id = target_variant_id
    and is_active
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Choose an active product variant.';
  end if;

  if operation_name = 'add_to_count' then
    if requested_quantity <= stock_before then
      raise exception using
        errcode = '23514',
        message = 'New stock count must be greater than current stock.';
    end if;
    stock_after := requested_quantity;
    stock_delta := stock_after - stock_before;
    movement_type := 'restock'::public.stock_movement_type;
  else
    if requested_quantity <= 0 then
      raise exception using
        errcode = '22023',
        message = 'Quantity to remove must be a positive whole number.';
    end if;
    if requested_quantity > stock_before then
      raise exception using
        errcode = '23514',
        message = 'Quantity to remove exceeds available stock.';
    end if;
    stock_delta := -requested_quantity;
    stock_after := stock_before + stock_delta;
    movement_type := 'correction'::public.stock_movement_type;
  end if;

  update public.product_variants
  set current_stock = stock_after
  where id = target_variant_id;

  insert into public.stock_movements (
    variant_id,
    movement_type,
    quantity_before,
    quantity_delta,
    quantity_after,
    reason,
    actor_id,
    idempotency_key,
    request_fingerprint
  ) values (
    target_variant_id,
    movement_type,
    stock_before,
    stock_delta,
    stock_after,
    normalized_reason,
    actor,
    operation_idempotency_key,
    fingerprint
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor,
    case
      when operation_name = 'add_to_count' then 'stock.added'
      else 'stock.reduced'
    end,
    'product_variant',
    target_variant_id,
    jsonb_build_object(
      'quantity_before', stock_before,
      'quantity_delta', stock_delta,
      'quantity_after', stock_after,
      'idempotency_key', operation_idempotency_key
    )
  );

  return stock_after;
end;
$$;

create function public.add_stock_to_count(
  variant_id uuid,
  target_count integer,
  reason text,
  idempotency_key uuid
)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.manual_stock_operation(
    'add_to_count',
    variant_id,
    target_count,
    reason,
    idempotency_key
  );
$$;

create function public.record_stock_reduction(
  variant_id uuid,
  quantity_to_remove integer,
  reason text,
  idempotency_key uuid
)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.manual_stock_operation(
    'reduce_by',
    variant_id,
    quantity_to_remove,
    reason,
    idempotency_key
  );
$$;

create function private.variant_attribute_signature(
  target_category_id uuid,
  selected_variant_values jsonb,
  target_variant_created_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  signature text;
  selected_value record;
begin
  if jsonb_typeof(coalesce(selected_variant_values, '{}'::jsonb)) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Variant attributes must be an object.';
  end if;

  if exists (
    with category_scope as (
      select parent_id as category_id, 0 as precedence
      from public.product_categories
      where id = target_category_id
      union all
      select target_category_id, 1
    ),
    resolved as (
      select distinct on (configuration.attribute_type_id)
        configuration.attribute_type_id,
        configuration.is_required,
        configuration.is_variant_axis,
        configuration.required_from
      from category_scope
      join public.category_attributes as configuration
        on configuration.category_id = category_scope.category_id
      order by configuration.attribute_type_id, category_scope.precedence desc
    )
    select 1
    from resolved
    where is_variant_axis
      and is_required
      and (
        required_from is null
        or target_variant_created_at >= required_from
      )
      and not (
        coalesce(selected_variant_values, '{}'::jsonb)
        ? attribute_type_id::text
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Choose every required variant attribute.';
  end if;

  for selected_value in
    select key::uuid as attribute_type_id, value::uuid as attribute_value_id
    from jsonb_each_text(coalesce(selected_variant_values, '{}'::jsonb))
  loop
    if not exists (
      with category_scope as (
        select parent_id as category_id, 0 as precedence
        from public.product_categories
        where id = target_category_id
        union all
        select target_category_id, 1
      ),
      resolved as (
      select distinct on (configuration.attribute_type_id)
        configuration.attribute_type_id,
          configuration.is_variant_axis
        from category_scope
        join public.category_attributes as configuration
          on configuration.category_id = category_scope.category_id
        order by configuration.attribute_type_id, category_scope.precedence desc
      )
      select 1
      from resolved
      join public.attribute_types
        on attribute_types.id = resolved.attribute_type_id
      join public.attribute_values
        on attribute_values.attribute_type_id = resolved.attribute_type_id
       and attribute_values.id = selected_value.attribute_value_id
      where resolved.attribute_type_id = selected_value.attribute_type_id
        and resolved.is_variant_axis
    ) then
      raise exception using
        errcode = '23514',
        message = 'A selected variant value is not allowed by this category.';
    end if;
  end loop;

  select coalesce(
    string_agg(key || '=' || value, ',' order by key),
    'default'
  )
  into signature
  from jsonb_each_text(coalesce(selected_variant_values, '{}'::jsonb));

  return signature;
end;
$$;

create function private.variant_attribute_signature(
  target_category_id uuid,
  selected_variant_values jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_signature text;
  existing_variant_created_at timestamptz;
begin
  select coalesce(
    string_agg(key || '=' || value, ',' order by key),
    'default'
  )
  into raw_signature
  from jsonb_each_text(coalesce(selected_variant_values, '{}'::jsonb));

  select min(product_variants.created_at)
  into existing_variant_created_at
  from public.product_variants
  join public.products on products.id = product_variants.product_id
  where products.category_id = target_category_id
    and product_variants.attribute_signature = raw_signature;

  return private.variant_attribute_signature(
    target_category_id,
    selected_variant_values,
    coalesce(existing_variant_created_at, now())
  );
end;
$$;

create function public.bulk_assign_variant_attribute(
  target_product_id uuid,
  target_attribute_type_id uuid,
  target_attribute_value_id uuid,
  target_variant_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_category_id uuid;
  requested_count integer;
  selected_count integer;
  target_variant record;
  selected_values jsonb;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  select category_id
  into target_category_id
  from public.products
  where id = target_product_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Product not found.';
  end if;

  if not exists (
    with category_scope as (
      select parent_id as category_id, 0 as precedence
      from public.product_categories
      where id = target_category_id
      union all
      select target_category_id, 1
    ),
    resolved as (
      select distinct on (configuration.attribute_type_id)
        configuration.attribute_type_id,
        configuration.is_variant_axis
      from category_scope
      join public.category_attributes as configuration
        on configuration.category_id = category_scope.category_id
      order by configuration.attribute_type_id, category_scope.precedence desc
    )
    select 1
    from resolved
    join public.attribute_values
      on attribute_values.attribute_type_id = resolved.attribute_type_id
    where resolved.attribute_type_id = target_attribute_type_id
      and resolved.is_variant_axis
      and attribute_values.id = target_attribute_value_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Choose a variant parameter value allowed by this product category.';
  end if;

  select count(*)
  into requested_count
  from (
    select distinct unnest(coalesce(target_variant_ids, '{}'::uuid[]))
  ) as requested;

  if requested_count = 0 then
    raise exception using
      errcode = '22023',
      message = 'Choose at least one product variant.';
  end if;

  perform product_variants.id
  from public.product_variants
  join (
    select distinct unnest(target_variant_ids) as id
  ) as requested on requested.id = product_variants.id
  where product_variants.product_id = target_product_id
  order by product_variants.id
  for update of product_variants;

  get diagnostics selected_count = row_count;

  if selected_count <> requested_count then
    raise exception using
      errcode = '23514',
      message = 'Every selected variant must belong to this product.';
  end if;

  insert into public.variant_attribute_values (
    variant_id,
    attribute_type_id,
    attribute_value_id
  )
  select
    requested.id,
    target_attribute_type_id,
    target_attribute_value_id
  from (
    select distinct unnest(target_variant_ids) as id
  ) as requested
  on conflict (variant_id, attribute_type_id)
  do update set attribute_value_id = excluded.attribute_value_id;

  for target_variant in
    select id, created_at
    from public.product_variants
    where product_id = target_product_id
      and id = any(target_variant_ids)
    order by id
  loop
    select coalesce(
      jsonb_object_agg(
        variant_attribute_values.attribute_type_id::text,
        variant_attribute_values.attribute_value_id::text
      ),
      '{}'::jsonb
    )
    into selected_values
    from public.variant_attribute_values
    where variant_id = target_variant.id;

    update public.product_variants
    set attribute_signature = private.variant_attribute_signature(
      target_category_id,
      selected_values,
      target_variant.created_at
    )
    where id = target_variant.id;
  end loop;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor,
    'variant.attribute_bulk_assigned',
    'product',
    target_product_id,
    jsonb_build_object(
      'attribute_type_id', target_attribute_type_id,
      'attribute_value_id', target_attribute_value_id,
      'variant_count', selected_count
    )
  );

  return selected_count;
end;
$$;

-- Explicit product-owned option creation.
create function public.create_product_with_variants(
  target_category_id uuid,
  product_name text,
  product_brand text,
  product_description text,
  selected_product_values jsonb,
  selected_product_options jsonb,
  target_variants jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  new_product_id uuid;
  new_variant_id uuid;
  option_payload jsonb;
  variant_payload jsonb;
  variant_attributes jsonb;
  selected_value record;
  response_variants jsonb := '[]'::jsonb;
  variant_count integer;
  distinct_client_key_count integer;
  price_value bigint;
  opening_stock_value integer;
  threshold_value integer;
  normalized_sku text;
  normalized_barcode text;
  client_key text;
  attribute_signature text;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if nullif(btrim(product_name), '') is null then
    raise exception using errcode = '22023',
      message = 'Product name is required.';
  end if;

  if jsonb_typeof(coalesce(selected_product_values, '{}'::jsonb))
      <> 'object'
    or jsonb_typeof(coalesce(selected_product_options, '[]'::jsonb))
      <> 'array'
    or jsonb_typeof(target_variants) is distinct from 'array' then
    raise exception using errcode = '22023',
      message = 'Product options and stock items are invalid.';
  end if;

  if jsonb_array_length(target_variants) = 0 then
    raise exception using errcode = '22023',
      message = 'Add at least one stock item.';
  end if;

  if not exists (
    select 1 from public.product_categories
    where id = target_category_id and is_active
  ) then
    raise exception using errcode = '23503',
      message = 'Choose an active category.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(selected_product_options) as option(value)
    where jsonb_typeof(option.value) <> 'object'
      or nullif(option.value ->> 'attribute_type_id', '') is null
      or jsonb_typeof(option.value -> 'is_required') <> 'boolean'
      or jsonb_typeof(option.value -> 'is_variant_axis') <> 'boolean'
      or jsonb_typeof(option.value -> 'sort_order') <> 'number'
      or (option.value ->> 'sort_order')::integer < 0
  ) then
    raise exception using errcode = '22023',
      message = 'Every selected product option is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(selected_product_options) as option(value)
    group by option.value ->> 'attribute_type_id'
    having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'Each product option can be selected only once.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(selected_product_options) as option(value)
    where not exists (
      select 1
      from public.attribute_values
      where attribute_type_id =
        (option.value ->> 'attribute_type_id')::uuid
    )
  ) then
    raise exception using errcode = '23514',
      message = 'Every selected product option needs an allowed value.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(selected_product_options) as option(value)
    where (option.value ->> 'is_required')::boolean
      and not (option.value ->> 'is_variant_axis')::boolean
      and not (
        coalesce(selected_product_values, '{}'::jsonb)
        ? (option.value ->> 'attribute_type_id')
      )
  ) then
    raise exception using errcode = '23514',
      message = 'Choose every required product specification.';
  end if;

  for selected_value in
    select key::uuid as attribute_type_id,
      value::uuid as attribute_value_id
    from jsonb_each_text(
      coalesce(selected_product_values, '{}'::jsonb)
    )
  loop
    if not exists (
      select 1
      from jsonb_array_elements(selected_product_options) as option(value)
      join public.attribute_values
        on attribute_values.attribute_type_id =
          (option.value ->> 'attribute_type_id')::uuid
       and attribute_values.id = selected_value.attribute_value_id
      where (option.value ->> 'attribute_type_id')::uuid =
          selected_value.attribute_type_id
        and not (option.value ->> 'is_variant_axis')::boolean
    ) then
      raise exception using errcode = '23514',
        message = 'A product value belongs to an unselected option.';
    end if;
  end loop;

  select count(*), count(distinct value ->> 'client_key')
  into variant_count, distinct_client_key_count
  from jsonb_array_elements(target_variants);

  if variant_count <> distinct_client_key_count
    or exists (
      select 1 from jsonb_array_elements(target_variants)
      where jsonb_typeof(value) <> 'object'
        or nullif(btrim(value ->> 'client_key'), '') is null
    ) then
    raise exception using errcode = '23514',
      message = 'Every stock item needs a unique client key.';
  end if;

  for variant_payload in
    select value from jsonb_array_elements(target_variants)
  loop
    variant_attributes := coalesce(
      variant_payload -> 'attributes', '{}'::jsonb
    );
    if jsonb_typeof(variant_attributes) <> 'object' then
      raise exception using errcode = '22023',
        message = 'Stock item options must be an object.';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(selected_product_options) as option(value)
      where (option.value ->> 'is_required')::boolean
        and (option.value ->> 'is_variant_axis')::boolean
        and not (
          variant_attributes
          ? (option.value ->> 'attribute_type_id')
        )
    ) then
      raise exception using errcode = '23514',
        message = 'Choose every required stock-item option.';
    end if;

    for selected_value in
      select key::uuid as attribute_type_id,
        value::uuid as attribute_value_id
      from jsonb_each_text(variant_attributes)
    loop
      if not exists (
        select 1
        from jsonb_array_elements(selected_product_options)
          as option(value)
        join public.attribute_values
          on attribute_values.attribute_type_id =
            (option.value ->> 'attribute_type_id')::uuid
         and attribute_values.id =
            selected_value.attribute_value_id
        where (option.value ->> 'attribute_type_id')::uuid =
            selected_value.attribute_type_id
          and (option.value ->> 'is_variant_axis')::boolean
      ) then
        raise exception using errcode = '23514',
          message = 'A stock-item value belongs to an unselected option.';
      end if;
    end loop;
  end loop;

  insert into public.products (
    category_id, name, brand, description, created_by
  ) values (
    target_category_id, btrim(product_name),
    nullif(btrim(product_brand), ''),
    nullif(btrim(product_description), ''), actor
  )
  returning id into new_product_id;

  for option_payload in
    select value
    from jsonb_array_elements(selected_product_options)
  loop
    insert into public.product_options (
      product_id, attribute_type_id, is_required,
      is_variant_axis, sort_order, required_from, created_by
    ) values (
      new_product_id,
      (option_payload ->> 'attribute_type_id')::uuid,
      (option_payload ->> 'is_required')::boolean,
      (option_payload ->> 'is_variant_axis')::boolean,
      (option_payload ->> 'sort_order')::integer,
      case when (option_payload ->> 'is_required')::boolean
        then now() else null end,
      actor
    );
  end loop;

  for selected_value in
    select key::uuid as attribute_type_id,
      value::uuid as attribute_value_id
    from jsonb_each_text(
      coalesce(selected_product_values, '{}'::jsonb)
    )
  loop
    insert into public.product_attribute_values (
      product_id, attribute_type_id, attribute_value_id
    ) values (
      new_product_id, selected_value.attribute_type_id,
      selected_value.attribute_value_id
    );
  end loop;

  for variant_payload in
    select value from jsonb_array_elements(target_variants)
  loop
    client_key := nullif(btrim(variant_payload ->> 'client_key'), '');
    normalized_sku := upper(btrim(variant_payload ->> 'sku'));
    normalized_barcode :=
      nullif(btrim(variant_payload ->> 'barcode'), '');
    price_value := (variant_payload ->> 'price_paise')::bigint;
    opening_stock_value :=
      (variant_payload ->> 'opening_stock')::integer;
    threshold_value :=
      (variant_payload ->> 'low_stock_threshold')::integer;
    variant_attributes := coalesce(
      variant_payload -> 'attributes', '{}'::jsonb
    );

    if nullif(normalized_sku, '') is null
      or price_value is null
      or opening_stock_value is null
      or threshold_value is null then
      raise exception using errcode = '22023',
        message = 'Every stock item needs SKU, price, stock, and threshold.';
    end if;
    if price_value < 0
      or opening_stock_value < 0
      or threshold_value < 0 then
      raise exception using errcode = '23514',
        message = 'Price, stock, and threshold cannot be negative.';
    end if;

    select coalesce(
      string_agg(key || '=' || value, ',' order by key),
      'default'
    )
    into attribute_signature
    from jsonb_each_text(variant_attributes);

    insert into public.product_variants (
      product_id, sku, barcode, attribute_signature, price_paise,
      current_stock, low_stock_threshold, created_by
    ) values (
      new_product_id, normalized_sku, normalized_barcode,
      attribute_signature, price_value, opening_stock_value,
      threshold_value, actor
    )
    returning id into new_variant_id;

    for selected_value in
      select key::uuid as attribute_type_id,
        value::uuid as attribute_value_id
      from jsonb_each_text(variant_attributes)
    loop
      insert into public.variant_attribute_values (
        variant_id, attribute_type_id, attribute_value_id
      ) values (
        new_variant_id, selected_value.attribute_type_id,
        selected_value.attribute_value_id
      );
    end loop;

    if opening_stock_value > 0 then
      insert into public.stock_movements (
        variant_id, movement_type, quantity_before, quantity_delta,
        quantity_after, reason, actor_id
      ) values (
        new_variant_id, 'initial', 0, opening_stock_value,
        opening_stock_value, 'Opening stock', actor
      );
    end if;

    response_variants := response_variants || jsonb_build_array(
      jsonb_build_object(
        'client_key', client_key,
        'variant_id', new_variant_id
      )
    );
  end loop;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor, 'product.created', 'product', new_product_id,
    jsonb_build_object(
      'variant_count', variant_count,
      'product_option_count',
        jsonb_array_length(selected_product_options)
    )
  );

  return jsonb_build_object(
    'product_id', new_product_id,
    'variants', response_variants
  );
end;
$$;


create function public.create_product_with_variants(
  target_category_id uuid,
  product_name text,
  product_brand text,
  product_description text,
  selected_product_values jsonb,
  target_variants jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  new_product_id uuid;
  new_variant_id uuid;
  variant_payload jsonb;
  variant_attributes jsonb;
  selected_value record;
  response_variants jsonb := '[]'::jsonb;
  variant_count integer;
  distinct_client_key_count integer;
  price_value bigint;
  opening_stock_value integer;
  threshold_value integer;
  normalized_sku text;
  normalized_barcode text;
  client_key text;
  attribute_signature text;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if nullif(btrim(product_name), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Product name is required.';
  end if;

  if jsonb_typeof(coalesce(selected_product_values, '{}'::jsonb)) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Product specifications must be an object.';
  end if;

  if jsonb_typeof(target_variants) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'Sellable variants must be an array.';
  end if;

  if jsonb_array_length(target_variants) = 0 then
    raise exception using
      errcode = '22023',
      message = 'Add at least one sellable variant.';
  end if;

  if not exists (
    select 1
    from public.product_categories
    where id = target_category_id
      and is_active
  ) then
    raise exception using
      errcode = '23503',
      message = 'Choose an active category.';
  end if;

  if exists (
    with category_scope as (
      select parent_id as category_id, 0 as precedence
      from public.product_categories
      where id = target_category_id
      union all
      select target_category_id, 1
    ),
    resolved as (
      select distinct on (configuration.attribute_type_id)
        configuration.attribute_type_id,
        configuration.is_required,
        configuration.is_variant_axis
      from category_scope
      join public.category_attributes as configuration
        on configuration.category_id = category_scope.category_id
      order by configuration.attribute_type_id, category_scope.precedence desc
    )
    select 1
    from resolved
    where not is_variant_axis
      and is_required
      and not (
        coalesce(selected_product_values, '{}'::jsonb)
        ? attribute_type_id::text
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Choose every required product specification.';
  end if;

  for selected_value in
    select key::uuid as attribute_type_id, value::uuid as attribute_value_id
    from jsonb_each_text(coalesce(selected_product_values, '{}'::jsonb))
  loop
    if not exists (
      with category_scope as (
        select parent_id as category_id, 0 as precedence
        from public.product_categories
        where id = target_category_id
        union all
        select target_category_id, 1
      ),
      resolved as (
        select distinct on (configuration.attribute_type_id)
          configuration.attribute_type_id,
          configuration.is_variant_axis
        from category_scope
        join public.category_attributes as configuration
          on configuration.category_id = category_scope.category_id
        order by configuration.attribute_type_id, category_scope.precedence desc
      )
      select 1
      from resolved
      join public.attribute_values
        on attribute_values.attribute_type_id = resolved.attribute_type_id
       and attribute_values.id = selected_value.attribute_value_id
      where resolved.attribute_type_id = selected_value.attribute_type_id
        and not resolved.is_variant_axis
    ) then
      raise exception using
        errcode = '23514',
        message = 'A selected product specification is not allowed by this category.';
    end if;
  end loop;

  select count(*), count(distinct value ->> 'client_key')
  into variant_count, distinct_client_key_count
  from jsonb_array_elements(target_variants);

  if variant_count <> distinct_client_key_count
    or exists (
      select 1
      from jsonb_array_elements(target_variants)
      where nullif(btrim(value ->> 'client_key'), '') is null
    ) then
    raise exception using
      errcode = '23514',
      message = 'Every sellable variant needs a unique client key.';
  end if;

  insert into public.products (
    category_id,
    name,
    brand,
    description,
    created_by
  )
  values (
    target_category_id,
    btrim(product_name),
    nullif(btrim(product_brand), ''),
    nullif(btrim(product_description), ''),
    actor
  )
  returning id into new_product_id;

  for selected_value in
    select key::uuid as attribute_type_id, value::uuid as attribute_value_id
    from jsonb_each_text(coalesce(selected_product_values, '{}'::jsonb))
  loop
    insert into public.product_attribute_values (
      product_id,
      attribute_type_id,
      attribute_value_id
    )
    values (
      new_product_id,
      selected_value.attribute_type_id,
      selected_value.attribute_value_id
    );
  end loop;

  for variant_payload in
    select value from jsonb_array_elements(target_variants)
  loop
    if jsonb_typeof(variant_payload) <> 'object' then
      raise exception using
        errcode = '22023',
        message = 'Every sellable variant must be an object.';
    end if;

    client_key := nullif(btrim(variant_payload ->> 'client_key'), '');
    normalized_sku := upper(btrim(variant_payload ->> 'sku'));
    normalized_barcode := nullif(btrim(variant_payload ->> 'barcode'), '');
    price_value := (variant_payload ->> 'price_paise')::bigint;
    opening_stock_value := (variant_payload ->> 'opening_stock')::integer;
    threshold_value := (variant_payload ->> 'low_stock_threshold')::integer;
    variant_attributes := coalesce(
      variant_payload -> 'attributes',
      '{}'::jsonb
    );

    if nullif(normalized_sku, '') is null then
      raise exception using
        errcode = '22023',
        message = 'Every sellable variant needs a SKU.';
    end if;

    if price_value is null
      or opening_stock_value is null
      or threshold_value is null then
      raise exception using
        errcode = '22023',
        message = 'Every sellable variant needs price, stock, and threshold values.';
    end if;

    if price_value < 0
      or opening_stock_value < 0
      or threshold_value < 0 then
      raise exception using
        errcode = '23514',
        message = 'Price, stock, and threshold cannot be negative.';
    end if;

    attribute_signature := private.variant_attribute_signature(
      target_category_id,
      variant_attributes
    );

    insert into public.product_variants (
      product_id,
      sku,
      barcode,
      attribute_signature,
      price_paise,
      current_stock,
      low_stock_threshold,
      created_by
    )
    values (
      new_product_id,
      normalized_sku,
      normalized_barcode,
      attribute_signature,
      price_value,
      opening_stock_value,
      threshold_value,
      actor
    )
    returning id into new_variant_id;

    for selected_value in
      select key::uuid as attribute_type_id, value::uuid as attribute_value_id
      from jsonb_each_text(variant_attributes)
    loop
      insert into public.variant_attribute_values (
        variant_id,
        attribute_type_id,
        attribute_value_id
      )
      values (
        new_variant_id,
        selected_value.attribute_type_id,
        selected_value.attribute_value_id
      );
    end loop;

    if opening_stock_value > 0 then
      insert into public.stock_movements (
        variant_id,
        movement_type,
        quantity_before,
        quantity_delta,
        quantity_after,
        reason,
        actor_id
      )
      values (
        new_variant_id,
        'initial',
        0,
        opening_stock_value,
        opening_stock_value,
        'Opening stock',
        actor
      );
    end if;

    response_variants := response_variants || jsonb_build_array(
      jsonb_build_object(
        'client_key', client_key,
        'variant_id', new_variant_id
      )
    );
  end loop;

  insert into public.product_options (
    product_id,
    attribute_type_id,
    is_required,
    is_variant_axis,
    sort_order,
    required_from,
    created_by
  )
  select
    new_product_id,
    submitted.attribute_type_id,
    coalesce(configuration.is_required, true),
    submitted.is_variant_axis,
    coalesce(configuration.sort_order, submitted.sort_order),
    case
      when coalesce(configuration.is_required, true) then now()
      else null
    end,
    actor
  from (
    select
      key::uuid as attribute_type_id,
      false as is_variant_axis,
      row_number() over (order by key)::integer - 1 as sort_order
    from jsonb_each_text(
      coalesce(selected_product_values, '{}'::jsonb)
    )
    union
    select
      variant_key.key::uuid,
      true,
      row_number() over (order by variant_key.key)::integer - 1
    from jsonb_array_elements(target_variants) as variants(value)
    cross join lateral jsonb_each_text(
      coalesce(variants.value -> 'attributes', '{}'::jsonb)
    ) as variant_key
  ) as submitted
  left join lateral (
    select
      category_attributes.is_required,
      category_attributes.sort_order
    from public.category_attributes
    where category_attributes.attribute_type_id =
        submitted.attribute_type_id
      and category_attributes.category_id in (
        target_category_id,
        (
          select parent_id
          from public.product_categories
          where id = target_category_id
        )
      )
    order by
      (category_attributes.category_id = target_category_id) desc
    limit 1
  ) as configuration on true
  on conflict (product_id, attribute_type_id) do nothing;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  )
  values (
    actor,
    'product.created',
    'product',
    new_product_id,
    jsonb_build_object('variant_count', variant_count)
  );

  return jsonb_build_object(
    'product_id', new_product_id,
    'variants', response_variants
  );
end;
$$;

create function public.update_product(
  product_id uuid,
  category_id uuid,
  product_name text,
  product_brand text,
  product_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  variant_row record;
  selected_values jsonb;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if nullif(btrim(product_name), '') is null then
    raise exception using errcode = '22023',
      message = 'Product name is required.';
  end if;

  if not exists (
    select 1 from public.product_categories
    where id = category_id and is_active
  ) then
    raise exception using errcode = '23503',
      message = 'Choose an active category.';
  end if;

  if not exists (
    select 1
    from public.products
    where products.id = update_product.product_id
  ) then
    raise exception using errcode = 'P0002',
      message = 'Product not found.';
  end if;

  for variant_row in
    select id, created_at
    from public.product_variants
    where product_variants.product_id = update_product.product_id
  loop
    select coalesce(
      jsonb_object_agg(attribute_type_id::text, attribute_value_id::text),
      '{}'::jsonb
    )
    into selected_values
    from public.variant_attribute_values
    where variant_id = variant_row.id;

    perform private.variant_attribute_signature(
      category_id,
      selected_values,
      variant_row.created_at
    );
  end loop;

  update public.products
  set category_id = update_product.category_id,
      name = btrim(product_name),
      brand = nullif(btrim(product_brand), ''),
      description = nullif(btrim(product_description), '')
  where products.id = update_product.product_id;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor, 'product.updated', 'product', product_id,
    jsonb_build_object('category_id', category_id)
  );
end;
$$;

create function public.add_product_variant(
  product_id uuid,
  variant_sku text,
  variant_barcode text,
  variant_price_paise bigint,
  variant_low_stock_threshold integer,
  opening_stock integer,
  selected_variant_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_category_id uuid;
  new_variant_id uuid;
  signature text;
  selected_value record;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if nullif(btrim(variant_sku), '') is null then
    raise exception using errcode = '22023', message = 'SKU is required.';
  end if;

  if variant_price_paise < 0
    or variant_low_stock_threshold < 0
    or opening_stock < 0 then
    raise exception using errcode = '23514',
      message = 'Price, threshold, and opening stock cannot be negative.';
  end if;

  select category_id into target_category_id
  from public.products
  where products.id = add_product_variant.product_id
    and products.is_active
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'Choose an active product.';
  end if;

  signature := private.variant_attribute_signature(
    target_category_id,
    selected_variant_values
  );

  insert into public.product_variants (
    product_id, sku, barcode, attribute_signature, price_paise,
    low_stock_threshold, created_by
  ) values (
    product_id, upper(btrim(variant_sku)),
    nullif(btrim(variant_barcode), ''), signature, variant_price_paise,
    variant_low_stock_threshold, actor
  )
  returning id into new_variant_id;

  for selected_value in
    select key::uuid as attribute_type_id, value::uuid as attribute_value_id
    from jsonb_each_text(coalesce(selected_variant_values, '{}'::jsonb))
  loop
    insert into public.variant_attribute_values (
      variant_id, attribute_type_id, attribute_value_id
    ) values (
      new_variant_id,
      selected_value.attribute_type_id,
      selected_value.attribute_value_id
    );
  end loop;

  if opening_stock > 0 then
    perform private.adjust_stock_internal(
      new_variant_id, opening_stock, 'Opening stock', 'initial'
    );
  end if;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor, 'variant.created', 'product_variant', new_variant_id,
    jsonb_build_object('product_id', product_id)
  );

  return new_variant_id;
end;
$$;

create function public.update_product_variant(
  variant_id uuid,
  variant_sku text,
  variant_barcode text,
  variant_price_paise bigint,
  variant_low_stock_threshold integer,
  selected_variant_values jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_category_id uuid;
  target_variant_created_at timestamptz;
  signature text;
  selected_value record;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if nullif(btrim(variant_sku), '') is null
    or variant_price_paise < 0
    or variant_low_stock_threshold < 0 then
    raise exception using errcode = '23514',
      message = 'Enter a valid SKU, price, and low-stock threshold.';
  end if;

  select products.category_id, product_variants.created_at
  into target_category_id, target_variant_created_at
  from public.product_variants
  join public.products on products.id = product_variants.product_id
  where product_variants.id = update_product_variant.variant_id
  for update of product_variants;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'Product variant not found.';
  end if;

  signature := private.variant_attribute_signature(
    target_category_id,
    selected_variant_values,
    target_variant_created_at
  );

  update public.product_variants
  set sku = upper(btrim(variant_sku)),
      barcode = nullif(btrim(variant_barcode), ''),
      attribute_signature = signature,
      price_paise = variant_price_paise,
      low_stock_threshold = variant_low_stock_threshold
  where product_variants.id = update_product_variant.variant_id;

  delete from public.variant_attribute_values
  where variant_attribute_values.variant_id = update_product_variant.variant_id;

  for selected_value in
    select key::uuid as attribute_type_id, value::uuid as attribute_value_id
    from jsonb_each_text(coalesce(selected_variant_values, '{}'::jsonb))
  loop
    insert into public.variant_attribute_values (
      variant_id, attribute_type_id, attribute_value_id
    ) values (
      update_product_variant.variant_id,
      selected_value.attribute_type_id,
      selected_value.attribute_value_id
    );
  end loop;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor, 'variant.updated', 'product_variant', variant_id, '{}'::jsonb
  );
end;
$$;

create function public.set_product_active(product_id uuid, active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_category_id uuid;
  variant_row record;
  selected_values jsonb;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  select category_id into target_category_id
  from public.products
  where products.id = set_product_active.product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Product not found.';
  end if;

  if active and not exists (
    select 1 from public.product_categories
    where id = target_category_id and is_active
  ) then
    raise exception using errcode = '23514',
      message = 'Restore the product category first.';
  end if;

  if active then
    for variant_row in
      select id, created_at
      from public.product_variants
      where product_variants.product_id = set_product_active.product_id
    loop
      select coalesce(
        jsonb_object_agg(attribute_type_id::text, attribute_value_id::text),
        '{}'::jsonb
      )
      into selected_values
      from public.variant_attribute_values
      where variant_attribute_values.variant_id = variant_row.id;

      perform private.variant_attribute_signature(
        target_category_id,
        selected_values,
        variant_row.created_at
      );
    end loop;
  end if;

  update public.products
  set is_active = active,
      archived_at = case when active then null else now() end
  where products.id = set_product_active.product_id;

  update public.product_variants
  set is_active = active,
      archived_at = case when active then null else now() end
  where product_variants.product_id = set_product_active.product_id;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor,
    case when active then 'product.restored' else 'product.archived' end,
    'product', product_id, '{}'::jsonb
  );
end;
$$;

create function public.set_variant_active(variant_id uuid, active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  owner_product_id uuid;
  product_active boolean;
  target_category_id uuid;
  target_variant_created_at timestamptz;
  selected_values jsonb;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  select
    product_variants.product_id,
    products.is_active,
    products.category_id,
    product_variants.created_at
  into
    owner_product_id,
    product_active,
    target_category_id,
    target_variant_created_at
  from public.product_variants
  join public.products on products.id = product_variants.product_id
  where product_variants.id = set_variant_active.variant_id
  for update of product_variants;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'Product variant not found.';
  end if;

  if active and not product_active then
    raise exception using errcode = '23514',
      message = 'Restore the product before restoring a variant.';
  end if;

  if active then
    select coalesce(
      jsonb_object_agg(attribute_type_id::text, attribute_value_id::text),
      '{}'::jsonb
    )
    into selected_values
    from public.variant_attribute_values
    where variant_attribute_values.variant_id = set_variant_active.variant_id;

    perform private.variant_attribute_signature(
      target_category_id,
      selected_values,
      target_variant_created_at
    );
  end if;

  if not active and product_active and not exists (
    select 1
    from public.product_variants
    where product_id = owner_product_id
      and id <> set_variant_active.variant_id
      and is_active
  ) then
    raise exception using errcode = '23514',
      message = 'An active product must keep at least one active variant.';
  end if;

  update public.product_variants
  set is_active = active,
      archived_at = case when active then null else now() end
  where product_variants.id = set_variant_active.variant_id;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor,
    case when active then 'variant.restored' else 'variant.archived' end,
    'product_variant', variant_id,
    jsonb_build_object('product_id', owner_product_id)
  );
end;
$$;

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
returns jsonb
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

  return jsonb_build_object(
    'order', private.frozen_order_json(target_order_id),
    'paymentAttemptId', (
      select id from public.payment_attempts
      where order_id = target_order_id and status = 'pending'
        and provider_checkout_id is not null
      order by created_at desc
      limit 1
    ),
    'expiresAt', (select expires_at from public.orders where id = target_order_id)
  );
end;
$$;

create trigger profiles_set_updated_at
before update on private.profiles
for each row
execute function private.set_updated_at();

create trigger product_categories_set_updated_at
before update on public.product_categories
for each row
execute function private.set_updated_at();

create trigger product_categories_enforce_depth
before insert or update of parent_id on public.product_categories
for each row
execute function private.enforce_category_depth();

create trigger attribute_types_set_updated_at
before update on public.attribute_types
for each row
execute function private.set_updated_at();

create trigger attribute_values_set_updated_at
before update on public.attribute_values
for each row
execute function private.set_updated_at();

create trigger category_attributes_set_updated_at
before update on public.category_attributes
for each row
execute function private.set_updated_at();

create trigger product_options_set_updated_at
before update on public.product_options
for each row
execute function private.set_updated_at();

create trigger category_attributes_set_required_from
before insert or update of is_required on public.category_attributes
for each row
execute function private.set_category_attribute_required_from();

create trigger category_attributes_protect_delete
before delete on public.category_attributes
for each row
execute function private.protect_category_attribute_delete();

create trigger products_set_updated_at
before update on public.products
for each row
execute function private.set_updated_at();

create trigger product_variants_set_updated_at
before update on public.product_variants
for each row
execute function private.set_updated_at();

create trigger product_images_set_updated_at
before update on public.product_images
for each row
execute function private.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row
execute function private.set_updated_at();

create trigger payment_attempts_set_updated_at
before update on public.payment_attempts
for each row
execute function private.set_updated_at();

create trigger stock_reservations_set_updated_at
before update on public.stock_reservations
for each row
execute function private.set_updated_at();

create trigger payment_handoffs_set_updated_at
before update on private.payment_handoffs
for each row
execute function private.set_updated_at();

create trigger store_manager_invitations_set_updated_at
before update on private.store_manager_invitations
for each row
execute function private.set_updated_at();

create trigger create_profile_and_default_role
after insert on auth.users
for each row
execute function private.handle_new_auth_user();

create trigger audit_events_are_append_only
before update or delete on public.audit_events
for each row
execute function private.prevent_row_mutation();

create trigger order_lines_are_immutable
before update or delete on public.order_lines
for each row
execute function private.prevent_row_mutation();

create trigger stock_movements_are_append_only
before update or delete on public.stock_movements
for each row
execute function private.prevent_row_mutation();

create trigger processed_webhooks_are_append_only
before update or delete on private.processed_webhooks
for each row
execute function private.prevent_row_mutation();

alter table private.profiles enable row level security;
alter table private.profiles force row level security;

alter table private.user_roles enable row level security;
alter table private.user_roles force row level security;

alter table private.store_manager_invitations enable row level security;
alter table private.store_manager_invitations force row level security;

alter table private.processed_webhooks enable row level security;
alter table private.processed_webhooks force row level security;

alter table private.payment_handoffs enable row level security;
alter table private.payment_handoffs force row level security;

alter table public.product_categories enable row level security;
alter table public.product_categories force row level security;

alter table public.attribute_types enable row level security;
alter table public.attribute_types force row level security;

alter table public.attribute_values enable row level security;
alter table public.attribute_values force row level security;

alter table public.category_attributes enable row level security;
alter table public.category_attributes force row level security;

alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

alter table public.products enable row level security;
alter table public.products force row level security;

alter table public.product_options enable row level security;
alter table public.product_options force row level security;

alter table public.product_attribute_values enable row level security;
alter table public.product_attribute_values force row level security;

alter table public.product_variants enable row level security;
alter table public.product_variants force row level security;

alter table public.product_images enable row level security;
alter table public.product_images force row level security;

alter table public.variant_attribute_values enable row level security;
alter table public.variant_attribute_values force row level security;

alter table public.orders enable row level security;
alter table public.orders force row level security;

alter table public.order_lines enable row level security;
alter table public.order_lines force row level security;

alter table public.stock_movements enable row level security;
alter table public.stock_movements force row level security;

alter table public.payment_attempts enable row level security;
alter table public.payment_attempts force row level security;

alter table public.stock_reservations enable row level security;
alter table public.stock_reservations force row level security;

create policy audit_events_select
on public.audit_events
for select
to authenticated
using (
  actor_id = (select auth.uid())
  or (select private.has_role('super_admin'::public.app_role))
);

create policy product_categories_select
on public.product_categories
for select
to authenticated
using (
  is_active
  or (select private.is_store_operator())
);

create policy product_categories_manage
on public.product_categories
for all
to authenticated
using ((select private.is_store_operator()))
with check ((select private.is_store_operator()));

create policy attribute_types_select
on public.attribute_types
for select
to authenticated
using (true);

create policy attribute_types_manage
on public.attribute_types
for all
to authenticated
using ((select private.is_store_operator()))
with check ((select private.is_store_operator()));

create policy attribute_values_select
on public.attribute_values
for select
to authenticated
using (true);

create policy attribute_values_manage
on public.attribute_values
for all
to authenticated
using ((select private.is_store_operator()))
with check ((select private.is_store_operator()));

create policy category_attributes_select
on public.category_attributes
for select
to authenticated
using (true);

create policy category_attributes_manage
on public.category_attributes
for all
to authenticated
using ((select private.is_store_operator()))
with check ((select private.is_store_operator()));

create policy products_select
on public.products
for select
to authenticated
using (
  is_active
  or (select private.is_store_operator())
);

create policy products_insert
on public.products
for insert
to authenticated
with check (
  (select private.is_store_operator())
  and created_by = (select auth.uid())
);

create policy products_update
on public.products
for update
to authenticated
using ((select private.is_store_operator()))
with check ((select private.is_store_operator()));

create policy product_options_select
on public.product_options
for select
to authenticated
using (true);

create policy product_options_manage
on public.product_options
for all
to authenticated
using ((select private.is_store_operator()))
with check ((select private.is_store_operator()));

create policy product_attribute_values_select
on public.product_attribute_values
for select
to authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = product_attribute_values.product_id
      and (products.is_active or (select private.is_store_operator()))
  )
);

create policy product_attribute_values_manage
on public.product_attribute_values
for all
to authenticated
using ((select private.is_store_operator()))
with check ((select private.is_store_operator()));

create policy product_variants_select
on public.product_variants
for select
to authenticated
using (
  is_active
  or (select private.is_store_operator())
);

create policy product_variants_manage
on public.product_variants
for all
to authenticated
using ((select private.is_store_operator()))
with check ((select private.is_store_operator()));

create policy product_images_select
on public.product_images
for select
to anon, authenticated
using (true);

create policy product_images_manage
on public.product_images
for all
to authenticated
using ((select private.is_store_operator()))
with check ((select private.is_store_operator()));

create policy variant_attribute_values_select
on public.variant_attribute_values
for select
to authenticated
using (
  exists (
    select 1
    from public.product_variants
    where product_variants.id = variant_attribute_values.variant_id
      and (
        product_variants.is_active
        or (select private.is_store_operator())
      )
  )
);

create policy variant_attribute_values_manage
on public.variant_attribute_values
for all
to authenticated
using ((select private.is_store_operator()))
with check ((select private.is_store_operator()));

create policy orders_select
on public.orders
for select
to authenticated
using (
  created_by = (select auth.uid())
  or student_id = (select auth.uid())
  or (select private.is_store_operator())
);

create policy order_lines_select
on public.order_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_lines.order_id
      and (
        orders.created_by = (select auth.uid())
        or orders.student_id = (select auth.uid())
        or (select private.is_store_operator())
      )
  )
);

create policy stock_movements_select
on public.stock_movements
for select
to authenticated
using ((select private.is_store_operator()));

create policy stock_reservations_select
on public.stock_reservations
for select
to authenticated
using ((select private.is_store_operator()));

-- Authenticated claimants read payment status only through purpose-built
-- handoff functions, never by querying stored checkout URLs or reconciliation
-- internals directly. Direct reads are therefore store-operator-only.
create policy payment_attempts_select
on public.payment_attempts
for select
to authenticated
using ((select private.is_store_operator()));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy product_images_storage_select
on storage.objects
for select
to public
using (bucket_id = 'product-images');

create policy product_images_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'products'
  and (select private.is_store_operator())
);

create policy product_images_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'products'
  and (select private.is_store_operator())
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'products'
  and (select private.is_store_operator())
);

create policy product_images_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'products'
  and (select private.is_store_operator())
);

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.current_user_roles() from public, anon;
revoke all on function public.authorize_user_roles(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.request_store_manager_access(text, text)
  from public, anon;
revoke all on function public.list_store_manager_access()
  from public, anon;
revoke all on function public.remove_store_manager_access(uuid)
  from public, anon;
revoke all on function public.cancel_store_manager_invitation(text)
  from public, anon;
revoke all on function public.mark_store_manager_invitation_resent(text)
  from public, anon;
revoke all on function public.mark_store_manager_invitation_failed(text, text)
  from public, anon;

revoke all on public.product_categories from public, anon, authenticated;
revoke all on public.attribute_types from public, anon, authenticated;
revoke all on public.attribute_values from public, anon, authenticated;
revoke all on public.category_attributes from public, anon, authenticated;
revoke all on public.audit_events from public, anon, authenticated;
revoke all on public.products from public, anon, authenticated;
revoke all on public.product_attribute_values from public, anon, authenticated;
revoke all on public.product_variants from public, anon, authenticated;
revoke all on public.product_images from public, anon, authenticated;
revoke all on public.variant_attribute_values from public, anon, authenticated;
revoke all on public.orders from public, anon, authenticated;
revoke all on public.order_lines from public, anon, authenticated;
revoke all on public.stock_movements from public, anon, authenticated;
revoke all on public.stock_reservations from public, anon, authenticated;
revoke all on public.payment_attempts from public, anon, authenticated;

grant select on public.audit_events to authenticated;

grant select, insert, update on public.product_categories to authenticated;
grant select on public.attribute_types to authenticated;
grant insert (name, slug, created_by)
  on public.attribute_types to authenticated;
grant update (name, slug)
  on public.attribute_types to authenticated;
grant select on public.attribute_values to authenticated;
grant insert (
  attribute_type_id,
  value,
  sort_order,
  created_by
) on public.attribute_values to authenticated;
grant update (value, sort_order)
  on public.attribute_values to authenticated;
grant select on public.category_attributes to authenticated;
grant insert (
  category_id,
  attribute_type_id,
  is_required,
  is_variant_axis,
  sort_order,
  created_by
) on public.category_attributes to authenticated;
grant update (is_required, is_variant_axis, sort_order)
  on public.category_attributes to authenticated;
grant delete on public.category_attributes to authenticated;

grant select on public.products to authenticated;
grant insert (
  category_id,
  name,
  brand,
  description,
  is_active,
  created_by,
  archived_at
) on public.products to authenticated;
grant update (
  category_id,
  name,
  brand,
  description,
  is_active,
  archived_at
) on public.products to authenticated;

grant select, insert, update, delete
  on public.product_options to authenticated;
grant select, insert, update, delete
  on public.product_attribute_values to authenticated;
grant select on public.product_variants to authenticated;
grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;
grant insert (
  product_id,
  sku,
  barcode,
  attribute_signature,
  price_paise,
  low_stock_threshold,
  is_active,
  created_by,
  archived_at
) on public.product_variants to authenticated;
grant update (
  sku,
  barcode,
  attribute_signature,
  price_paise,
  low_stock_threshold,
  is_active,
  archived_at
) on public.product_variants to authenticated;
grant select, insert, update, delete
  on public.variant_attribute_values to authenticated;

grant select on public.orders to authenticated;
grant select on public.order_lines to authenticated;
grant select on public.stock_movements to authenticated;
grant select on public.stock_reservations to authenticated;
grant select on public.payment_attempts to authenticated;

grant execute on function private.has_role(public.app_role)
  to authenticated, service_role;
grant execute on function private.is_store_operator()
  to authenticated, service_role;
grant execute on function public.current_user_roles()
  to authenticated, service_role;
grant execute on function public.authorize_user_roles(uuid, boolean)
  to service_role;
grant execute on function public.request_store_manager_access(text, text)
  to authenticated, service_role;
grant execute on function public.list_store_manager_access()
  to authenticated, service_role;
grant execute on function public.remove_store_manager_access(uuid)
  to authenticated, service_role;
grant execute on function public.cancel_store_manager_invitation(text)
  to authenticated, service_role;
grant execute on function public.mark_store_manager_invitation_resent(text)
  to authenticated, service_role;
grant execute on function public.mark_store_manager_invitation_failed(text, text)
  to authenticated, service_role;
grant execute on function public.get_catalog_option_usage(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.get_category_option_usage(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.update_category_inline(
  uuid, text, uuid, text
) to authenticated, service_role;
grant execute on function public.update_catalog_option_inline(
  uuid, uuid, text, jsonb, boolean, boolean, integer
) to authenticated, service_role;
grant execute on function public.remove_attribute_value(uuid)
  to authenticated, service_role;
grant execute on function public.remove_category_attribute(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.remove_attribute_type(uuid)
  to authenticated, service_role;
grant execute on function public.create_category_with_parameters(
  text,
  uuid,
  text,
  jsonb
) to authenticated, service_role;
grant execute on function public.add_product_option_to_category(
  uuid,
  uuid,
  text,
  jsonb
) to authenticated, service_role;
grant execute on function public.add_category_parameter_inline(
  uuid,
  uuid,
  text,
  jsonb,
  boolean,
  boolean,
  integer
) to authenticated, service_role;
grant execute on function public.set_primary_product_image(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.adjust_stock_internal(
  uuid,
  integer,
  text,
  public.stock_movement_type
) to service_role;
grant execute on function public.adjust_stock(
  uuid,
  integer,
  text,
  public.stock_movement_type
) to authenticated, service_role;
grant execute on function public.add_stock_to_count(
  uuid,
  integer,
  text,
  uuid
) to authenticated, service_role;
grant execute on function public.record_stock_reduction(
  uuid,
  integer,
  text,
  uuid
) to authenticated, service_role;
grant execute on function public.bulk_assign_variant_attribute(
  uuid,
  uuid,
  uuid,
  uuid[]
) to authenticated, service_role;
grant execute on function public.create_product_with_variants(
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb
) to authenticated, service_role;
grant execute on function public.create_product_with_variants(
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) to authenticated, service_role;
grant execute on function public.update_product(
  uuid, uuid, text, text, text
) to authenticated, service_role;
grant execute on function public.add_product_variant(
  uuid, text, text, bigint, integer, integer, jsonb
) to authenticated, service_role;
grant execute on function public.update_product_variant(
  uuid, text, text, bigint, integer, jsonb
) to authenticated, service_role;
grant execute on function public.set_product_active(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.set_variant_active(uuid, boolean)
  to authenticated, service_role;

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

grant execute on function private.hook_restrict_college_signup(jsonb)
  to supabase_auth_admin;

revoke execute on function public.adjust_stock(
  uuid,
  integer,
  text,
  public.stock_movement_type
) from public, anon;
revoke execute on function public.add_stock_to_count(
  uuid,
  integer,
  text,
  uuid
) from public, anon;
revoke execute on function public.record_stock_reduction(
  uuid,
  integer,
  text,
  uuid
) from public, anon;
revoke execute on function public.get_catalog_option_usage(uuid, uuid)
  from public, anon;
revoke execute on function public.get_category_option_usage(uuid, uuid)
  from public, anon;
revoke execute on function public.update_category_inline(
  uuid, text, uuid, text
) from public, anon;
revoke execute on function public.update_catalog_option_inline(
  uuid, uuid, text, jsonb, boolean, boolean, integer
) from public, anon;
revoke execute on function public.remove_attribute_value(uuid)
  from public, anon;
revoke execute on function public.remove_category_attribute(uuid, uuid)
  from public, anon;
revoke execute on function public.remove_attribute_type(uuid)
  from public, anon;
revoke execute on function public.create_category_with_parameters(
  text,
  uuid,
  text,
  jsonb
) from public, anon;
revoke execute on function public.add_product_option_to_category(
  uuid,
  uuid,
  text,
  jsonb
) from public, anon;
revoke execute on function public.add_category_parameter_inline(
  uuid,
  uuid,
  text,
  jsonb,
  boolean,
  boolean,
  integer
) from public, anon;
revoke execute on function public.set_primary_product_image(uuid, uuid)
  from public, anon;
revoke execute on function public.bulk_assign_variant_attribute(
  uuid,
  uuid,
  uuid,
  uuid[]
) from public, anon;
revoke execute on function public.create_product_with_variants(
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb
) from public, anon;
revoke execute on function public.create_product_with_variants(
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) from public, anon;
revoke execute on function public.update_product(
  uuid, uuid, text, text, text
) from public, anon;
revoke execute on function public.add_product_variant(
  uuid, text, text, bigint, integer, integer, jsonb
) from public, anon;
revoke execute on function public.update_product_variant(
  uuid, text, text, bigint, integer, jsonb
) from public, anon;
revoke execute on function public.set_product_active(uuid, boolean)
  from public, anon;
revoke execute on function public.set_variant_active(uuid, boolean)
  from public, anon;

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
