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
    raise exception using errcode = '42501',
      message = 'Store-manager access is required.';
  end if;

  select parent_id into selected_parent_id
  from public.product_categories
  where id = target_category_id and is_active;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'Selected active category not found.';
  end if;

  if resolved_attribute_type_id is null then
    parameter_name := nullif(btrim(new_parameter_name), '');
    if parameter_name is null then
      raise exception using errcode = '22023',
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
      raise exception using errcode = '22023',
        message = 'At least one allowed option value is required.';
    end if;

    parameter_slug := trim(both '-' from regexp_replace(
      lower(parameter_name), '[^a-z0-9]+', '-', 'g'
    ));

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
        attribute_type_id, value, sort_order, created_by
      ) values (
        resolved_attribute_type_id, parameter_value,
        parameter_sort_order, actor
      );
    end loop;
  elsif not exists (
    select 1
    from public.attribute_types
    where id = resolved_attribute_type_id
  ) then
    raise exception using errcode = 'P0002',
      message = 'Selected catalog option not found.';
  end if;

  if not exists (
    select 1
    from public.attribute_values
    where attribute_type_id = resolved_attribute_type_id
  ) then
    raise exception using errcode = '23514',
      message = 'A product option needs at least one allowed value.';
  end if;

  if exists (
    select 1
    from public.category_attributes
    where attribute_type_id = resolved_attribute_type_id
      and category_id in (target_category_id, selected_parent_id)
  ) then
    raise exception using errcode = '23505',
      message = 'This option is already configured for the selected category.';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_sort_order
  from public.category_attributes
  where category_id = target_category_id;

  insert into public.category_attributes (
    category_id, attribute_type_id, is_required, is_variant_axis,
    sort_order, created_by
  ) values (
    target_category_id, resolved_attribute_type_id, true, true,
    next_sort_order, actor
  );

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, metadata
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

revoke all on function public.add_product_option_to_category(
  uuid,
  uuid,
  text,
  jsonb
) from public, anon;

grant execute on function public.add_product_option_to_category(
  uuid,
  uuid,
  text,
  jsonb
) to authenticated, service_role;

notify pgrst, 'reload schema';
