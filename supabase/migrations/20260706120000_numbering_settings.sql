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
