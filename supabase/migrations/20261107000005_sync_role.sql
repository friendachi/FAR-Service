-- FAR Service — keep profiles.role in sync with auth app_metadata.
-- Supabase Auth writes app_metadata in a separate UPDATE after creating the user, so the
-- insert trigger alone always sees the default role. This also covers promoting a user
-- later from the dashboard or with the admin API. Safe to run more than once.

create or replace function sync_user_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := (new.raw_app_meta_data ->> 'role')::app_role;
  v_phone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', new.phone, ''), '\D', '', 'g');
begin
  if v_role is null then return new; end if;
  update profiles set role = v_role where id = new.id and role is distinct from v_role;
  if v_role = 'DRIVER' and v_phone <> '' then
    update drivers set profile_id = new.id where profile_id is null and phone = v_phone;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_role_changed on auth.users;
create trigger on_auth_user_role_changed after update of raw_app_meta_data on auth.users
  for each row when (old.raw_app_meta_data ->> 'role' is distinct from new.raw_app_meta_data ->> 'role')
  execute function sync_user_role();
