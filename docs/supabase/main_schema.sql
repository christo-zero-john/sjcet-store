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
  is_active boolean not null default true,
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
  is_active boolean not null default true,
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
  is_active boolean not null default true,
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
  category_id uuid not null
    references public.product_categories (id) on delete restrict,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_archive_consistent check (
    (is_active and archived_at is null)
    or (not is_active and archived_at is not null)
  )
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
  constraint product_variants_signature_not_blank
    check (btrim(attribute_signature) <> ''),
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
  paid_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_currency_inr check (currency = 'INR'),
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
  failure_code text,
  failure_message text,
  succeeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_amount_nonnegative check (amount_paise >= 0),
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

create index product_variants_low_stock_idx
  on public.product_variants (current_stock, low_stock_threshold)
  where is_active;

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

create index payment_attempts_order_created_idx
  on public.payment_attempts (order_id, created_at desc);

create unique index payment_attempts_provider_checkout_unique
  on public.payment_attempts (provider, provider_checkout_id)
  where provider_checkout_id is not null;

create unique index payment_attempts_provider_payment_unique
  on public.payment_attempts (provider, provider_payment_id)
  where provider_payment_id is not null;

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
  select role
  from private.user_roles
  where user_id = (select auth.uid())
  order by role;
$$;

create function public.authorize_user_roles(
  target_user_id uuid,
  grant_configured_super_admin boolean
)
returns setof public.app_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
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

  return array(
    select user_roles.role
    from private.user_roles
    where user_roles.user_id = target_user_id
    order by user_roles.role
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
        configuration.is_active
      from category_scope
      join public.category_attributes as configuration
        on configuration.category_id = category_scope.category_id
      order by configuration.attribute_type_id, category_scope.precedence desc
    )
    select 1
    from resolved
    where is_active
      and is_variant_axis
      and is_required
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
          configuration.is_variant_axis,
          configuration.is_active
        from category_scope
        join public.category_attributes as configuration
          on configuration.category_id = category_scope.category_id
        order by configuration.attribute_type_id, category_scope.precedence desc
      )
      select 1
      from resolved
      join public.attribute_types
        on attribute_types.id = resolved.attribute_type_id
       and attribute_types.is_active
      join public.attribute_values
        on attribute_values.attribute_type_id = resolved.attribute_type_id
       and attribute_values.id = selected_value.attribute_value_id
       and attribute_values.is_active
      where resolved.attribute_type_id = selected_value.attribute_type_id
        and resolved.is_active
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

create function public.create_product_with_variant(
  category_id uuid,
  product_name text,
  product_description text,
  variant_sku text,
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
  new_product_id uuid;
  new_variant_id uuid;
  attribute_signature text;
  selected_value record;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if nullif(btrim(product_name), '') is null
    or nullif(btrim(variant_sku), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Product name and SKU are required.';
  end if;

  if variant_price_paise < 0
    or variant_low_stock_threshold < 0
    or opening_stock < 0 then
    raise exception using
      errcode = '23514',
      message = 'Price, threshold, and opening stock cannot be negative.';
  end if;

  if not exists (
    select 1
    from public.product_categories
    where id = category_id
      and is_active
  ) then
    raise exception using
      errcode = '23503',
      message = 'Choose an active category.';
  end if;

  attribute_signature := private.variant_attribute_signature(
    category_id,
    selected_variant_values
  );

  insert into public.products (
    category_id,
    name,
    description,
    created_by
  )
  values (
    category_id,
    btrim(product_name),
    nullif(btrim(product_description), ''),
    actor
  )
  returning id into new_product_id;

  insert into public.product_variants (
    product_id,
    sku,
    attribute_signature,
    price_paise,
    low_stock_threshold,
    created_by
  )
  values (
    new_product_id,
    upper(btrim(variant_sku)),
    attribute_signature,
    variant_price_paise,
    variant_low_stock_threshold,
    actor
  )
  returning id into new_variant_id;

  for selected_value in
    select key::uuid as attribute_type_id, value::uuid as attribute_value_id
    from jsonb_each_text(coalesce(selected_variant_values, '{}'::jsonb))
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

  if opening_stock > 0 then
    update public.product_variants
    set current_stock = opening_stock
    where id = new_variant_id;

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
      opening_stock,
      opening_stock,
      'Opening stock',
      actor
    );
  end if;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    actor,
    'product.created',
    'product',
    new_product_id,
    jsonb_build_object('variant_id', new_variant_id)
  );

  return new_product_id;
end;
$$;

create function public.update_product(
  product_id uuid,
  category_id uuid,
  product_name text,
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
    select id from public.product_variants where product_variants.product_id = update_product.product_id
  loop
    select coalesce(
      jsonb_object_agg(attribute_type_id::text, attribute_value_id::text),
      '{}'::jsonb
    )
    into selected_values
    from public.variant_attribute_values
    where variant_id = variant_row.id;

    perform private.variant_attribute_signature(category_id, selected_values);
  end loop;

  update public.products
  set category_id = update_product.category_id,
      name = btrim(product_name),
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
    product_id, sku, attribute_signature, price_paise,
    low_stock_threshold, created_by
  ) values (
    product_id, upper(btrim(variant_sku)), signature, variant_price_paise,
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

  select products.category_id into target_category_id
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
    selected_variant_values
  );

  update public.product_variants
  set sku = upper(btrim(variant_sku)),
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
      select id
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
        selected_values
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
  selected_values jsonb;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  select
    product_variants.product_id,
    products.is_active,
    products.category_id
  into owner_product_id, product_active, target_category_id
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
      selected_values
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

create trigger products_set_updated_at
before update on public.products
for each row
execute function private.set_updated_at();

create trigger product_variants_set_updated_at
before update on public.product_variants
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

alter table private.processed_webhooks enable row level security;
alter table private.processed_webhooks force row level security;

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

alter table public.product_attribute_values enable row level security;
alter table public.product_attribute_values force row level security;

alter table public.product_variants enable row level security;
alter table public.product_variants force row level security;

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
using (
  is_active
  or (select private.is_store_operator())
);

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
using (
  is_active
  or (select private.is_store_operator())
);

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
using (
  is_active
  or (select private.is_store_operator())
);

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

create policy payment_attempts_select
on public.payment_attempts
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = payment_attempts.order_id
      and (
        orders.created_by = (select auth.uid())
        or orders.student_id = (select auth.uid())
        or (select private.is_store_operator())
      )
  )
);

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.current_user_roles() from public, anon;
revoke all on function public.authorize_user_roles(uuid, boolean)
  from public, anon, authenticated;

revoke all on public.product_categories from public, anon, authenticated;
revoke all on public.attribute_types from public, anon, authenticated;
revoke all on public.attribute_values from public, anon, authenticated;
revoke all on public.category_attributes from public, anon, authenticated;
revoke all on public.audit_events from public, anon, authenticated;
revoke all on public.products from public, anon, authenticated;
revoke all on public.product_attribute_values from public, anon, authenticated;
revoke all on public.product_variants from public, anon, authenticated;
revoke all on public.variant_attribute_values from public, anon, authenticated;
revoke all on public.orders from public, anon, authenticated;
revoke all on public.order_lines from public, anon, authenticated;
revoke all on public.stock_movements from public, anon, authenticated;
revoke all on public.payment_attempts from public, anon, authenticated;

grant select on public.audit_events to authenticated;

grant select, insert, update on public.product_categories to authenticated;
grant select on public.attribute_types to authenticated;
grant insert (name, slug, is_active, created_by)
  on public.attribute_types to authenticated;
grant update (name, slug, is_active)
  on public.attribute_types to authenticated;
grant select on public.attribute_values to authenticated;
grant insert (
  attribute_type_id,
  value,
  sort_order,
  is_active,
  created_by
) on public.attribute_values to authenticated;
grant update (value, sort_order, is_active)
  on public.attribute_values to authenticated;
grant select on public.category_attributes to authenticated;
grant insert (
  category_id,
  attribute_type_id,
  is_required,
  is_variant_axis,
  sort_order,
  is_active,
  created_by
) on public.category_attributes to authenticated;
grant update (is_required, is_variant_axis, sort_order, is_active)
  on public.category_attributes to authenticated;
grant delete on public.category_attributes to authenticated;

grant select on public.products to authenticated;
grant insert (
  category_id,
  name,
  description,
  is_active,
  created_by,
  archived_at
) on public.products to authenticated;
grant update (
  category_id,
  name,
  description,
  is_active,
  archived_at
) on public.products to authenticated;

grant select, insert, update, delete
  on public.product_attribute_values to authenticated;
grant select on public.product_variants to authenticated;
grant insert (
  product_id,
  sku,
  attribute_signature,
  price_paise,
  low_stock_threshold,
  is_active,
  created_by,
  archived_at
) on public.product_variants to authenticated;
grant update (
  sku,
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
grant select on public.payment_attempts to authenticated;

grant execute on function private.has_role(public.app_role)
  to authenticated, service_role;
grant execute on function private.is_store_operator()
  to authenticated, service_role;
grant execute on function public.current_user_roles()
  to authenticated, service_role;
grant execute on function public.authorize_user_roles(uuid, boolean)
  to service_role;
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
grant execute on function public.create_product_with_variant(
  uuid,
  text,
  text,
  text,
  bigint,
  integer,
  integer,
  jsonb
) to authenticated, service_role;
grant execute on function public.update_product(
  uuid, uuid, text, text
) to authenticated, service_role;
grant execute on function public.add_product_variant(
  uuid, text, bigint, integer, integer, jsonb
) to authenticated, service_role;
grant execute on function public.update_product_variant(
  uuid, text, bigint, integer, jsonb
) to authenticated, service_role;
grant execute on function public.set_product_active(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.set_variant_active(uuid, boolean)
  to authenticated, service_role;

grant execute on function private.hook_restrict_college_signup(jsonb)
  to supabase_auth_admin;

revoke execute on function public.adjust_stock(
  uuid,
  integer,
  text,
  public.stock_movement_type
) from public, anon;
revoke execute on function public.create_product_with_variant(
  uuid,
  text,
  text,
  text,
  bigint,
  integer,
  integer,
  jsonb
) from public, anon;
revoke execute on function public.update_product(
  uuid, uuid, text, text
) from public, anon;
revoke execute on function public.add_product_variant(
  uuid, text, bigint, integer, integer, jsonb
) from public, anon;
revoke execute on function public.update_product_variant(
  uuid, text, bigint, integer, jsonb
) from public, anon;
revoke execute on function public.set_product_active(uuid, boolean)
  from public, anon;
revoke execute on function public.set_variant_active(uuid, boolean)
  from public, anon;

commit;
