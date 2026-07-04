-- Production readiness pass 2: Installment Payment Terms
--
-- document_installments is modeled directly on document_items: no
-- company_id column (joins through documents), same
-- select-any-company-member / write-only-while-DRAFT RLS shape. Also adds
-- documents.installment_number, purely a display/pre-fill hint used by
-- the "assisted single-step" installment-aware conversion flow -- never
-- read by mark_document_paid() or create_document_conversion(), and does
-- not change what amount create_document_conversion() copies (it still
-- always copies the source's full grand_total, unchanged).
alter table public.documents
  add column installment_number integer;

comment on column public.documents.installment_number is
  'Set only when this Draft was pre-filled from picking a specific
  installment during "แปลงเอกสาร" (production readiness pass 2, assisted
  single-step). Purely a display/pre-fill hint -- never read by
  mark_document_paid() or create_document_conversion(). Freely editable
  while the Draft stays DRAFT via the existing documents_update_draft_only
  policy; no new policy needed.';

create table public.document_installments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  installment_no integer not null check (installment_no > 0),
  amount_type text not null default 'PERCENT' check (amount_type in ('PERCENT', 'FIXED')),
  -- Raw input: a percent (0-100) if amount_type = PERCENT, or a baht value
  -- if FIXED. computed_amount is what's actually shown/used everywhere
  -- else -- same "app computes, DB stores the snapshot" approach as
  -- document_items.amount / documents.grand_total.
  amount_value numeric(14, 2) not null default 0,
  computed_amount numeric(14, 2) not null default 0,
  due_date date,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_installments_unique_no unique (document_id, installment_no)
);

create index document_installments_document_id_idx on public.document_installments (document_id);

create trigger set_updated_at
  before update on public.document_installments
  for each row execute function public.set_updated_at();

alter table public.document_installments enable row level security;
grant select, insert, update, delete on public.document_installments to authenticated;

create policy "document_installments_select_same_company"
on public.document_installments
for select
to authenticated
using (
  exists (
    select 1 from public.documents d
    where d.id = document_installments.document_id
      and public.is_company_member(d.company_id)
  )
);

create policy "document_installments_insert_draft_only"
on public.document_installments
for insert
to authenticated
with check (
  exists (
    select 1 from public.documents d
    where d.id = document_installments.document_id
      and d.status = 'DRAFT'
      and public.has_company_role(d.company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
  )
);

create policy "document_installments_update_draft_only"
on public.document_installments
for update
to authenticated
using (
  exists (
    select 1 from public.documents d
    where d.id = document_installments.document_id
      and d.status = 'DRAFT'
      and public.has_company_role(d.company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
  )
)
with check (
  exists (
    select 1 from public.documents d
    where d.id = document_installments.document_id
      and d.status = 'DRAFT'
      and public.has_company_role(d.company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
  )
);

create policy "document_installments_delete_draft_only"
on public.document_installments
for delete
to authenticated
using (
  exists (
    select 1 from public.documents d
    where d.id = document_installments.document_id
      and d.status = 'DRAFT'
      and public.has_company_role(d.company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
  )
);
