-- FinVizer: combined Supabase migrations for one-time manual bootstrap
-- via the SQL Editor (Dashboard > SQL Editor > New query > paste this > Run).
--
-- This file is generated from supabase/migrations/*.sql, concatenated in
-- filename (chronological) order. It is NOT itself a tracked migration --
-- do not add it to supabase/migrations/, and do not run it via
-- `supabase db push` (that command already applies the individual files
-- in supabase/migrations/ directly). Regenerate this file if any
-- individual migration under supabase/migrations/ changes.
--
-- Contains no secrets: schema, RLS policies, and function definitions
-- only. Safe to paste into the SQL Editor of any Supabase project you
-- control.

-- ============================================================
-- FILE: supabase/migrations/20260702120000_extensions_and_enums.sql
-- ============================================================
-- Phase 1B: Database Schema & RLS Foundation
-- Enum types shared by the tables created in the next migration.
--
-- gen_random_uuid() is a core Postgres 13+ function (Supabase's Postgres is
-- 15+), so no extension needs to be enabled for uuid primary key defaults.

create type public.member_role as enum ('OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR', 'VIEWER');

create type public.member_status as enum ('ACTIVE', 'INVITED', 'DISABLED');

create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- Company's default document template (assigned in Phase 2A). The
-- companies.document_template column stays nullable until then — a null
-- value is what sends a user to /onboarding/template.
create type public.document_template as enum ('EXECUTIVE_CLASSIC', 'MODERN_ACCENT');


-- ============================================================
-- FILE: supabase/migrations/20260702120100_tables.sql
-- ============================================================
-- Phase 1B: Database Schema & RLS Foundation
-- Core tables. RLS is enabled and policies are added in a later migration
-- (20260702120400) — helper functions (20260702120300) need both
-- `companies` and `company_members` to exist first, so table creation is
-- kept separate from policy creation to avoid ordering headaches.

-- profiles -------------------------------------------------------------
-- One row per auth user. Populated automatically by the handle_new_user
-- trigger (next migration) — never inserted directly by the client.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user, created by the handle_new_user trigger on auth.users insert.';

-- companies --------------------------------------------------------------
-- Current version: max 1 company per user (enforced via company_members'
-- unique(user_id) below) and exactly one branch (HQ). branch_code/
-- branch_name are schema-ready for multi-branch support, which is a future
-- paid feature — no UI for adding branches yet.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  name_th text not null,
  name_en text,
  company_code text not null,
  tax_id text not null,
  branch_code text not null default 'HQ',
  branch_name text not null default 'สำนักงานใหญ่',
  address text,
  phone text,
  email text,
  logo_url text,
  contact_name text,
  document_template public.document_template,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id)
);

-- company_members ---------------------------------------------------------
-- Membership + role. unique(user_id) is the actual "1 email = 1 company"
-- enforcement; unique(company_id, user_id) is redundant given the former
-- but kept because the spec lists both explicitly and it documents intent.
create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  role public.member_role not null,
  status public.member_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_members_user_id_key unique (user_id),
  constraint company_members_company_id_user_id_key unique (company_id, user_id)
);

create index company_members_company_id_idx on public.company_members (company_id);

-- invitations ---------------------------------------------------------
-- Only token_hash is stored; the raw invite token is generated and shown
-- to the Owner once (Phase 1D) and never persisted here.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  invited_email text not null,
  invited_role public.member_role not null,
  invited_by uuid not null references auth.users (id),
  token_hash text not null,
  status public.invitation_status not null default 'PENDING',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index invitations_company_id_idx on public.invitations (company_id);
create index invitations_invited_email_idx on public.invitations (invited_email);

-- At most one PENDING invite per (company, email) at a time.
create unique index invitations_unique_pending_per_email
  on public.invitations (company_id, invited_email)
  where status = 'PENDING';

-- audit_logs ------------------------------------------------------------
-- Append-only: no update/delete policy is granted in the RLS migration, so
-- rows are immutable once written (aside from service_role, which bypasses
-- RLS entirely for the Edge Functions added in later phases).
--
-- entity_id is intentionally not a foreign key: entity_type identifies
-- which table it points to (document, customer, member, ...), and that set
-- of tables grows across later phases.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  actor_id uuid not null references auth.users (id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_company_id_created_at_idx on public.audit_logs (company_id, created_at desc);

-- updated_at maintenance --------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.company_members
  for each row execute function public.set_updated_at();


-- ============================================================
-- FILE: supabase/migrations/20260702120200_auth_trigger.sql
-- ============================================================
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


-- ============================================================
-- FILE: supabase/migrations/20260702120300_rls_helper_functions.sql
-- ============================================================
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


-- ============================================================
-- FILE: supabase/migrations/20260702120400_rls_policies.sql
-- ============================================================
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


-- ============================================================
-- FILE: supabase/migrations/20260703120000_create_company_with_owner.sql
-- ============================================================
-- Phase 1C: Company Onboarding
-- Atomically creates a company and the caller's OWNER company_members row.
--
-- `security invoker` (the default — stated explicitly for clarity): unlike
-- the Phase 1B helper functions, this does NOT bypass RLS. Both inserts
-- still go through companies_insert_if_no_existing_membership and
-- company_members_insert_owner_bootstrap exactly as if the client had
-- called them directly. What this function adds is atomicity: since the
-- whole function body runs as one statement/transaction, if the second
-- insert fails for any reason, the first is rolled back too — a plain
-- two-step client-side insert could otherwise leave an orphaned company
-- row with no owner membership.
create or replace function public.create_company_with_owner(
  p_name_th text,
  p_name_en text,
  p_company_code text,
  p_tax_id text,
  p_address text,
  p_phone text,
  p_email text,
  p_contact_name text,
  p_logo_url text
)
returns public.companies
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company public.companies;
begin
  insert into public.companies (
    owner_id, name_th, name_en, company_code, tax_id,
    address, phone, email, contact_name, logo_url
  ) values (
    auth.uid(), p_name_th, p_name_en, p_company_code, p_tax_id,
    p_address, p_phone, p_email, p_contact_name, p_logo_url
  )
  returning * into v_company;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_company.id, auth.uid(), 'OWNER', 'ACTIVE');

  return v_company;
end;
$$;

grant execute on function public.create_company_with_owner(
  text, text, text, text, text, text, text, text, text
) to authenticated;


-- ============================================================
-- FILE: supabase/migrations/20260704120000_accept_invitation.sql
-- ============================================================
-- Phase 1D: Member Invitation & Roles
-- Accepts an invitation: validates the token/email/existing-membership,
-- then atomically creates the ACTIVE company_members row and marks the
-- invitation ACCEPTED.
--
-- security definer is required (unlike create_company_with_owner in Phase
-- 1C, which is security invoker): the invited user is not the company
-- owner, so neither the invitations_select_owner_only policy nor the
-- company_members_insert_owner_bootstrap policy would let a plain client
-- call do this lookup/insert. This function bypasses both intentionally,
-- but only after re-validating everything those policies would have
-- checked (ownership aside) itself, in Postgres — never trusting anything
-- the client claims about the invitation.
--
-- Takes p_token_hash, not the raw token: hashing happens entirely on the
-- client (src/lib/utils/inviteToken.ts, same SHA-256 approach used for
-- Mock Mode), so this function — and the database — never needs to see the
-- raw token at all, only compare hashes.
create or replace function public.accept_invitation(p_token_hash text)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations;
  v_user_email text;
  v_company public.companies;
begin
  select * into v_invitation
  from public.invitations
  where token_hash = p_token_hash
    and status = 'PENDING'
  limit 1;

  if v_invitation is null then
    raise exception 'ลิงก์คำเชิญไม่ถูกต้องหรือถูกใช้งานไปแล้ว';
  end if;

  if v_invitation.expires_at < now() then
    update public.invitations set status = 'EXPIRED' where id = v_invitation.id;
    raise exception 'ลิงก์คำเชิญหมดอายุแล้ว';
  end if;

  select email into v_user_email from auth.users where id = auth.uid();

  if v_user_email is null or lower(v_user_email) <> v_invitation.invited_email then
    raise exception 'อีเมลของคุณไม่ตรงกับอีเมลที่ได้รับคำเชิญ';
  end if;

  if exists (select 1 from public.company_members where user_id = auth.uid()) then
    raise exception 'คุณเป็นสมาชิกของบริษัทอื่นอยู่แล้ว ไม่สามารถเข้าร่วมบริษัทนี้ได้';
  end if;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_invitation.company_id, auth.uid(), v_invitation.invited_role, 'ACTIVE');

  update public.invitations
  set status = 'ACCEPTED', accepted_at = now()
  where id = v_invitation.id;

  select * into v_company from public.companies where id = v_invitation.company_id;
  return v_company;
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;


-- ============================================================
-- FILE: supabase/migrations/20260705120000_account_deletion_support.sql
-- ============================================================
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


-- ============================================================
-- FILE: supabase/migrations/20260706120000_numbering_settings.sql
-- ============================================================
-- Phase 2B: Document Numbering Settings
--
-- Stores each company's document-numbering *configuration* only — the
-- pattern string and reset policy. Actual number *generation* (the atomic
-- running counter, collision-safe increment on Approve) is Phase 2C and
-- will likely add its own table/RPC; this one is read-only input to that
-- future logic.
--
-- One row with document_type = null is the company-wide default that
-- applies to every document type. Additional rows with a specific
-- document_type override the default for that type only.

create type public.numbering_reset_policy as enum ('DAILY', 'MONTHLY', 'YEARLY', 'NEVER');

create table public.numbering_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- null = company-wide default. A text + check constraint rather than a
  -- Postgres enum (unlike member_role/document_template) because the
  -- documents table itself doesn't exist until Phase 3/4 — easier to
  -- extend the check list later than run an ALTER TYPE migration once
  -- that schema is finalized.
  document_type text check (
    document_type in (
      'RFQ', 'QUOTATION', 'INVOICE', 'TAX_INVOICE', 'RECEIPT',
      'RECEIPT_TAX_INVOICE', 'CREDIT_NOTE', 'CREDIT_NOTE_TAX'
    )
  ),
  -- Raw pattern text (with {TOKEN} placeholders), not the rendered
  -- preview — the 64-character limit from the master spec applies to the
  -- *rendered* output and is enforced client-side
  -- (src/lib/validations/numberingPattern.ts); 128 here is just a generous
  -- backstop against pathological input.
  pattern text not null check (char_length(pattern) between 1 and 128),
  reset_policy public.numbering_reset_policy not null default 'MONTHLY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one company-wide default (document_type is null) ...
create unique index numbering_settings_unique_default
  on public.numbering_settings (company_id)
  where document_type is null;

-- ... and at most one override per (company, document_type).
create unique index numbering_settings_unique_override
  on public.numbering_settings (company_id, document_type)
  where document_type is not null;

create index numbering_settings_company_id_idx on public.numbering_settings (company_id);

create trigger set_updated_at
  before update on public.numbering_settings
  for each row execute function public.set_updated_at();

alter table public.numbering_settings enable row level security;

grant select, insert, update, delete on public.numbering_settings to authenticated;

create policy "numbering_settings_select_same_company"
on public.numbering_settings
for select
to authenticated
using (public.is_company_member(company_id));

-- Insert/update/delete are owner-only, same as companies/templates —
-- numbering configuration is company-level config, not a per-member
-- preference.
create policy "numbering_settings_insert_owner_only"
on public.numbering_settings
for insert
to authenticated
with check (public.is_company_owner(company_id));

create policy "numbering_settings_update_owner_only"
on public.numbering_settings
for update
to authenticated
using (public.is_company_owner(company_id))
with check (public.is_company_owner(company_id));

create policy "numbering_settings_delete_owner_only"
on public.numbering_settings
for delete
to authenticated
using (public.is_company_owner(company_id));


-- ============================================================
-- FILE: supabase/migrations/20260707120000_document_numbering_generation.sql
-- ============================================================
-- Phase 2C: Document Number Generation Backend
--
-- Adds the minimal `documents` table needed to test/exercise backend-safe
-- number generation, a `numbering_sequences` counter table, and the
-- `approve_document` RPC that atomically assigns the official
-- document_number when a Draft is approved.
--
-- `documents` here is intentionally minimal (no line items, VAT, customer
-- FK, template rendering, etc.) — full document CRUD is Phase 3/4's job.
-- This table only carries what Phase 2C's numbering logic needs: type,
-- status, an optional customer_code for the {CUSTOMER_CODE} token, and the
-- resulting document_number. Phase 3/4 can extend this table with more
-- columns (e.g. a real customer_id FK once a customers table exists)
-- without needing to touch anything added here.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- Text + check (not a Postgres enum), matching numbering_settings'
  -- document_type column for the same reason — see that migration's
  -- comment. Duplicated here rather than shared via a domain/enum type so
  -- each table's constraint can evolve independently if Phase 3/4 needs to.
  document_type text not null check (
    document_type in (
      'RFQ', 'QUOTATION', 'INVOICE', 'TAX_INVOICE', 'RECEIPT',
      'RECEIPT_TAX_INVOICE', 'CREDIT_NOTE', 'CREDIT_NOTE_TAX'
    )
  ),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED')),
  -- Plain code, not a customer_id FK — there's no customers table yet.
  -- Only used to render the {CUSTOMER_CODE} numbering token.
  customer_code text,
  -- Null while DRAFT. Set exactly once, by approve_document() below —
  -- there is deliberately no UPDATE grant/policy on this table at all, so
  -- no direct client write (RLS or not) can ever touch this column.
  document_number text,
  created_by uuid not null references auth.users (id),
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_number_unique unique (company_id, document_number)
);

create index documents_company_id_idx on public.documents (company_id);

create trigger set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

-- No update grant at all: combined with there being no UPDATE policy
-- either, this makes every column — document_number and status very much
-- included — immutable to ordinary clients regardless of RLS. The only
-- way status/document_number ever change is approve_document(), a
-- security definer function that bypasses both the grant and RLS via its
-- owner's privileges. Same "grant restricts the table, RLS restricts the
-- rows" pattern as audit_logs' append-only design (Phase 1B).
grant select, insert, delete on public.documents to authenticated;

create policy "documents_select_same_company"
on public.documents
for select
to authenticated
using (public.is_company_member(company_id));

-- Only roles that can meaningfully author documents may create Drafts —
-- VIEWER cannot. document_number must be null and status must be DRAFT at
-- insert time (the only way to create a document is as an empty Draft).
create policy "documents_insert_editors"
on public.documents
for insert
to authenticated
with check (
  status = 'DRAFT'
  and document_number is null
  and created_by = auth.uid()
  and public.has_company_role(company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
);

-- Deleting a Draft never touches numbering_sequences (Drafts never had a
-- running number to begin with), so this can never create a gap in the
-- sequence. Only Drafts are deletable — once APPROVED/PAID/CANCELLED, a
-- document (and its document_number) is permanent.
create policy "documents_delete_draft_only"
on public.documents
for delete
to authenticated
using (
  status = 'DRAFT'
  and public.has_company_role(company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
);

-- numbering_sequences ----------------------------------------------------
-- One row per (company, document_type, sequence_key) running counter.
-- sequence_key encodes the reset bucket derived from that type's
-- numbering_settings.reset_policy — e.g. '20260701' for DAILY, '202607'
-- for MONTHLY, '2026' for YEARLY, or a constant for NEVER — so a new
-- bucket naturally starts a fresh counter at 1 with no extra logic.
create table public.numbering_sequences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  document_type text not null check (
    document_type in (
      'RFQ', 'QUOTATION', 'INVOICE', 'TAX_INVOICE', 'RECEIPT',
      'RECEIPT_TAX_INVOICE', 'CREDIT_NOTE', 'CREDIT_NOTE_TAX'
    )
  ),
  sequence_key text not null,
  running_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint numbering_sequences_unique unique (company_id, document_type, sequence_key)
);

create trigger set_updated_at
  before update on public.numbering_sequences
  for each row execute function public.set_updated_at();

alter table public.numbering_sequences enable row level security;

-- Select-only grant: every write happens inside approve_document() via
-- its security definer privileges, never through a direct client call —
-- same reasoning as documents' immutability above.
grant select on public.numbering_sequences to authenticated;

create policy "numbering_sequences_select_same_company"
on public.numbering_sequences
for select
to authenticated
using (public.is_company_member(company_id));

-- render_numbering_pattern -------------------------------------------------
-- Pure token substitution — mirrors src/lib/validations/numberingPattern.ts's
-- renderPatternPreview() token-for-token. The two must be kept in sync by
-- hand (Postgres has no regex-replace-with-callback, so this uses a fixed
-- sequence of literal replace() calls instead of one generic regex pass).
create or replace function public.render_numbering_pattern(
  p_pattern text,
  p_company_code text,
  p_branch_code text,
  p_doc_type_code text,
  p_customer_code text,
  p_running_number integer,
  p_at timestamptz
)
returns text
language plpgsql
immutable
as $$
declare
  v_result text := p_pattern;
begin
  v_result := replace(v_result, '{COMPANY_CODE}', coalesce(p_company_code, ''));
  v_result := replace(v_result, '{BRANCH_CODE}', coalesce(p_branch_code, ''));
  v_result := replace(v_result, '{DOC_TYPE}', coalesce(p_doc_type_code, ''));
  v_result := replace(v_result, '{CUSTOMER_CODE}', coalesce(p_customer_code, ''));
  v_result := replace(v_result, '{YYYY}', to_char(p_at, 'YYYY'));
  v_result := replace(v_result, '{YY}', to_char(p_at, 'YY'));
  v_result := replace(v_result, '{MM}', to_char(p_at, 'MM'));
  v_result := replace(v_result, '{DD}', to_char(p_at, 'DD'));
  v_result := replace(v_result, '{RUNNING:3}', lpad(p_running_number::text, 3, '0'));
  v_result := replace(v_result, '{RUNNING:4}', lpad(p_running_number::text, 4, '0'));
  v_result := replace(v_result, '{RUNNING:5}', lpad(p_running_number::text, 5, '0'));
  return v_result;
end;
$$;

-- approve_document ---------------------------------------------------------
create or replace function public.approve_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents;
  v_company public.companies;
  v_settings public.numbering_settings;
  v_doc_type_code text;
  v_sequence_key text;
  v_running_number integer;
  v_document_number text;
  v_attempt integer := 0;
  v_max_attempts constant integer := 3;
begin
  select * into v_document from public.documents where id = p_document_id for update;
  if v_document is null then
    raise exception 'ไม่พบเอกสาร';
  end if;

  if not public.has_company_role(
    v_document.company_id,
    array['OWNER', 'ADMIN', 'ACCOUNTANT']::public.member_role[]
  ) then
    raise exception 'คุณไม่มีสิทธิ์อนุมัติเอกสาร';
  end if;

  if v_document.status <> 'DRAFT' then
    raise exception 'เอกสารนี้ไม่ได้อยู่ในสถานะฉบับร่าง ไม่สามารถอนุมัติซ้ำได้';
  end if;

  select * into v_company from public.companies where id = v_document.company_id;

  -- Prefer a per-document-type override, fall back to the company-wide default.
  select * into v_settings
  from public.numbering_settings
  where company_id = v_document.company_id
    and document_type = v_document.document_type
  limit 1;

  if v_settings is null then
    select * into v_settings
    from public.numbering_settings
    where company_id = v_document.company_id
      and document_type is null
    limit 1;
  end if;

  if v_settings is null then
    raise exception 'บริษัทยังไม่ได้ตั้งค่ารูปแบบเลขที่เอกสาร กรุณาตั้งค่าก่อนอนุมัติเอกสาร';
  end if;

  if v_settings.pattern like '%{CUSTOMER_CODE}%'
    and (v_document.customer_code is null or btrim(v_document.customer_code) = '') then
    raise exception 'รูปแบบเลขที่เอกสารนี้ต้องมีรหัสลูกค้า กรุณาระบุรหัสลูกค้าก่อนอนุมัติ';
  end if;

  v_sequence_key := case v_settings.reset_policy
    when 'DAILY' then to_char(now(), 'YYYYMMDD')
    when 'MONTHLY' then to_char(now(), 'YYYYMM')
    when 'YEARLY' then to_char(now(), 'YYYY')
    else 'ALL'
  end;

  -- Kept in sync by hand with src/types/document.ts's documentTypeShortCode.
  v_doc_type_code := case v_document.document_type
    when 'RFQ' then 'RQ'
    when 'QUOTATION' then 'QO'
    when 'INVOICE' then 'IV'
    when 'TAX_INVOICE' then 'TI'
    when 'RECEIPT' then 'RE'
    when 'RECEIPT_TAX_INVOICE' then 'RTI'
    when 'CREDIT_NOTE' then 'CN'
    when 'CREDIT_NOTE_TAX' then 'CNT'
    else v_document.document_type
  end;

  loop
    v_attempt := v_attempt + 1;

    -- Atomic increment: ON CONFLICT DO UPDATE takes a row lock, so
    -- concurrent approvals for the same (company, type, bucket) safely
    -- serialize here without any explicit advisory lock.
    insert into public.numbering_sequences (company_id, document_type, sequence_key, running_number)
    values (v_document.company_id, v_document.document_type, v_sequence_key, 1)
    on conflict (company_id, document_type, sequence_key)
    do update set running_number = numbering_sequences.running_number + 1
    returning running_number into v_running_number;

    v_document_number := public.render_numbering_pattern(
      v_settings.pattern,
      v_company.company_code,
      v_company.branch_code,
      v_doc_type_code,
      v_document.customer_code,
      v_running_number,
      now()
    );

    begin
      update public.documents
      set status = 'APPROVED',
          document_number = v_document_number,
          approved_by = auth.uid(),
          approved_at = now()
      where id = p_document_id
      returning * into v_document;

      exit; -- succeeded, break out of the retry loop
    exception when unique_violation then
      if v_attempt >= v_max_attempts then
        raise exception 'ไม่สามารถออกเลขที่เอกสารได้ กรุณาลองใหม่อีกครั้ง (เลขที่เอกสารซ้ำ)';
      end if;
      -- fall through and loop again: the next iteration's insert...on
      -- conflict advances running_number past the colliding value.
    end;
  end loop;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_document.company_id, auth.uid(), 'DOCUMENT_NUMBER_GENERATED', 'document', v_document.id,
    jsonb_build_object('documentNumber', v_document_number, 'sequenceKey', v_sequence_key, 'runningNumber', v_running_number)
  );

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_document.company_id, auth.uid(), 'APPROVE_DOCUMENT', 'document', v_document.id,
    jsonb_build_object('documentNumber', v_document_number, 'documentType', v_document.document_type)
  );

  return v_document;
end;
$$;

grant execute on function public.approve_document(uuid) to authenticated;


-- ============================================================
-- FILE: supabase/migrations/20260708120000_customers.sql
-- ============================================================
-- Phase 3A: Customer Management
--
-- One row per customer, scoped to a company. Soft-deleted (deleted_at/
-- deleted_by) rather than hard-deleted so historical documents (Phase
-- 3B/4A onward) can still reference a customer that's since been removed
-- from active use — same reasoning as companies' own soft-delete
-- (Phase 1E).

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_code text not null check (char_length(customer_code) between 1 and 20),
  name text not null check (char_length(name) between 1 and 200),
  tax_id text,
  branch text,
  address text,
  phone text,
  email text,
  contact_name text,
  note text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id)
);

create index customers_company_id_idx on public.customers (company_id);

-- customer_code only needs to be unique among a company's *active*
-- customers — once soft-deleted, that code is free to be reused by a
-- genuinely new customer later.
create unique index customers_unique_code_among_active
  on public.customers (company_id, customer_code)
  where deleted_at is null;

create trigger set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

-- No DELETE grant at all — customers are only ever soft-deleted via
-- UPDATE (deleted_at/deleted_by), never hard-deleted by a client.
grant select, insert, update on public.customers to authenticated;

-- RLS doesn't filter deleted_at itself (same pattern as companies'
-- deleted_at handling in Phase 1E) — the frontend explicitly filters
-- `.is('deleted_at', null)` for the normal active-customer list, and can
-- deliberately omit that filter later if a "show deleted" view is ever
-- needed.
create policy "customers_select_same_company"
on public.customers
for select
to authenticated
using (public.is_company_member(company_id));

-- VIEWER can read but not create/edit — same role list as documents
-- (Phase 2C): customers are content EDITOR is meant to manage, unlike
-- company-level config which stays OWNER-only.
create policy "customers_insert_editors"
on public.customers
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.has_company_role(company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
);

-- Covers both ordinary field edits and the soft-delete action itself
-- (setting deleted_at/deleted_by is just another UPDATE) — no separate
-- RPC is needed here, unlike Phase 2C's document approval, since there's
-- no atomic counter or collision concern, just a plain field write.
create policy "customers_update_editors"
on public.customers
for update
to authenticated
using (public.has_company_role(company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[]))
with check (public.has_company_role(company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[]));


-- ============================================================
-- FILE: supabase/migrations/20260709120000_document_drafts.sql
-- ============================================================
-- Phase 4A: Document Draft Management
--
-- Extends the minimal `documents` table from Phase 2C with everything a
-- real Draft needs (customer, VAT mode, dates, note, document-level
-- discount, and the computed totals), and adds `document_items` for line
-- items. Approval behavior (Phase 4B) is untouched — `approve_document()`
-- only ever reads company_id/document_type/customer_code, none of which
-- change shape here.

alter table public.documents
  add column customer_id uuid references public.customers (id),
  add column vat_mode text not null default 'VAT_EXCLUDED' check (
    vat_mode in ('NON_VAT', 'VAT_EXCLUDED', 'VAT_INCLUDED')
  ),
  add column issue_date date not null default current_date,
  add column due_date date,
  add column note text,
  add column document_discount_type text not null default 'AMOUNT' check (
    document_discount_type in ('AMOUNT', 'PERCENT')
  ),
  add column document_discount_value numeric(14, 2) not null default 0,
  add column subtotal numeric(14, 2) not null default 0,
  add column discount_total numeric(14, 2) not null default 0,
  add column vat_amount numeric(14, 2) not null default 0,
  add column grand_total numeric(14, 2) not null default 0;

-- customer_id is nullable at the DB level (kept flexible, same reasoning
-- as most optional business fields elsewhere in this schema) even though
-- the frontend's Zod schema requires selecting a customer to save a
-- Draft — the strict gate is the app layer, not a NOT NULL constraint.

comment on column public.documents.customer_id is
  'Real FK to customers (Phase 3A). customer_code (Phase 2C) is still set alongside it — a denormalized snapshot the numbering system already reads directly, so approve_document() needed no changes here.';

-- Phase 2C deliberately shipped documents with no UPDATE grant/policy at
-- all (every column was "immutable outside approve_document()"). Now that
-- Drafts need to be editable, this adds a narrowly-scoped UPDATE: allowed
-- only while status stays 'DRAFT' on both sides of the update (so this
-- policy can never itself move a document out of Draft — approve_document()
-- remains the only path for that), and document_number must stay null.
grant update on public.documents to authenticated;

create policy "documents_update_draft_only"
on public.documents
for update
to authenticated
using (
  status = 'DRAFT'
  and public.has_company_role(company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
)
with check (
  status = 'DRAFT'
  and document_number is null
  and public.has_company_role(company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
);

-- document_items ----------------------------------------------------------
create table public.document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 500),
  quantity numeric(14, 3) not null default 1,
  unit text,
  unit_price numeric(14, 2) not null default 0,
  discount_type text not null default 'AMOUNT' check (discount_type in ('AMOUNT', 'PERCENT')),
  discount_value numeric(14, 2) not null default 0,
  -- Computed by src/lib/calculations/documentTotals.ts and persisted
  -- as-calculated, not recomputed by the DB — same "app computes, DB
  -- stores the snapshot" approach as documents.grand_total etc.
  amount numeric(14, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index document_items_document_id_idx on public.document_items (document_id);

create trigger set_updated_at
  before update on public.document_items
  for each row execute function public.set_updated_at();

alter table public.document_items enable row level security;

grant select, insert, update, delete on public.document_items to authenticated;

-- No company_id column here — every policy joins through documents,
-- since that's the row that actually carries company_id and status.
create policy "document_items_select_same_company"
on public.document_items
for select
to authenticated
using (
  exists (
    select 1 from public.documents d
    where d.id = document_items.document_id
      and public.is_company_member(d.company_id)
  )
);

-- Insert/update/delete all require the parent document to still be a
-- Draft — this is what actually enforces "Approved/Paid/Cancelled
-- documents are read-only" for line items, on top of the equivalent
-- documents_update_draft_only policy on the parent row itself.
create policy "document_items_insert_draft_only"
on public.document_items
for insert
to authenticated
with check (
  exists (
    select 1 from public.documents d
    where d.id = document_items.document_id
      and d.status = 'DRAFT'
      and public.has_company_role(d.company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
  )
);

create policy "document_items_update_draft_only"
on public.document_items
for update
to authenticated
using (
  exists (
    select 1 from public.documents d
    where d.id = document_items.document_id
      and d.status = 'DRAFT'
      and public.has_company_role(d.company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
  )
)
with check (
  exists (
    select 1 from public.documents d
    where d.id = document_items.document_id
      and d.status = 'DRAFT'
      and public.has_company_role(d.company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
  )
);

create policy "document_items_delete_draft_only"
on public.document_items
for delete
to authenticated
using (
  exists (
    select 1 from public.documents d
    where d.id = document_items.document_id
      and d.status = 'DRAFT'
      and public.has_company_role(d.company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
  )
);


-- ============================================================
-- FILE: supabase/migrations/20260710120000_document_status_actions.sql
-- ============================================================
-- Phase 4B: Approve, Official Number & Immutability — status actions beyond
-- approve_document() (Phase 2C). Mark-as-Paid and Cancel both need the same
-- kind of controlled, role-checked status transition that approve_document
-- already established, so they follow the identical shape: security
-- definer RPCs (documents has no UPDATE grant for non-Draft rows at all —
-- see Phase 2C/4A migrations — so a direct client UPDATE can never reach
-- these rows regardless of RLS), each self-logging its own audit event
-- rather than relying on a separate client-side logAuditEvent() call.

-- mark_document_paid --------------------------------------------------------
-- APPROVED -> PAID only. A document must have its official document_number
-- before it can be marked paid, which APPROVED already guarantees.
create or replace function public.mark_document_paid(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents;
begin
  select * into v_document from public.documents where id = p_document_id for update;
  if v_document is null then
    raise exception 'ไม่พบเอกสาร';
  end if;

  if not public.has_company_role(
    v_document.company_id,
    array['OWNER', 'ADMIN', 'ACCOUNTANT']::public.member_role[]
  ) then
    raise exception 'คุณไม่มีสิทธิ์บันทึกการชำระเงิน';
  end if;

  if v_document.status <> 'APPROVED' then
    raise exception 'บันทึกชำระเงินได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น';
  end if;

  update public.documents
  set status = 'PAID'
  where id = p_document_id
  returning * into v_document;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_document.company_id, auth.uid(), 'MARK_DOCUMENT_PAID', 'document', v_document.id,
    jsonb_build_object('documentNumber', v_document.document_number)
  );

  return v_document;
end;
$$;

grant execute on function public.mark_document_paid(uuid) to authenticated;

-- cancel_document ------------------------------------------------------------
-- APPROVED -> CANCELLED only. Drafts are discarded via the existing delete
-- flow (documents_delete_draft_only, Phase 2C) instead of being cancelled —
-- they never had an official number to void. PAID documents are final and
-- not cancellable here (correcting a paid document is a future-phase credit
-- note concern, not a status flip).
create or replace function public.cancel_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents;
begin
  select * into v_document from public.documents where id = p_document_id for update;
  if v_document is null then
    raise exception 'ไม่พบเอกสาร';
  end if;

  if not public.has_company_role(
    v_document.company_id,
    array['OWNER', 'ADMIN', 'ACCOUNTANT']::public.member_role[]
  ) then
    raise exception 'คุณไม่มีสิทธิ์ยกเลิกเอกสาร';
  end if;

  if v_document.status <> 'APPROVED' then
    raise exception 'ยกเลิกได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น';
  end if;

  update public.documents
  set status = 'CANCELLED'
  where id = p_document_id
  returning * into v_document;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_document.company_id, auth.uid(), 'CANCEL_DOCUMENT', 'document', v_document.id,
    jsonb_build_object('documentNumber', v_document.document_number)
  );

  return v_document;
end;
$$;

grant execute on function public.cancel_document(uuid) to authenticated;


-- ============================================================
-- FILE: supabase/migrations/20260711120000_document_revisions.sql
-- ============================================================
-- Phase 4C: Document Revision
--
-- A revision is an ordinary `documents` row (same table, same lifecycle:
-- DRAFT -> APPROVED, and via Phase 4B's RPCs, -> PAID/CANCELLED) that
-- additionally carries `parent_document_id`, pointing back at the
-- original (never-revised) document it was created from. Editing a
-- revision Draft reuses Phase 4A's saveDraftDocument()/DocumentForm flow
-- completely unchanged — `documents_update_draft_only` already keys off
-- `status = 'DRAFT'` alone, so a revision Draft is just as editable as
-- any other Draft with zero new code.

alter table public.documents
  add column parent_document_id uuid references public.documents (id),
  add column revision_no integer;

comment on column public.documents.parent_document_id is
  'Set only on a revision row — always references the ORIGINAL document
  (a row whose own parent_document_id is null), never another revision.
  Revising a revision is not supported in this phase (see
  create_document_revision() below); null for every ordinary document.';

comment on column public.documents.revision_no is
  'Null until a revision Draft is approved (mirrors document_number''s
  own null-while-Draft convention). Assigned by approve_document() as
  1, 2, 3... in approval order among revisions sharing the same
  parent_document_id, and combined with the parent''s document_number to
  render "PARENT_NUMBER-R{n}". Always null for non-revision documents.';

create index documents_parent_document_id_idx on public.documents (parent_document_id);

-- Defensive backstop (mirrors documents_number_unique's role): two
-- approved revisions of the same parent can never end up with the same
-- revision_no. NULLs (every non-revision row, and every not-yet-approved
-- revision Draft) are never considered equal to each other under
-- standard SQL unique-constraint semantics, so this only ever constrains
-- actual approved revisions.
alter table public.documents
  add constraint documents_revision_no_unique unique (parent_document_id, revision_no);

-- Tighten the ordinary insert policy: a direct client insert (the normal
-- "new Draft" flow, Phase 2C/4A) can never set parent_document_id itself.
-- A revision Draft can only come from create_document_revision() below,
-- whose security definer privileges bypass this policy entirely — the
-- same "only a controlled function can produce this shape of row"
-- pattern as document_number/status being unreachable outside
-- approve_document().
drop policy "documents_insert_editors" on public.documents;

create policy "documents_insert_editors"
on public.documents
for insert
to authenticated
with check (
  status = 'DRAFT'
  and document_number is null
  and parent_document_id is null
  and created_by = auth.uid()
  and public.has_company_role(company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
);

-- create_document_revision ---------------------------------------------
-- Creates a new Draft, copying customer, line items, VAT mode, note,
-- payment term (due_date), document type, and totals from an APPROVED,
-- non-revision source document. Deliberately does NOT copy issue_date
-- (a revision is freshly issued "now", defaulting to current_date) —
-- every other field the master spec's copy list names is carried over
-- verbatim. "Template" isn't a per-document field at all — it's the
-- owning company's document_template, which the revision already
-- inherits automatically by staying in the same company.
create or replace function public.create_document_revision(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.documents;
  v_new public.documents;
begin
  select * into v_source from public.documents where id = p_document_id;
  if v_source is null then
    raise exception 'ไม่พบเอกสาร';
  end if;

  if not public.has_company_role(
    v_source.company_id,
    array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[]
  ) then
    raise exception 'คุณไม่มีสิทธิ์สร้าง Revision';
  end if;

  if v_source.status <> 'APPROVED' then
    raise exception 'สร้าง Revision ได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น';
  end if;

  -- Only an original may be revised — never a revision of a revision.
  -- This keeps "PARENT_NUMBER-R{n}" well-defined without needing to walk
  -- an arbitrarily deep chain to find the true root.
  if v_source.parent_document_id is not null then
    raise exception 'ไม่สามารถสร้าง Revision จากเอกสารที่เป็น Revision ได้';
  end if;

  insert into public.documents (
    company_id, document_type, status, customer_id, customer_code,
    document_number, parent_document_id, revision_no,
    vat_mode, issue_date, due_date, note,
    document_discount_type, document_discount_value,
    subtotal, discount_total, vat_amount, grand_total,
    created_by
  )
  values (
    v_source.company_id, v_source.document_type, 'DRAFT', v_source.customer_id, v_source.customer_code,
    null, v_source.id, null,
    v_source.vat_mode, current_date, v_source.due_date, v_source.note,
    v_source.document_discount_type, v_source.document_discount_value,
    v_source.subtotal, v_source.discount_total, v_source.vat_amount, v_source.grand_total,
    auth.uid()
  )
  returning * into v_new;

  insert into public.document_items (
    document_id, description, quantity, unit, unit_price, discount_type, discount_value, amount, sort_order
  )
  select v_new.id, description, quantity, unit, unit_price, discount_type, discount_value, amount, sort_order
  from public.document_items
  where document_id = v_source.id
  order by sort_order;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_source.company_id, auth.uid(), 'CREATE_DOCUMENT_REVISION', 'document', v_new.id,
    jsonb_build_object('parentDocumentId', v_source.id, 'parentDocumentNumber', v_source.document_number)
  );

  return v_new;
end;
$$;

grant execute on function public.create_document_revision(uuid) to authenticated;

-- approve_document -----------------------------------------------------
-- Extended (create or replace, same function/signature — Phase 2C's
-- original body is preserved for the non-revision path) to branch when
-- the Draft being approved is a revision: skip numbering_settings/
-- numbering_sequences/pattern rendering entirely (a revision never gets
-- its own independent running number) and instead derive
-- "PARENT_NUMBER-R{n}" from the locked parent row.
create or replace function public.approve_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents;
  v_company public.companies;
  v_settings public.numbering_settings;
  v_doc_type_code text;
  v_sequence_key text;
  v_running_number integer;
  v_document_number text;
  v_attempt integer := 0;
  v_max_attempts constant integer := 3;
  v_parent public.documents;
  v_revision_no integer;
begin
  select * into v_document from public.documents where id = p_document_id for update;
  if v_document is null then
    raise exception 'ไม่พบเอกสาร';
  end if;

  if not public.has_company_role(
    v_document.company_id,
    array['OWNER', 'ADMIN', 'ACCOUNTANT']::public.member_role[]
  ) then
    raise exception 'คุณไม่มีสิทธิ์อนุมัติเอกสาร';
  end if;

  if v_document.status <> 'DRAFT' then
    raise exception 'เอกสารนี้ไม่ได้อยู่ในสถานะฉบับร่าง ไม่สามารถอนุมัติซ้ำได้';
  end if;

  if v_document.parent_document_id is not null then
    -- Revision path: lock the parent row so two concurrent approvals of
    -- different revisions sharing the same parent serialize on this lock
    -- instead of racing to compute the same next revision_no.
    select * into v_parent from public.documents where id = v_document.parent_document_id for update;
    if v_parent is null or v_parent.document_number is null then
      raise exception 'ไม่พบเอกสารต้นฉบับ หรือเอกสารต้นฉบับยังไม่มีเลขที่เอกสาร';
    end if;

    loop
      v_attempt := v_attempt + 1;

      select coalesce(max(revision_no), 0) + 1 into v_revision_no
      from public.documents
      where parent_document_id = v_document.parent_document_id
        and revision_no is not null;

      v_document_number := v_parent.document_number || '-R' || v_revision_no::text;

      begin
        update public.documents
        set status = 'APPROVED',
            document_number = v_document_number,
            revision_no = v_revision_no,
            approved_by = auth.uid(),
            approved_at = now()
        where id = p_document_id
        returning * into v_document;

        exit;
      exception when unique_violation then
        if v_attempt >= v_max_attempts then
          raise exception 'ไม่สามารถออกเลขที่ Revision ได้ กรุณาลองใหม่อีกครั้ง (เลขที่ซ้ำ)';
        end if;
      end;
    end loop;

    insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
    values (
      v_document.company_id, auth.uid(), 'APPROVE_REVISION', 'document', v_document.id,
      jsonb_build_object(
        'documentNumber', v_document_number, 'revisionNo', v_revision_no,
        'parentDocumentId', v_document.parent_document_id
      )
    );

    return v_document;
  end if;

  -- Original path — unchanged from Phase 2C.
  select * into v_company from public.companies where id = v_document.company_id;

  select * into v_settings
  from public.numbering_settings
  where company_id = v_document.company_id
    and document_type = v_document.document_type
  limit 1;

  if v_settings is null then
    select * into v_settings
    from public.numbering_settings
    where company_id = v_document.company_id
      and document_type is null
    limit 1;
  end if;

  if v_settings is null then
    raise exception 'บริษัทยังไม่ได้ตั้งค่ารูปแบบเลขที่เอกสาร กรุณาตั้งค่าก่อนอนุมัติเอกสาร';
  end if;

  if v_settings.pattern like '%{CUSTOMER_CODE}%'
    and (v_document.customer_code is null or btrim(v_document.customer_code) = '') then
    raise exception 'รูปแบบเลขที่เอกสารนี้ต้องมีรหัสลูกค้า กรุณาระบุรหัสลูกค้าก่อนอนุมัติ';
  end if;

  v_sequence_key := case v_settings.reset_policy
    when 'DAILY' then to_char(now(), 'YYYYMMDD')
    when 'MONTHLY' then to_char(now(), 'YYYYMM')
    when 'YEARLY' then to_char(now(), 'YYYY')
    else 'ALL'
  end;

  v_doc_type_code := case v_document.document_type
    when 'RFQ' then 'RQ'
    when 'QUOTATION' then 'QO'
    when 'INVOICE' then 'IV'
    when 'TAX_INVOICE' then 'TI'
    when 'RECEIPT' then 'RE'
    when 'RECEIPT_TAX_INVOICE' then 'RTI'
    when 'CREDIT_NOTE' then 'CN'
    when 'CREDIT_NOTE_TAX' then 'CNT'
    else v_document.document_type
  end;

  v_attempt := 0;
  loop
    v_attempt := v_attempt + 1;

    insert into public.numbering_sequences (company_id, document_type, sequence_key, running_number)
    values (v_document.company_id, v_document.document_type, v_sequence_key, 1)
    on conflict (company_id, document_type, sequence_key)
    do update set running_number = numbering_sequences.running_number + 1
    returning running_number into v_running_number;

    v_document_number := public.render_numbering_pattern(
      v_settings.pattern,
      v_company.company_code,
      v_company.branch_code,
      v_doc_type_code,
      v_document.customer_code,
      v_running_number,
      now()
    );

    begin
      update public.documents
      set status = 'APPROVED',
          document_number = v_document_number,
          approved_by = auth.uid(),
          approved_at = now()
      where id = p_document_id
      returning * into v_document;

      exit;
    exception when unique_violation then
      if v_attempt >= v_max_attempts then
        raise exception 'ไม่สามารถออกเลขที่เอกสารได้ กรุณาลองใหม่อีกครั้ง (เลขที่เอกสารซ้ำ)';
      end if;
    end;
  end loop;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_document.company_id, auth.uid(), 'DOCUMENT_NUMBER_GENERATED', 'document', v_document.id,
    jsonb_build_object('documentNumber', v_document_number, 'sequenceKey', v_sequence_key, 'runningNumber', v_running_number)
  );

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_document.company_id, auth.uid(), 'APPROVE_DOCUMENT', 'document', v_document.id,
    jsonb_build_object('documentNumber', v_document_number, 'documentType', v_document.document_type)
  );

  return v_document;
end;
$$;

grant execute on function public.approve_document(uuid) to authenticated;


-- ============================================================
-- FILE: supabase/migrations/20260712120000_document_conversion.sql
-- ============================================================
-- Phase 6A: Document Conversion
--
-- A conversion is an ordinary `documents` row (same table, same DRAFT ->
-- APPROVED -> PAID/CANCELLED lifecycle as any other document) that
-- additionally carries `source_document_id`, pointing back at the
-- APPROVED document it was converted FROM — a different document_type,
-- unlike a revision (which keeps the same type). The two lineages are
-- deliberately independent columns: a document can be a revision, a
-- conversion target, both, or neither, with zero interaction between
-- them. Editing a conversion Draft reuses Phase 4A's
-- saveDraftDocument()/DocumentForm flow completely unchanged, exactly
-- like a revision Draft does — documents_update_draft_only only ever
-- checks `status = 'DRAFT'`.

alter table public.documents
  add column source_document_id uuid references public.documents (id);

comment on column public.documents.source_document_id is
  'Set only on a document created via conversion (Phase 6A) — the
  APPROVED document it was converted FROM, which always has a different
  document_type. Independent of parent_document_id (revision lineage).';

create index documents_source_document_id_idx on public.documents (source_document_id);

-- is_valid_document_conversion -------------------------------------------
-- The allowed conversion graph, kept in sync by hand with
-- src/types/document.ts's documentConversionMap. A directed acyclic
-- graph — every edge moves further along the sales-to-collection
-- lifecycle, nothing points back to an earlier stage, so no chain of
-- conversions can ever loop.
create or replace function public.is_valid_document_conversion(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'RFQ' then p_to in ('QUOTATION')
    when 'QUOTATION' then p_to in ('INVOICE')
    when 'INVOICE' then p_to in ('RECEIPT', 'TAX_INVOICE')
    when 'RECEIPT' then p_to in ('RECEIPT_TAX_INVOICE')
    when 'RECEIPT_TAX_INVOICE' then p_to in ('CREDIT_NOTE_TAX')
    when 'TAX_INVOICE' then p_to in ('CREDIT_NOTE', 'CREDIT_NOTE_TAX')
    else false
  end;
$$;

-- create_document_conversion ----------------------------------------------
-- Creates a new Draft of a different (but related) document_type,
-- copying customer, line items, VAT mode, note, payment term (due_date),
-- and totals from an APPROVED source — same copy list and the same
-- "issue_date is NOT copied, template is inherited automatically via
-- company_id" reasoning as create_document_revision().
create or replace function public.create_document_conversion(p_document_id uuid, p_target_type text)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.documents;
  v_new public.documents;
begin
  select * into v_source from public.documents where id = p_document_id;
  if v_source is null then
    raise exception 'ไม่พบเอกสาร';
  end if;

  if not public.has_company_role(
    v_source.company_id,
    array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[]
  ) then
    raise exception 'คุณไม่มีสิทธิ์แปลงเอกสาร';
  end if;

  if v_source.status <> 'APPROVED' then
    raise exception 'แปลงเอกสารได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น';
  end if;

  if not public.is_valid_document_conversion(v_source.document_type, p_target_type) then
    raise exception 'ไม่สามารถแปลงเอกสารประเภทนี้เป็นประเภทที่เลือกได้';
  end if;

  insert into public.documents (
    company_id, document_type, status, customer_id, customer_code,
    document_number, parent_document_id, revision_no, source_document_id,
    vat_mode, issue_date, due_date, note,
    document_discount_type, document_discount_value,
    subtotal, discount_total, vat_amount, grand_total,
    created_by
  )
  values (
    v_source.company_id, p_target_type, 'DRAFT', v_source.customer_id, v_source.customer_code,
    null, null, null, v_source.id,
    v_source.vat_mode, current_date, v_source.due_date, v_source.note,
    v_source.document_discount_type, v_source.document_discount_value,
    v_source.subtotal, v_source.discount_total, v_source.vat_amount, v_source.grand_total,
    auth.uid()
  )
  returning * into v_new;

  insert into public.document_items (
    document_id, description, quantity, unit, unit_price, discount_type, discount_value, amount, sort_order
  )
  select v_new.id, description, quantity, unit, unit_price, discount_type, discount_value, amount, sort_order
  from public.document_items
  where document_id = v_source.id
  order by sort_order;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_source.company_id, auth.uid(), 'CONVERT_DOCUMENT', 'document', v_new.id,
    jsonb_build_object(
      'sourceDocumentId', v_source.id, 'sourceDocumentType', v_source.document_type,
      'targetType', p_target_type
    )
  );

  return v_new;
end;
$$;

grant execute on function public.create_document_conversion(uuid, text) to authenticated;


-- ============================================================
-- FILE: supabase/migrations/20260713120000_paid_cascade.sql
-- ============================================================
-- Production readiness: Mark as Paid is only meaningful on documents that
-- represent actual money collected (RECEIPT / RECEIPT_TAX_INVOICE) —
-- QUOTATION, INVOICE (unpaid), TAX_INVOICE, and CREDIT_NOTE/CREDIT_NOTE_TAX
-- must never be marked paid directly. When a receipt is paid, every other
-- APPROVED document connected to it through the conversion chain
-- (source_document_id, in either direction) that still represents the same
-- sale — its parent INVOICE/TAX_INVOICE and any sibling RECEIPT_TAX_INVOICE
-- off the same INVOICE — should become PAID too, since they're the same
-- underlying transaction. QUOTATION/RFQ never carry money owed, so they're
-- excluded from the cascade even though they're in the chain; CREDIT_NOTE
-- documents represent reductions, not sales, so they're excluded too;
-- CANCELLED documents are excluded by the APPROVED-only filter, so they
-- stay terminal without any extra code.
create or replace function public.mark_document_paid(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents;
  v_related public.documents;
begin
  select * into v_document from public.documents where id = p_document_id for update;
  if v_document is null then
    raise exception 'ไม่พบเอกสาร';
  end if;

  if not public.has_company_role(
    v_document.company_id,
    array['OWNER', 'ADMIN', 'ACCOUNTANT']::public.member_role[]
  ) then
    raise exception 'คุณไม่มีสิทธิ์บันทึกการชำระเงิน';
  end if;

  if v_document.status <> 'APPROVED' then
    raise exception 'บันทึกชำระเงินได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น';
  end if;

  if v_document.document_type not in ('RECEIPT', 'RECEIPT_TAX_INVOICE') then
    raise exception 'บันทึกชำระเงินได้เฉพาะใบเสร็จรับเงินเท่านั้น';
  end if;

  update public.documents
  set status = 'PAID'
  where id = p_document_id
  returning * into v_document;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_document.company_id, auth.uid(), 'MARK_DOCUMENT_PAID', 'document', v_document.id,
    jsonb_build_object('documentNumber', v_document.document_number)
  );

  -- Walk the full connected component reachable via source_document_id,
  -- both toward ancestors (this document's source, its source's source,
  -- ...) and toward descendants (documents converted from any id already
  -- in the chain) — a plain recursive union over a finite DAG, so it
  -- terminates and naturally de-duplicates.
  for v_related in
    with recursive chain(id) as (
      select p_document_id
      union
      select d.source_document_id
      from public.documents d
      join chain c on d.id = c.id
      where d.source_document_id is not null
      union
      select d.id
      from public.documents d
      join chain c on d.source_document_id = c.id
    )
    select doc.*
    from public.documents doc
    where doc.id in (select id from chain where id <> p_document_id)
      and doc.company_id = v_document.company_id
      and doc.status = 'APPROVED'
      and doc.document_type in ('INVOICE', 'TAX_INVOICE', 'RECEIPT', 'RECEIPT_TAX_INVOICE')
    for update
  loop
    update public.documents set status = 'PAID' where id = v_related.id;

    insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
    values (
      v_related.company_id, auth.uid(), 'MARK_DOCUMENT_PAID', 'document', v_related.id,
      jsonb_build_object('documentNumber', v_related.document_number, 'cascadedFrom', v_document.document_number)
    );
  end loop;

  return v_document;
end;
$$;

grant execute on function public.mark_document_paid(uuid) to authenticated;


-- ============================================================
-- FILE: supabase/migrations/20260714120000_conversion_after_paid.sql
-- ============================================================
-- Production readiness fix: PAID must not block valid downstream document
-- creation. An INVOICE that has already been marked PAID (directly, or by
-- the mark_document_paid() cascade from a related RECEIPT) still needs to
-- be convertible to RECEIPT and TAX_INVOICE if those weren't created yet
-- — a paid invoice with no receipt/tax invoice on file is a real,
-- everyday accounting gap this app must let a user close. PAID only
-- blocks editing (documents_update_draft_only never matches non-DRAFT
-- rows) and cancelling (cancel_document requires APPROVED) — conversion
-- eligibility is a separate concern and is relaxed here to also accept a
-- PAID source, for every document type in documentConversionMap (not just
-- INVOICE), so the same fix covers e.g. a paid RECEIPT still being
-- convertible to RECEIPT_TAX_INVOICE.
create or replace function public.create_document_conversion(p_document_id uuid, p_target_type text)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.documents;
  v_new public.documents;
begin
  select * into v_source from public.documents where id = p_document_id;
  if v_source is null then
    raise exception 'ไม่พบเอกสาร';
  end if;

  if not public.has_company_role(
    v_source.company_id,
    array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[]
  ) then
    raise exception 'คุณไม่มีสิทธิ์แปลงเอกสาร';
  end if;

  if v_source.status not in ('APPROVED', 'PAID') then
    raise exception 'แปลงเอกสารได้เฉพาะเอกสารที่อนุมัติแล้วหรือชำระแล้วเท่านั้น';
  end if;

  if not public.is_valid_document_conversion(v_source.document_type, p_target_type) then
    raise exception 'ไม่สามารถแปลงเอกสารประเภทนี้เป็นประเภทที่เลือกได้';
  end if;

  insert into public.documents (
    company_id, document_type, status, customer_id, customer_code,
    document_number, parent_document_id, revision_no, source_document_id,
    vat_mode, issue_date, due_date, note,
    document_discount_type, document_discount_value,
    subtotal, discount_total, vat_amount, grand_total,
    created_by
  )
  values (
    v_source.company_id, p_target_type, 'DRAFT', v_source.customer_id, v_source.customer_code,
    null, null, null, v_source.id,
    v_source.vat_mode, current_date, v_source.due_date, v_source.note,
    v_source.document_discount_type, v_source.document_discount_value,
    v_source.subtotal, v_source.discount_total, v_source.vat_amount, v_source.grand_total,
    auth.uid()
  )
  returning * into v_new;

  insert into public.document_items (
    document_id, description, quantity, unit, unit_price, discount_type, discount_value, amount, sort_order
  )
  select v_new.id, description, quantity, unit, unit_price, discount_type, discount_value, amount, sort_order
  from public.document_items
  where document_id = v_source.id
  order by sort_order;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_source.company_id, auth.uid(), 'CONVERT_DOCUMENT', 'document', v_new.id,
    jsonb_build_object(
      'sourceDocumentId', v_source.id, 'sourceDocumentType', v_source.document_type,
      'targetType', p_target_type
    )
  );

  return v_new;
end;
$$;

grant execute on function public.create_document_conversion(uuid, text) to authenticated;
