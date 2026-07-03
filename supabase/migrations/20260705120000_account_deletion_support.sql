-- Phase 1E: Privacy, Export JSON & Delete Account
--
-- The delete-account Edge Function (supabase/functions/delete-account) hard
-- deletes the caller's auth.users row via the Admin API. Three columns
-- still reference auth.users(id) with the default "no action" behavior at
-- that point:
--   - companies.owner_id      (companies are soft-deleted, not dropped, so
--                               this row survives its owner's account)
--   - companies.deleted_by    (set to the deleting owner right before the
--                               user row is removed)
--   - audit_logs.actor_id     (the DELETE_ACCOUNT_REQUESTED/COMPLETED rows,
--                               and any earlier action logged by a member
--                               who later deletes their own account, must
--                               outlive that user for the company's audit
--                               trail to stay meaningful)
--
-- Without relaxing these, deleting the auth.users row would fail with a
-- foreign key violation. "on delete set null" anonymizes the reference
-- instead of blocking deletion or cascading into deleting unrelated rows
-- (a deleted user's past actions/company should remain, just no longer
-- attributable to a live account).

alter table public.companies
  alter column owner_id drop not null;

alter table public.companies
  drop constraint companies_owner_id_fkey,
  add constraint companies_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete set null;

alter table public.companies
  drop constraint companies_deleted_by_fkey,
  add constraint companies_deleted_by_fkey
    foreign key (deleted_by) references auth.users (id) on delete set null;

alter table public.audit_logs
  alter column actor_id drop not null;

alter table public.audit_logs
  drop constraint audit_logs_actor_id_fkey,
  add constraint audit_logs_actor_id_fkey
    foreign key (actor_id) references auth.users (id) on delete set null;

-- audit_logs_insert_self_within_company (Phase 1B) still requires
-- actor_id = auth.uid() for ordinary client inserts, so this nullability
-- is only ever reached via the delete-account Edge Function's service_role
-- writes and the "set null" cascade above — never a client-supplied null.
