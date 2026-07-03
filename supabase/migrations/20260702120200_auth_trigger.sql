-- Phase 1B: Database Schema & RLS Foundation
-- Auto-create a profiles row whenever a new auth user is created.
--
-- security definer + a fixed search_path is required here: the trigger
-- fires as part of an insert into auth.users, a schema the `authenticated`/
-- `anon` roles don't have write access to `public.profiles` from in that
-- context without elevated privileges, and pinning search_path prevents a
-- malicious search_path from shadowing `public.profiles` with another
-- table of the same name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    -- Register (Phase 1A) passes displayName via signUp's user_metadata.
    -- Fall back to the email's local part so the row is never blank.
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
