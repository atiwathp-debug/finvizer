-- Phase 1B: Database Schema & RLS Foundation
-- Enable RLS on every Phase 1B table and add policies.
--
-- General shape: everything is scoped to "companies the current user is an
-- ACTIVE member of" (is_company_member) or "companies the current user
-- owns" (is_company_owner) — see 20260702120300_rls_helper_functions.sql.
-- No table grants access to the `anon` role; the whole app requires auth.

-- Table grants -------------------------------------------------------
-- RLS restricts *rows*; these grants are what let the `authenticated` role
-- reach the table at all. audit_logs has no update/delete grant, which
-- combined with having no update/delete policy below makes it append-only.
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.companies to authenticated;
grant select, insert, update, delete on public.company_members to authenticated;
grant select, insert, update on public.invitations to authenticated;
grant select, insert on public.audit_logs to authenticated;

-- profiles -----------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_self_or_company_peers"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.company_members cm
    where cm.user_id = profiles.id
      and cm.status = 'ACTIVE'
      and public.is_company_member(cm.company_id)
  )
);

-- No insert policy: rows are created only by the handle_new_user trigger
-- (security definer, bypasses RLS), never directly by a client.

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- No delete policy: account deletion is a hard delete performed by an Edge
-- Function (Phase 1E) using service_role, which bypasses RLS entirely.

-- companies -----------------------------------------------------------
alter table public.companies enable row level security;

create policy "companies_select_members"
on public.companies
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_company_member(id)
);

-- Business rule: 1 user = 1 company, enforced here (not just in the app)
-- as defense in depth. company_members' own unique(user_id) constraint is
-- the hard backstop once the bootstrap OWNER row is inserted.
create policy "companies_insert_if_no_existing_membership"
on public.companies
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and not exists (
    select 1 from public.company_members cm where cm.user_id = auth.uid()
  )
);

-- with check uses owner_id = auth.uid() directly (the proposed new row's
-- value) rather than is_company_owner(id): that function re-queries
-- companies fresh, which reflects the pre-update row and so would NOT
-- catch an attempt to reassign owner_id to a different user. Checking the
-- new row's column directly closes that gap — ownership can't be
-- transferred via a plain UPDATE, only other fields can change.
create policy "companies_update_owner_only"
on public.companies
for update
to authenticated
using (public.is_company_owner(id))
with check (owner_id = auth.uid());

-- No delete policy: Owner account deletion (Phase 1E) soft-deletes the
-- company (deleted_at/deleted_by) via the delete-account Edge Function's
-- service_role client, not a client-facing DELETE — see
-- supabase/functions/delete-account/index.ts.

-- company_members -------------------------------------------------------
alter table public.company_members enable row level security;

create policy "company_members_select_same_company"
on public.company_members
for select
to authenticated
using (public.is_company_member(company_id));

-- Covers exactly the "Company Onboarding" bootstrap (Phase 1C): the company
-- owner inserting their own OWNER membership right after creating the
-- company. Inviting *other* users (Phase 1D) goes through a security
-- definer RPC that validates the invite token, not a direct client insert
-- — see docs/rls-policy-notes.md.
create policy "company_members_insert_owner_bootstrap"
on public.company_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'OWNER'
  and status = 'ACTIVE'
  and exists (
    select 1 from public.companies c
    where c.id = company_members.company_id
      and c.owner_id = auth.uid()
  )
  and not exists (
    select 1 from public.company_members cm2 where cm2.user_id = auth.uid()
  )
);

create policy "company_members_update_owner_only"
on public.company_members
for update
to authenticated
using (public.is_company_owner(company_id))
with check (public.is_company_owner(company_id));

create policy "company_members_delete_owner_only"
on public.company_members
for delete
to authenticated
using (public.is_company_owner(company_id));

-- invitations -----------------------------------------------------------
alter table public.invitations enable row level security;

-- Only the Owner can list/browse invitations for their company. An invited
-- (possibly not-yet-registered) user never queries this table directly —
-- accepting an invite is a security definer RPC (Phase 1D) that looks up
-- the row by token_hash and returns only what's needed, so token_hash is
-- never exposed to a general SELECT.
create policy "invitations_select_owner_only"
on public.invitations
for select
to authenticated
using (public.is_company_owner(company_id));

-- Defense in depth for "max 2 invited emails per company": active non-owner
-- members plus already-pending invites must be under 2 before another
-- insert is allowed. The app (Phase 1D) checks this too before calling
-- insert, but this makes the limit hold even if that check is bypassed.
create policy "invitations_insert_owner_within_limit"
on public.invitations
for insert
to authenticated
with check (
  public.is_company_owner(company_id)
  and (
    (select count(*) from public.company_members cm
      where cm.company_id = invitations.company_id
        and cm.role <> 'OWNER'
        and cm.status = 'ACTIVE')
    + (select count(*) from public.invitations i2
      where i2.company_id = invitations.company_id
        and i2.status = 'PENDING')
  ) < 2
);

create policy "invitations_update_owner_only"
on public.invitations
for update
to authenticated
using (public.is_company_owner(company_id))
with check (public.is_company_owner(company_id));

-- No delete policy: invitations are cancelled via status = 'CANCELLED'
-- (update), not deleted, so the history stays intact for audit_logs.

-- audit_logs --------------------------------------------------------
alter table public.audit_logs enable row level security;

create policy "audit_logs_select_same_company"
on public.audit_logs
for select
to authenticated
using (public.is_company_member(company_id));

-- Lets the client log routine UI actions (e.g. "Select template") directly.
-- Privileged actions (document number generation, account deletion, ...)
-- are logged from inside their own Edge Functions/RPCs using service_role,
-- which bypasses RLS and this policy entirely.
create policy "audit_logs_insert_self_within_company"
on public.audit_logs
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and public.is_company_member(company_id)
);

-- No update/delete policy anywhere on this table: audit_logs is append-only.
