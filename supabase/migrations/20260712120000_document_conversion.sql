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
