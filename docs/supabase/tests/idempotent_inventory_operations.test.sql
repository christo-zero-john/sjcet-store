begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select col_type_is(
  'public', 'stock_movements', 'idempotency_key', 'uuid',
  'stock movements store the request key'
);
select col_type_is(
  'public', 'stock_movements', 'request_fingerprint', 'text',
  'stock movements bind keys to request inputs'
);
select has_index(
  'public',
  'stock_movements',
  'stock_movements_idempotency_key_unique',
  'manual stock keys cannot be applied twice'
);
select has_function(
  'public',
  'add_stock_to_count',
  array['uuid', 'integer', 'text', 'uuid'],
  'stock additions use a target count'
);
select has_function(
  'public',
  'record_stock_reduction',
  array['uuid', 'integer', 'text', 'uuid'],
  'stock reductions use a separate operation'
);
select is_definer(
  'public',
  'add_stock_to_count',
  array['uuid', 'integer', 'text', 'uuid'],
  'add stock executes through its guarded database contract'
);
select is_definer(
  'public',
  'record_stock_reduction',
  array['uuid', 'integer', 'text', 'uuid'],
  'stock reduction executes through its guarded database contract'
);

select * from finish();
rollback;
