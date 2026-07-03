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
