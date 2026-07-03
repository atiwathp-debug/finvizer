-- Production readiness fix: PAID must not block valid downstream document
-- creation. An INVOICE that has already been marked PAID (directly, or by
-- the mark_document_paid() cascade from a related RECEIPT) still needs to
-- be convertible to RECEIPT and TAX_INVOICE if those weren't created yet
-- — a paid invoice with no receipt/tax invoice on file is a real,
-- everyday accounting gap this app must let a user close. PAID only
-- blocks editing (documents_update_draft_only never matches non-DRAFT
-- rows) and cancelling (cancel_document requires APPROVED) — conversion
-- eligibility is a separate concern and is relaxed here to also accept a
-- PAID source, for every document type in documentConversionMap (not just
-- INVOICE), so the same fix covers e.g. a paid RECEIPT still being
-- convertible to RECEIPT_TAX_INVOICE.
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

  if v_source.status not in ('APPROVED', 'PAID') then
    raise exception 'แปลงเอกสารได้เฉพาะเอกสารที่อนุมัติแล้วหรือชำระแล้วเท่านั้น';
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
