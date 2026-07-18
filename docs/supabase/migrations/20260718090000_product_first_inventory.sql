drop policy attribute_types_select on public.attribute_types;
drop policy attribute_values_select on public.attribute_values;
drop policy category_attributes_select on public.category_attributes;

alter table public.category_attributes
  add column required_from timestamptz;

update public.category_attributes
set required_from = created_at
where is_required;

alter table public.attribute_types drop column is_active;
alter table public.attribute_values drop column is_active;
alter table public.category_attributes drop column is_active;

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
    raise exception using errcode = '23503',
      message = 'This category parameter is used by a product and cannot be removed.';
  end if;
  return old;
end;
$$;

create trigger category_attributes_set_required_from
before insert or update of is_required on public.category_attributes
for each row execute function private.set_category_attribute_required_from();

create trigger category_attributes_protect_delete
before delete on public.category_attributes
for each row execute function private.protect_category_attribute_delete();

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
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;
  if target_attribute_value_id is not null and not exists (
    select 1 from public.attribute_values
    where id = target_attribute_value_id
      and attribute_type_id = target_attribute_type_id
  ) then
    raise exception using errcode = 'P0002',
      message = 'Catalog parameter value not found.';
  end if;

  with referenced_products as (
    select product_id
    from public.product_attribute_values
    where attribute_type_id = target_attribute_type_id
      and (
        target_attribute_value_id is null
        or attribute_value_id = target_attribute_value_id
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
  where attribute_type_id = target_attribute_type_id
    and (
      target_attribute_value_id is null
      or attribute_value_id = target_attribute_value_id
    );

  select case when target_attribute_value_id is null
    then count(*)::integer else 0 end
  into category_count
  from public.category_attributes
  where attribute_type_id = target_attribute_type_id;

  return jsonb_build_object(
    'product_count', product_count,
    'variant_count', variant_count,
    'category_count', category_count,
    'total_count', product_count + variant_count + category_count,
    'product_ids', product_ids
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
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;
  perform 1 from public.attribute_values
  where id = target_attribute_value_id for update;
  if not found then
    raise exception using errcode = 'P0002',
      message = 'Catalog parameter value not found.';
  end if;
  if exists (
    select 1 from public.product_attribute_values
    where attribute_value_id = target_attribute_value_id
    union all
    select 1 from public.variant_attribute_values
    where attribute_value_id = target_attribute_value_id
  ) then
    raise exception using errcode = '23503',
      message = 'This parameter value is used by a product and cannot be removed.';
  end if;
  delete from public.attribute_values where id = target_attribute_value_id;
  insert into public.audit_events (
    actor_id, action, entity_type, entity_id
  ) values (
    actor,
    'catalog.attribute_value_removed',
    'attribute_value',
    target_attribute_value_id
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
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;
  delete from public.category_attributes
  where category_id = target_category_id
    and attribute_type_id = target_attribute_type_id;
  if not found then
    raise exception using errcode = 'P0002',
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
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;
  perform 1 from public.attribute_types
  where id = target_attribute_type_id for update;
  if not found then
    raise exception using errcode = 'P0002',
      message = 'Catalog parameter not found.';
  end if;
  if exists (
    select 1 from public.category_attributes
    where attribute_type_id = target_attribute_type_id
    union all
    select 1 from public.product_attribute_values
    where attribute_type_id = target_attribute_type_id
    union all
    select 1 from public.variant_attribute_values
    where attribute_type_id = target_attribute_type_id
  ) then
    raise exception using errcode = '23503',
      message = 'This parameter is in use and cannot be removed.';
  end if;
  delete from public.attribute_values
  where attribute_type_id = target_attribute_type_id;
  delete from public.attribute_types where id = target_attribute_type_id;
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
    raise exception using errcode = '22023',
      message = 'Variant attributes must be an object.';
  end if;

  if exists (
    with category_scope as (
      select parent_id as category_id, 0 as precedence
      from public.product_categories where id = target_category_id
      union all select target_category_id, 1
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
    select 1 from resolved
    where is_variant_axis and is_required
      and (
        required_from is null
        or target_variant_created_at >= required_from
      )
      and not (
        coalesce(selected_variant_values, '{}'::jsonb)
        ? attribute_type_id::text
      )
  ) then
    raise exception using errcode = '23514',
      message = 'Choose every required variant attribute.';
  end if;

  for selected_value in
    select key::uuid as attribute_type_id, value::uuid as attribute_value_id
    from jsonb_each_text(coalesce(selected_variant_values, '{}'::jsonb))
  loop
    if not exists (
      with category_scope as (
        select parent_id as category_id, 0 as precedence
        from public.product_categories where id = target_category_id
        union all select target_category_id, 1
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
        and resolved.is_variant_axis
    ) then
      raise exception using errcode = '23514',
        message = 'A selected variant value is not allowed by this category.';
    end if;
  end loop;

  select coalesce(
    string_agg(key || '=' || value, ',' order by key), 'default'
  )
  into signature
  from jsonb_each_text(coalesce(selected_variant_values, '{}'::jsonb));
  return signature;
end;
$$;

create or replace function private.variant_attribute_signature(
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
    string_agg(key || '=' || value, ',' order by key), 'default'
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
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;
  select category_id into target_category_id
  from public.products where id = target_product_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Product not found.';
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
    raise exception using errcode = '23514',
      message = 'Choose an allowed parameter value.';
  end if;

  select count(*) into requested_count
  from (select distinct unnest(coalesce(target_variant_ids, '{}'::uuid[]))) r;
  if requested_count = 0 then
    raise exception using errcode = '22023',
      message = 'Choose at least one product variant.';
  end if;

  perform product_variants.id
  from public.product_variants
  join (select distinct unnest(target_variant_ids) as id) requested
    on requested.id = product_variants.id
  where product_variants.product_id = target_product_id
  order by product_variants.id
  for update of product_variants;
  get diagnostics selected_count = row_count;
  if selected_count <> requested_count then
    raise exception using errcode = '23514',
      message = 'Every selected variant must belong to this product.';
  end if;

  insert into public.variant_attribute_values (
    variant_id, attribute_type_id, attribute_value_id
  )
  select id, target_attribute_type_id, target_attribute_value_id
  from (select distinct unnest(target_variant_ids) as id) requested
  on conflict (variant_id, attribute_type_id)
  do update set attribute_value_id = excluded.attribute_value_id;

  for target_variant in
    select id, created_at from public.product_variants
    where product_id = target_product_id and id = any(target_variant_ids)
    order by id
  loop
    select coalesce(
      jsonb_object_agg(attribute_type_id::text, attribute_value_id::text),
      '{}'::jsonb
    )
    into selected_values
    from public.variant_attribute_values
    where variant_id = target_variant.id;
    update public.product_variants
    set attribute_signature = private.variant_attribute_signature(
      target_category_id, selected_values, target_variant.created_at
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
  parameter_value text;
begin
  if actor is null or not private.is_store_operator() then
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;
  if nullif(btrim(category_name), '') is null then
    raise exception using errcode = '22023',
      message = 'Category name is required.';
  end if;
  if jsonb_typeof(coalesce(parameter_configurations, '[]'::jsonb))
      <> 'array' then
    raise exception using errcode = '22023',
      message = 'Category parameters must be an array.';
  end if;
  category_slug := trim(both '-' from regexp_replace(
    lower(btrim(category_name)), '[^a-z0-9]+', '-', 'g'
  ));
  insert into public.product_categories (
    parent_id, slug, name, description
  ) values (
    parent_category_id, category_slug, btrim(category_name),
    nullif(btrim(category_description), '')
  ) returning id into new_category_id;

  for configuration in
    select value from jsonb_array_elements(
      coalesce(parameter_configurations, '[]'::jsonb)
    )
  loop
    target_attribute_type_id :=
      nullif(configuration->>'attribute_type_id', '')::uuid;
    if target_attribute_type_id is null then
      parameter_name := nullif(btrim(configuration->>'name'), '');
      if parameter_name is null then
        raise exception using errcode = '22023',
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
        raise exception using errcode = '22023',
          message = 'Every new parameter needs at least one allowed value.';
      end if;
      insert into public.attribute_types (name, slug, created_by)
      values (
        parameter_name,
        trim(both '-' from regexp_replace(
          lower(parameter_name), '[^a-z0-9]+', '-', 'g'
        )),
        actor
      ) returning id into target_attribute_type_id;
      for parameter_value in
        select btrim(value)
        from jsonb_array_elements_text(
          coalesce(configuration->'values', '[]'::jsonb)
        )
      loop
        if parameter_value <> '' then
          insert into public.attribute_values (
            attribute_type_id, value, created_by
          ) values (
            target_attribute_type_id, parameter_value, actor
          );
        end if;
      end loop;
    elsif not exists (
      select 1
      from public.attribute_types
      where id = target_attribute_type_id
    ) then
      raise exception using errcode = 'P0002',
        message = 'Selected catalog parameter not found.';
    end if;
    if not exists (
      select 1
      from public.attribute_values
      where attribute_type_id = target_attribute_type_id
    ) then
      raise exception using errcode = '23514',
        message = 'Every category parameter needs an allowed value.';
    end if;
    insert into public.category_attributes (
      category_id, attribute_type_id, is_required, is_variant_axis,
      sort_order, created_by
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

create policy attribute_types_select on public.attribute_types
for select to authenticated using (true);
create policy attribute_values_select on public.attribute_values
for select to authenticated using (true);
create policy category_attributes_select on public.category_attributes
for select to authenticated using (true);

revoke all on function private.set_category_attribute_required_from()
  from public, anon, authenticated;
revoke all on function private.protect_category_attribute_delete()
  from public, anon, authenticated;
revoke all on function private.variant_attribute_signature(uuid, jsonb, timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_catalog_option_usage(uuid, uuid)
  from public, anon;
revoke all on function public.remove_attribute_value(uuid) from public, anon;
revoke all on function public.remove_attribute_type(uuid) from public, anon;
revoke all on function public.remove_category_attribute(uuid, uuid)
  from public, anon;
revoke all on function public.bulk_assign_variant_attribute(uuid, uuid, uuid, uuid[])
  from public, anon;
revoke all on function public.create_category_with_parameters(text, uuid, text, jsonb)
  from public, anon;

grant execute on function public.get_catalog_option_usage(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.remove_attribute_value(uuid)
  to authenticated, service_role;
grant execute on function public.remove_attribute_type(uuid)
  to authenticated, service_role;
grant execute on function public.remove_category_attribute(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.bulk_assign_variant_attribute(uuid, uuid, uuid, uuid[])
  to authenticated, service_role;
grant execute on function public.create_category_with_parameters(text, uuid, text, jsonb)
  to authenticated, service_role;

-- Product and variant image storage

alter table public.product_variants
  add constraint product_variants_product_id_pair_unique
  unique (product_id, id);

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

create unique index product_images_one_primary
  on public.product_images (product_id)
  where is_primary and variant_id is null;

create unique index product_images_one_per_variant
  on public.product_images (variant_id)
  where variant_id is not null;

create index product_images_product_sort_idx
  on public.product_images (product_id, sort_order, created_at);

create trigger product_images_set_updated_at
before update on public.product_images
for each row
execute function private.set_updated_at();

alter table public.product_images enable row level security;
alter table public.product_images force row level security;

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

revoke all on public.product_images from public, anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;

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
    select 1 from public.product_images
    where id = target_image_id
      and product_id = target_product_id
      and variant_id is null
  ) then
    raise exception using errcode = 'P0002',
      message = 'Choose a product gallery image.';
  end if;
  update public.product_images
  set is_primary = (id = target_image_id)
  where product_id = target_product_id and variant_id is null;

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

revoke all on function public.set_primary_product_image(uuid, uuid)
  from public, anon;
grant execute on function public.set_primary_product_image(uuid, uuid)
  to authenticated, service_role;

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
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

-- Idempotent manual inventory operations

alter table public.stock_movements
  add column idempotency_key uuid,
  add column request_fingerprint text;

create unique index stock_movements_idempotency_key_unique
  on public.stock_movements (idempotency_key)
  where idempotency_key is not null;

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
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;
  if operation_name not in ('add_to_count', 'reduce_by') then
    raise exception using errcode = '22023',
      message = 'Unknown manual stock operation.';
  end if;
  if operation_idempotency_key is null then
    raise exception using errcode = '22023',
      message = 'An idempotency key is required.';
  end if;
  if normalized_reason is null then
    raise exception using errcode = '22023',
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
    raise exception using errcode = '23505',
      message = 'This stock request key was already used for another operation.';
  end if;

  select current_stock
  into stock_before
  from public.product_variants
  where id = target_variant_id and is_active
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'Choose an active product variant.';
  end if;

  if operation_name = 'add_to_count' then
    if requested_quantity <= stock_before then
      raise exception using errcode = '23514',
        message = 'New stock count must be greater than current stock.';
    end if;
    stock_after := requested_quantity;
    stock_delta := stock_after - stock_before;
    movement_type := 'restock'::public.stock_movement_type;
  else
    if requested_quantity <= 0 then
      raise exception using errcode = '22023',
        message = 'Quantity to remove must be a positive whole number.';
    end if;
    if requested_quantity > stock_before then
      raise exception using errcode = '23514',
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
    variant_id, movement_type, quantity_before, quantity_delta, quantity_after,
    reason, actor_id, idempotency_key, request_fingerprint
  ) values (
    target_variant_id, movement_type, stock_before, stock_delta, stock_after,
    normalized_reason, actor, operation_idempotency_key, fingerprint
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    actor,
    case when operation_name = 'add_to_count'
      then 'stock.added' else 'stock.reduced' end,
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
    'add_to_count', variant_id, target_count, reason, idempotency_key
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
    'reduce_by', variant_id, quantity_to_remove, reason, idempotency_key
  );
$$;

revoke all on function private.manual_stock_operation(text, uuid, integer, text, uuid)
  from public, anon, authenticated;
revoke all on function public.add_stock_to_count(uuid, integer, text, uuid)
  from public, anon;
revoke all on function public.record_stock_reduction(uuid, integer, text, uuid)
  from public, anon;

grant execute on function public.add_stock_to_count(uuid, integer, text, uuid)
  to authenticated, service_role;
grant execute on function public.record_stock_reduction(uuid, integer, text, uuid)
  to authenticated, service_role;

-- Complete e-commerce product-family and sellable-variant entry

alter table public.products
  add column brand text,
  add constraint products_brand_not_blank
    check (brand is null or btrim(brand) <> '');

alter table public.product_variants
  add column barcode text,
  add constraint product_variants_barcode_not_blank
    check (barcode is null or btrim(barcode) <> '');

create unique index product_variants_barcode_unique
  on public.product_variants (barcode)
  where barcode is not null;

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
    category_id, name, brand, description, created_by
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
      product_id, attribute_type_id, attribute_value_id
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
      product_id, sku, barcode, attribute_signature, price_paise,
      current_stock, low_stock_threshold, created_by
    )
    values (
      new_product_id, normalized_sku, normalized_barcode, attribute_signature,
      price_value, opening_stock_value, threshold_value, actor
    )
    returning id into new_variant_id;

    for selected_value in
      select key::uuid as attribute_type_id, value::uuid as attribute_value_id
      from jsonb_each_text(variant_attributes)
    loop
      insert into public.variant_attribute_values (
        variant_id, attribute_type_id, attribute_value_id
      )
      values (
        new_variant_id,
        selected_value.attribute_type_id,
        selected_value.attribute_value_id
      );
    end loop;

    if opening_stock_value > 0 then
      insert into public.stock_movements (
        variant_id, movement_type, quantity_before, quantity_delta,
        quantity_after, reason, actor_id
      )
      values (
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

revoke all on function public.create_product_with_variants(
  uuid, text, text, text, jsonb, jsonb
) from public, anon;
grant execute on function public.create_product_with_variants(
  uuid, text, text, text, jsonb, jsonb
) to authenticated, service_role;

-- Role-aware workspaces and dynamic store-manager provisioning

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

create trigger store_manager_invitations_set_updated_at
before update on private.store_manager_invitations
for each row
execute function private.set_updated_at();

alter table private.store_manager_invitations enable row level security;
alter table private.store_manager_invitations force row level security;

create or replace function public.current_user_roles()
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
  where user_id = (select auth.uid());
$$;

create or replace function public.authorize_user_roles(
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

    insert into private.user_roles (user_id, role, assigned_by)
    values (
      target_user_id,
      'super_admin'::public.app_role,
      null
    )
    on conflict (user_id, role) do nothing;

    get diagnostics inserted_count = row_count;

    if inserted_count = 1 then
      insert into public.audit_events (
        actor_id, action, entity_type, entity_id, metadata
      )
      values (
        target_user_id,
        'role.configured_super_admin',
        'user',
        target_user_id,
        jsonb_build_object(
          'role', 'super_admin',
          'source', 'server_environment'
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
    insert into private.user_roles (user_id, role, assigned_by)
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
        actor_id, action, entity_type, entity_id, metadata
      )
      values (
        invitation_record.invited_by,
        'store_manager.assigned',
        'user',
        target_user_id,
        jsonb_build_object(
          'source', 'confirmed_invitation',
          'invitation_id', invitation_record.id
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
    email, display_name, state, invited_by, invited_at, last_sent_at,
    accepted_user_id, accepted_at, cancelled_at, failed_at, failure_code
  )
  values (
    normalized_email, normalized_display_name, 'pending', actor, now(), now(),
    null, null, null, null, null
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
  values (actor, 'store_manager.removed', 'user', target_user_id);
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

revoke all on table private.store_manager_invitations
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

drop function public.update_product(uuid, uuid, text, text);

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
    select 1 from public.products
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

revoke execute on function public.update_product(
  uuid, uuid, text, text, text
) from public, anon;
grant execute on function public.update_product(
  uuid, uuid, text, text, text
) to authenticated, service_role;

drop function public.add_product_variant(
  uuid, text, bigint, integer, integer, jsonb
);

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

revoke execute on function public.add_product_variant(
  uuid, text, text, bigint, integer, integer, jsonb
) from public, anon;
grant execute on function public.add_product_variant(
  uuid, text, text, bigint, integer, integer, jsonb
) to authenticated, service_role;

drop function public.update_product_variant(
  uuid, text, bigint, integer, jsonb
);

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
  where variant_attribute_values.variant_id =
    update_product_variant.variant_id;
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
    actor, 'variant.updated', 'product_variant', variant_id,
    jsonb_build_object('sku', upper(btrim(variant_sku)))
  );
end;
$$;

revoke execute on function public.update_product_variant(
  uuid, text, text, bigint, integer, jsonb
) from public, anon;
grant execute on function public.update_product_variant(
  uuid, text, text, bigint, integer, jsonb
) to authenticated, service_role;

drop function if exists public.create_product_with_variant(
  uuid,
  text,
  text,
  text,
  bigint,
  integer,
  integer,
  jsonb
);

notify pgrst, 'reload schema';
