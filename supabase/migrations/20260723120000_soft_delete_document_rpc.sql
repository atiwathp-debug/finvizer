-- Pass 5C-B-1: soft_delete_document RPC
--
-- Adds the soft-delete action for documents, on top of the deleted_at/
-- deleted_by columns added in Pass 5B
-- (20260722120000_document_soft_delete.sql). Same security-definer RPC
-- pattern as every other document-state-changing action in this schema
-- (approve_document, mark_document_paid, cancel_document,
-- create_document_conversion, create_document_revision): look up the row,
-- check role/eligibility server-side, write only the intended columns,
-- self-log an audit_logs row, return the full updated row.
--
-- Deliberately additive only — this migration does NOT touch the existing
-- documents_delete_draft_only RLS policy (Phase 2C,
-- 20260707120000_document_numbering_generation.sql). That policy still
-- backs the currently-live hard-delete path: deleteDraftDocument()
-- (src/lib/supabase/documents.ts) and its mock mirror
-- deleteMockDraftDocument() (src/lib/mock/mockDocuments.ts), both called
-- from DocumentDetailPage.tsx's "ลบฉบับร่าง" button today and covered by
-- mockDocuments.test.ts. Dropping/replacing that policy here, before the
-- frontend switches over to this new RPC, would silently break that
-- still-live button in production. The switch-over (frontend calling this
-- RPC instead, and retiring the old policy/function) is deferred to a
-- later pass, done together so neither path is ever left half-migrated.
--
-- Permission rules encoded below (Pass 5C-A design):
--   - VIEWER: never allowed.
--   - status = 'PAID': never allowed, for any role (checked before any
--     role branching, so it can't be bypassed by role).
--   - status = 'DRAFT' (any document_type): OWNER/ADMIN/ACCOUNTANT/EDITOR.
--   - RFQ/QUOTATION, non-DRAFT, not yet converted forward (no other
--     document's source_document_id points at it): OWNER/ADMIN/ACCOUNTANT/EDITOR.
--   - RFQ/QUOTATION, non-DRAFT, converted forward: OWNER/ACCOUNTANT only.
--   - Any other type (INVOICE, TAX_INVOICE, RECEIPT, RECEIPT_TAX_INVOICE,
--     CREDIT_NOTE, CREDIT_NOTE_TAX), non-DRAFT, not PAID (already
--     excluded above): OWNER/ACCOUNTANT only.
--   - Already soft-deleted (deleted_at is not null): never allowed again.
--
-- Only deleted_at/deleted_by are ever written — document_number, status,
-- approved_by/approved_at, parent_document_id, source_document_id, and all
-- computed totals are untouched by construction (the UPDATE's SET clause
-- names only those two columns).

create or replace function public.soft_delete_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents;
  v_converted_forward boolean;
begin
  select * into v_doc from public.documents where id = p_document_id for update;
  if v_doc is null then
    raise exception 'ไม่พบเอกสาร';
  end if;

  if v_doc.deleted_at is not null then
    raise exception 'เอกสารนี้ถูกลบไปแล้ว';
  end if;

  if v_doc.status = 'PAID' then
    raise exception 'ไม่สามารถลบเอกสารที่ชำระแล้วได้';
  end if;

  if v_doc.status = 'DRAFT' then
    if not public.has_company_role(
      v_doc.company_id,
      array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[]
    ) then
      raise exception 'คุณไม่มีสิทธิ์ลบเอกสารนี้';
    end if;

  elsif v_doc.document_type in ('RFQ', 'QUOTATION') then
    select exists(
      select 1 from public.documents where source_document_id = v_doc.id
    ) into v_converted_forward;

    if v_converted_forward then
      if not public.has_company_role(
        v_doc.company_id,
        array['OWNER', 'ACCOUNTANT']::public.member_role[]
      ) then
        raise exception 'คุณไม่มีสิทธิ์ลบเอกสารนี้';
      end if;
    else
      if not public.has_company_role(
        v_doc.company_id,
        array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[]
      ) then
        raise exception 'คุณไม่มีสิทธิ์ลบเอกสารนี้';
      end if;
    end if;

  else
    -- Financial chain document (INVOICE, TAX_INVOICE, RECEIPT,
    -- RECEIPT_TAX_INVOICE, CREDIT_NOTE, CREDIT_NOTE_TAX), APPROVED or
    -- CANCELLED only at this point (PAID already excluded above).
    if not public.has_company_role(
      v_doc.company_id,
      array['OWNER', 'ACCOUNTANT']::public.member_role[]
    ) then
      raise exception 'คุณไม่มีสิทธิ์ลบเอกสารนี้';
    end if;
  end if;

  -- The `for update` lock taken above already serializes concurrent
  -- callers on this row; `and deleted_at is null` here is a defense-in-
  -- depth guard on top of that, not the only protection.
  update public.documents
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_document_id and deleted_at is null
  returning * into v_doc;

  if v_doc is null then
    raise exception 'เอกสารนี้ถูกลบไปแล้ว';
  end if;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_doc.company_id, auth.uid(), 'SOFT_DELETE_DOCUMENT', 'document', v_doc.id,
    jsonb_build_object(
      'documentType', v_doc.document_type,
      'status', v_doc.status,
      'documentNumber', v_doc.document_number
    )
  );

  return v_doc;
end;
$$;

grant execute on function public.soft_delete_document(uuid) to authenticated;
