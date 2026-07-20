begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_table('public', 'product_images', 'product image metadata exists');
select has_column(
  'public', 'product_images', 'variant_id',
  'an image can belong to one variant'
);
select has_column(
  'public', 'product_images', 'is_primary',
  'a product can identify its primary image'
);
select has_index(
  'public', 'product_images', 'product_images_one_primary',
  'a product has at most one primary image'
);
select has_function(
  'public',
  'set_primary_product_image',
  array['uuid', 'uuid'],
  'primary image changes are transactional'
);
select has_index(
  'public', 'product_images', 'product_images_one_per_variant',
  'a variant has at most one image'
);
select ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.product_images'::regclass
  ),
  'image metadata uses row-level security'
);
select is(
  (select public from storage.buckets where id = 'product-images'),
  true,
  'product image bucket is public for catalog reads'
);
select is(
  (select file_size_limit from storage.buckets where id = 'product-images'),
  5242880::bigint,
  'product images are limited to 5 MB'
);

select * from finish();
rollback;
