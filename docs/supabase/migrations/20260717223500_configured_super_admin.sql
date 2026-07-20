create function public.ensure_configured_super_admin(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_role boolean := false;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Service-role access is required.';
  end if;

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

  inserted_role := found;

  if inserted_role then
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
      jsonb_build_object('role', 'super_admin', 'source', 'server_environment')
    );
  end if;

  return inserted_role;
end;
$$;

revoke all on function public.ensure_configured_super_admin(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_configured_super_admin(uuid)
  to service_role;
