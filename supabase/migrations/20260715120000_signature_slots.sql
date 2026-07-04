-- Production readiness pass 2: Signature Slots
--
-- One company-wide ordered list of signature slots (buyer + seller by
-- default, freeform extra slots) -- not per-document-type, per explicit
-- product decision. Modeled on numbering_settings' RLS shape (company-level
-- config: select = any member, write = owner only) since this is company
-- configuration, not a per-document editable field.
create table public.signature_slots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  sort_order integer not null default 0,
  -- True only for the two rows a fresh Settings page pre-populates
  -- (ผู้ซื้อ/ผู้ขาย). Informational only -- an Owner can still relabel or
  -- delete these like any other slot; nothing enforces this flag.
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index signature_slots_company_id_idx on public.signature_slots (company_id);

create trigger set_updated_at
  before update on public.signature_slots
  for each row execute function public.set_updated_at();

alter table public.signature_slots enable row level security;
grant select, insert, update, delete on public.signature_slots to authenticated;

create policy "signature_slots_select_same_company"
on public.signature_slots
for select
to authenticated
using (public.is_company_member(company_id));

-- Insert/update/delete are owner-only, same as numbering_settings --
-- signature configuration is company-level config, not a per-member
-- preference or a per-document editable field.
create policy "signature_slots_insert_owner_only"
on public.signature_slots
for insert
to authenticated
with check (public.is_company_owner(company_id));

create policy "signature_slots_update_owner_only"
on public.signature_slots
for update
to authenticated
using (public.is_company_owner(company_id))
with check (public.is_company_owner(company_id));

create policy "signature_slots_delete_owner_only"
on public.signature_slots
for delete
to authenticated
using (public.is_company_owner(company_id));
