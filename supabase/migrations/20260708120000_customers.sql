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
