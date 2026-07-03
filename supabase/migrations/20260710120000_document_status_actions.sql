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
