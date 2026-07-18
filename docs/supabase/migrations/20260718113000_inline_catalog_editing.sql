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
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if not exists (
    select 1
    from public.category_attributes
    where category_id = target_category_id
      and attribute_type_id = target_attribute_type_id
  ) then
    raise exception using
      errcode = 'P0002',
      message = 'Category option not found.';
  end if;

  with category_scope as (
    select target_category_id as category_id
    union all
    select id
    from public.product_categories
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
  select
    count(*)::integer,
    coalesce(jsonb_agg(id order by id), '[]'::jsonb)
  into product_count, product_ids
  from referenced_products;

  with category_scope as (
    select target_category_id as category_id
    union all
    select id
    from public.product_categories
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
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if normalized_name is null then
    raise exception using
      errcode = '22023',
      message = 'Category name is required.';
  end if;

  category_slug := trim(
    both '-' from regexp_replace(
      lower(normalized_name),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );

  if category_slug = '' then
    raise exception using
      errcode = '22023',
      message = 'Category name needs at least one letter or number.';
  end if;

  perform id
  from public.product_categories
  where id = target_category_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Category not found.';
  end if;

  update public.product_categories
  set name = normalized_name,
      slug = category_slug,
      parent_id = parent_category_id,
      description = normalized_description
  where id = target_category_id;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    actor,
    'catalog.category_updated',
    'category',
    target_category_id,
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
    raise exception using
      errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  if normalized_name is null then
    raise exception using
      errcode = '22023',
      message = 'Option name is required.';
  end if;

  if option_sort_order is null or option_sort_order < 0 then
    raise exception using
      errcode = '22023',
      message = 'Option display order must be zero or greater.';
  end if;

  if jsonb_typeof(coalesce(allowed_values, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(allowed_values, '[]'::jsonb)) = 0 then
    raise exception using
      errcode = '22023',
      message = 'At least one allowed option value is required.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(allowed_values) as item
    where jsonb_typeof(item) <> 'object'
      or nullif(btrim(item->>'value'), '') is null
      or (item->>'sort_order') is null
      or (item->>'sort_order')::integer < 0
  ) then
    raise exception using
      errcode = '22023',
      message = 'Every option value needs a label and display order.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(allowed_values) as item
    group by lower(btrim(item->>'value'))
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'Option values must be unique.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(allowed_values) as item
    where nullif(item->>'id', '') is not null
    group by item->>'id'
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'An option value cannot appear more than once.';
  end if;

  perform 1
  from public.category_attributes
  where category_id = target_category_id
    and attribute_type_id = target_attribute_type_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Category option not found.';
  end if;

  perform 1
  from public.attribute_types
  where id = target_attribute_type_id
  for update;

  perform id
  from public.attribute_values
  where attribute_type_id = target_attribute_type_id
  order by id
  for update;

  if exists (
    select 1
    from jsonb_array_elements(allowed_values) as item
    where nullif(item->>'id', '') is not null
      and not exists (
        select 1
        from public.attribute_values
        where id = (item->>'id')::uuid
          and attribute_type_id = target_attribute_type_id
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'An option value does not belong to this option.';
  end if;

  if exists (
    select 1
    from public.attribute_values
    where attribute_type_id = target_attribute_type_id
      and not exists (
        select 1
        from jsonb_array_elements(allowed_values) as item
        where nullif(item->>'id', '')::uuid =
          attribute_values.id
      )
      and (
        exists (
          select 1
          from public.product_attribute_values
          where attribute_value_id = attribute_values.id
        )
        or exists (
          select 1
          from public.variant_attribute_values
          where attribute_value_id = attribute_values.id
        )
      )
  ) then
    raise exception using
      errcode = '23503',
      message = 'A removed option value is used by a product.';
  end if;

  delete from public.attribute_values
  where attribute_type_id = target_attribute_type_id
    and not exists (
      select 1
      from jsonb_array_elements(allowed_values) as item
      where nullif(item->>'id', '')::uuid =
        attribute_values.id
    );
  get diagnostics removed_value_count = row_count;

  update public.attribute_values
  set value = '__catalog_edit__' || id::text
  where attribute_type_id = target_attribute_type_id;

  option_slug := trim(
    both '-' from regexp_replace(
      lower(normalized_name),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );

  if option_slug = '' then
    raise exception using
      errcode = '22023',
      message = 'Option name needs at least one letter or number.';
  end if;

  update public.attribute_types
  set name = normalized_name,
      slug = option_slug
  where id = target_attribute_type_id;

  for value_payload in
    select value
    from jsonb_array_elements(allowed_values)
  loop
    payload_id := nullif(value_payload->>'id', '')::uuid;
    payload_value := btrim(value_payload->>'value');
    payload_sort_order := (value_payload->>'sort_order')::integer;

    if payload_id is null then
      insert into public.attribute_values (
        attribute_type_id,
        value,
        sort_order,
        created_by
      ) values (
        target_attribute_type_id,
        payload_value,
        payload_sort_order,
        actor
      );
      inserted_value_count := inserted_value_count + 1;
    else
      update public.attribute_values
      set value = payload_value,
          sort_order = payload_sort_order
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

  select count(*)::integer
  into category_count
  from public.category_attributes
  where attribute_type_id = target_attribute_type_id;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    actor,
    'catalog.option_updated',
    'attribute_type',
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
    'attribute_type',
    jsonb_build_object(
      'id', target_attribute_type_id,
      'name', normalized_name
    ),
    'attribute_values',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'attribute_type_id', attribute_type_id,
            'value', value,
            'sort_order', sort_order
          )
          order by sort_order, value
        ),
        '[]'::jsonb
      )
      from public.attribute_values
      where attribute_type_id = target_attribute_type_id
    ),
    'category_attribute',
    jsonb_build_object(
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

revoke all on function public.get_category_option_usage(uuid, uuid)
  from public, anon;
revoke all on function public.update_category_inline(uuid, text, uuid, text)
  from public, anon;
revoke all on function public.update_catalog_option_inline(
  uuid, uuid, text, jsonb, boolean, boolean, integer
) from public, anon;

grant execute on function public.get_category_option_usage(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.update_category_inline(
  uuid, text, uuid, text
) to authenticated, service_role;
grant execute on function public.update_catalog_option_inline(
  uuid, uuid, text, jsonb, boolean, boolean, integer
) to authenticated, service_role;

notify pgrst, 'reload schema';
