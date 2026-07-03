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
