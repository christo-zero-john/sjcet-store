begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select col_type_is(
  'public',
  'products',
  'brand',
  'text',
  'product families store a shared brand'
);
select col_type_is(
  'public',
  'product_variants',
  'barcode',
  'text',
  'sellable variants can have independent barcodes'
);
select has_index(
  'public',
  'product_variants',
  'product_variants_barcode_unique',
  'non-null barcodes are globally unique'
);
select has_function(
  'public',
  'create_product_with_variants',
  array['uuid', 'text', 'text', 'text', 'jsonb', 'jsonb'],
  'one transaction creates a family and explicit sellable variants'
);
select function_returns(
  'public',
  'create_product_with_variants',
  array['uuid', 'text', 'text', 'text', 'jsonb', 'jsonb'],
  'jsonb',
  'creation returns product and variant identifiers'
);
select is_definer(
  'public',
  'create_product_with_variants',
  array['uuid', 'text', 'text', 'text', 'jsonb', 'jsonb'],
  'multi-variant creation uses a guarded database boundary'
);
select has_function(
  'public',
  'add_product_option_to_category',
  array['uuid', 'uuid', 'text', 'jsonb'],
  'product entry can add a reusable variant option to its category'
);
select has_table(
  'public',
  'product_attribute_values',
  'shared category-defined specifications belong to products'
);
select has_table(
  'public',
  'variant_attribute_values',
  'sellable option values belong to variants'
);
select has_table(
  'public',
  'stock_movements',
  'every opening stock quantity has movement history'
);

select * from finish();
rollback;
