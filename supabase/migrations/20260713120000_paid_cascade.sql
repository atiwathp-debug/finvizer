-- Production readiness: Mark as Paid is only meaningful on documents that
-- represent actual money collected (RECEIPT / RECEIPT_TAX_INVOICE) —
-- QUOTATION, INVOICE (unpaid), TAX_INVOICE, and CREDIT_NOTE/CREDIT_NOTE_TAX
-- must never be marked paid directly. When a receipt is paid, every other
-- APPROVED document connected to it through the conversion chain
-- (source_document_id, in either direction) that still represents the same
-- sale — its parent INVOICE/TAX_INVOICE and any sibling RECEIPT_TAX_INVOICE
-- off the same INVOICE — should become PAID too, since they're the same
-- underlying transaction. QUOTATION/RFQ never carry money owed, so they're
-- excluded from the cascade even though they're in the chain; CREDIT_NOTE
-- documents represent reductions, not sales, so they're excluded too;
-- CANCELLED documents are excluded by the APPROVED-only filter, so they
-- stay terminal without any extra code.
create or replace function public.mark_document_paid(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents;
  v_related public.documents;
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

  if v_document.document_type not in ('RECEIPT', 'RECEIPT_TAX_INVOICE') then
    raise exception 'บันทึกชำระเงินได้เฉพาะใบเสร็จรับเงินเท่านั้น';
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

  -- Walk the full connected component reachable via source_document_id,
  -- both toward ancestors (this document's source, its source's source,
  -- ...) and toward descendants (documents converted from any id already
  -- in the chain) — a plain recursive union over a finite DAG, so it
  -- terminates and naturally de-duplicates.
  for v_related in
    with recursive chain(id) as (
      select p_document_id
      union
      select d.source_document_id
      from public.documents d
      join chain c on d.id = c.id
      where d.source_document_id is not null
      union
      select d.id
      from public.documents d
      join chain c on d.source_document_id = c.id
    )
    select doc.*
    from public.documents doc
    where doc.id in (select id from chain where id <> p_document_id)
      and doc.company_id = v_document.company_id
      and doc.status = 'APPROVED'
      and doc.document_type in ('INVOICE', 'TAX_INVOICE', 'RECEIPT', 'RECEIPT_TAX_INVOICE')
    for update
  loop
    update public.documents set status = 'PAID' where id = v_related.id;

    insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
    values (
      v_related.company_id, auth.uid(), 'MARK_DOCUMENT_PAID', 'document', v_related.id,
      jsonb_build_object('documentNumber', v_related.document_number, 'cascadedFrom', v_document.document_number)
    );
  end loop;

  return v_document;
end;
$$;

grant execute on function public.mark_document_paid(uuid) to authenticated;
