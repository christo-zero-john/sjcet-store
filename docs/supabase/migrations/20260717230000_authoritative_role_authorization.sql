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

revoke all on function public.authorize_user_roles(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.authorize_user_roles(uuid, boolean)
  to service_role;

drop function if exists public.ensure_configured_super_admin(uuid);

notify pgrst, 'reload schema';
