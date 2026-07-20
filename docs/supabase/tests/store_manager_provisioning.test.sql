begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_table(
  'private',
  'store_manager_invitations',
  'pending store-manager invitations have authoritative storage'
);
select col_is_pk(
  'private',
  'store_manager_invitations',
  'id',
  'manager invitations have stable identifiers'
);
select col_is_unique(
  'private',
  'store_manager_invitations',
  'email',
  'one invitation state exists per normalized email'
);
select has_function(
  'public',
  'request_store_manager_access',
  array['text', 'text'],
  'super admins can request store-manager access'
);
select has_function(
  'public',
  'list_store_manager_access',
  array[]::text[],
  'super admins can list active and pending managers'
);
select has_function(
  'public',
  'remove_store_manager_access',
  array['uuid'],
  'super admins can remove only the store-manager role'
);
select has_function(
  'public',
  'cancel_store_manager_invitation',
  array['text'],
  'pending invitations can be cancelled'
);
select has_function(
  'public',
  'mark_store_manager_invitation_resent',
  array['text'],
  'resends have a controlled audit operation'
);
select has_function(
  'public',
  'mark_store_manager_invitation_failed',
  array['text', 'text'],
  'provider failures have a recoverable state'
);
select is_definer(
  'public',
  'request_store_manager_access',
  array['text', 'text'],
  'role creation executes through an authorized database boundary'
);
select is_definer(
  'public',
  'remove_store_manager_access',
  array['uuid'],
  'role removal executes through an authorized database boundary'
);
select function_returns(
  'public',
  'authorize_user_roles',
  array['uuid', 'boolean'],
  'app_role[]',
  'authoritative role resolution returns one role array'
);

select * from finish();
rollback;
