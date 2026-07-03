-- Phase 1B: Database Schema & RLS Foundation
-- RLS helper functions.
--
-- Each is `security definer` with a pinned `search_path`. This is the
-- standard Supabase pattern for avoiding infinite recursion: without it, a
-- policy on company_members that queries company_members to check
-- membership would itself be subject to company_members' RLS, which would
-- re-run the same policy, forever. `security definer` makes the function
-- body run as its owner (the migration role, which bypasses RLS), so the
-- lookup inside the function is unfiltered while the *caller's* access to
-- company_members is still fully governed by the policy that calls this
-- function. `stable` lets Postgres cache the result within a single query.

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
  );
$$;

comment on function public.is_company_member(uuid) is
  'True if the current user is an ACTIVE member of target_company_id.';

create or replace function public.has_company_role(
  target_company_id uuid,
  allowed_roles public.member_role[]
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'ACTIVE'
      and cm.role = any(allowed_roles)
  );
$$;

comment on function public.has_company_role(uuid, public.member_role[]) is
  'True if the current user is an ACTIVE member of target_company_id with one of allowed_roles. '
  'Not yet consumed by a Phase 1B policy — later phases (documents, numbering, ...) use it for '
  'role-gated actions like Approve/Cancel.';

create or replace function public.is_company_owner(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = target_company_id
      and c.owner_id = auth.uid()
      and c.deleted_at is null
  );
$$;

comment on function public.is_company_owner(uuid) is
  'True if the current user is the owner_id of target_company_id (checked against companies, '
  'not company_members, so it stays correct even before the bootstrap OWNER membership row exists).';
