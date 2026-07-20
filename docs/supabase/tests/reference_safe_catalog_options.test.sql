begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select col_type_is(
  'public',
  'category_attributes',
  'required_from',
  'timestamp with time zone',
  'required options record when enforcement begins'
);
select hasnt_column(
  'public', 'attribute_types', 'is_active',
  'parameter types do not use archive state'
);
select hasnt_column(
  'public', 'attribute_values', 'is_active',
  'parameter values do not use archive state'
);
select hasnt_column(
  'public', 'category_attributes', 'is_active',
  'category parameter links do not use archive state'
);
select has_function(
  'public', 'get_catalog_option_usage', array['uuid', 'uuid'],
  'catalog usage can be checked before removal'
);
select has_function(
  'public', 'remove_attribute_value', array['uuid'],
  'unreferenced values have a controlled removal operation'
);
select has_function(
  'public', 'remove_attribute_type', array['uuid'],
  'unreferenced parameters have a controlled removal operation'
);
select has_function(
  'public', 'remove_category_attribute', array['uuid', 'uuid'],
  'category parameters have a controlled removal operation'
);
select has_function(
  'public',
  'bulk_assign_variant_attribute',
  array['uuid', 'uuid', 'uuid', 'uuid[]'],
  'existing variants can receive a default in one operation'
);
select has_function(
  'public',
  'create_category_with_parameters',
  array['text', 'uuid', 'text', 'jsonb'],
  'inline category setup is transactional'
);
select has_trigger(
  'public',
  'category_attributes',
  'category_attributes_set_required_from',
  'required_from is maintained by the database'
);
select has_trigger(
  'public',
  'category_attributes',
  'category_attributes_protect_delete',
  'direct category parameter deletion cannot bypass references'
);
select volatility_is(
  'public',
  'get_catalog_option_usage',
  array['uuid', 'uuid'],
  'stable',
  'usage lookup is stable'
);
select has_function(
  'public',
  'get_category_option_usage',
  array['uuid', 'uuid'],
  'category-scoped option usage is available before detachment'
);
select has_function(
  'public',
  'update_category_inline',
  array['uuid', 'text', 'uuid', 'text'],
  'inline category editing has one guarded operation'
);
select has_function(
  'public',
  'update_catalog_option_inline',
  array['uuid', 'uuid', 'text', 'jsonb', 'boolean', 'boolean', 'integer'],
  'global option data and category configuration update atomically'
);
select has_function(
  'public',
  'add_category_parameter_inline',
  array['uuid', 'uuid', 'text', 'jsonb', 'boolean', 'boolean', 'integer'],
  'inline parameter creation preserves category-owned configuration'
);
select is_definer(
  'public',
  'add_category_parameter_inline',
  array['uuid', 'uuid', 'text', 'jsonb', 'boolean', 'boolean', 'integer'],
  'inline parameter creation uses an authorized database boundary'
);
select is_definer(
  'public',
  'update_category_inline',
  array['uuid', 'text', 'uuid', 'text'],
  'category editing uses an authorized database boundary'
);
select is_definer(
  'public',
  'update_catalog_option_inline',
  array['uuid', 'uuid', 'text', 'jsonb', 'boolean', 'boolean', 'integer'],
  'option editing uses an authorized database boundary'
);

select * from finish();
rollback;
