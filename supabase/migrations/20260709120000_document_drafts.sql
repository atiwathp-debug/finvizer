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
