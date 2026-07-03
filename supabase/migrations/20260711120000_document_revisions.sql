-- Phase 4C: Document Revision
--
-- A revision is an ordinary `documents` row (same table, same lifecycle:
-- DRAFT -> APPROVED, and via Phase 4B's RPCs, -> PAID/CANCELLED) that
-- additionally carries `parent_document_id`, pointing back at the
-- original (never-revised) document it was created from. Editing a
-- revision Draft reuses Phase 4A's saveDraftDocument()/DocumentForm flow
-- completely unchanged — `documents_update_draft_only` already keys off
-- `status = 'DRAFT'` alone, so a revision Draft is just as editable as
-- any other Draft with zero new code.

alter table public.documents
  add column parent_document_id uuid references public.documents (id),
  add column revision_no integer;

comment on column public.documents.parent_document_id is
  'Set only on a revision row — always references the ORIGINAL document
  (a row whose own parent_document_id is null), never another revision.
  Revising a revision is not supported in this phase (see
  create_document_revision() below); null for every ordinary document.';

comment on column public.documents.revision_no is
  'Null until a revision Draft is approved (mirrors document_number''s
  own null-while-Draft convention). Assigned by approve_document() as
  1, 2, 3... in approval order among revisions sharing the same
  parent_document_id, and combined with the parent''s document_number to
  render "PARENT_NUMBER-R{n}". Always null for non-revision documents.';

create index documents_parent_document_id_idx on public.documents (parent_document_id);

-- Defensive backstop (mirrors documents_number_unique's role): two
-- approved revisions of the same parent can never end up with the same
-- revision_no. NULLs (every non-revision row, and every not-yet-approved
-- revision Draft) are never considered equal to each other under
-- standard SQL unique-constraint semantics, so this only ever constrains
-- actual approved revisions.
alter table public.documents
  add constraint documents_revision_no_unique unique (parent_document_id, revision_no);

-- Tighten the ordinary insert policy: a direct client insert (the normal
-- "new Draft" flow, Phase 2C/4A) can never set parent_document_id itself.
-- A revision Draft can only come from create_document_revision() below,
-- whose security definer privileges bypass this policy entirely — the
-- same "only a controlled function can produce this shape of row"
-- pattern as document_number/status being unreachable outside
-- approve_document().
drop policy "documents_insert_editors" on public.documents;

create policy "documents_insert_editors"
on public.documents
for insert
to authenticated
with check (
  status = 'DRAFT'
  and document_number is null
  and parent_document_id is null
  and created_by = auth.uid()
  and public.has_company_role(company_id, array['OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR']::public.member_role[])
);

-- create_document_revision ---------------------------------------------
-- Creates a new Draft, copying customer, line items, VAT mode, note,
-- payment term (due_date), document type, and totals from an APPROVED,
-- non-revision source document. Deliberately does NOT copy issue_date
-- (a revision is freshly issued "now", defaulting to current_date) —
-- every other field the master spec's copy list names is carried over
-- verbatim. "Template" isn't a per-document field at all — it's the
-- owning company's document_template, which the revision already
-- inherits automatically by staying in the same company.
create or replace function public.create_document_revision(p_document_id uuid)
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
    raise exception 'คุณไม่มีสิทธิ์สร้าง Revision';
  end if;

  if v_source.status <> 'APPROVED' then
    raise exception 'สร้าง Revision ได้เฉพาะเอกสารที่อนุมัติแล้วเท่านั้น';
  end if;

  -- Only an original may be revised — never a revision of a revision.
  -- This keeps "PARENT_NUMBER-R{n}" well-defined without needing to walk
  -- an arbitrarily deep chain to find the true root.
  if v_source.parent_document_id is not null then
    raise exception 'ไม่สามารถสร้าง Revision จากเอกสารที่เป็น Revision ได้';
  end if;

  insert into public.documents (
    company_id, document_type, status, customer_id, customer_code,
    document_number, parent_document_id, revision_no,
    vat_mode, issue_date, due_date, note,
    document_discount_type, document_discount_value,
    subtotal, discount_total, vat_amount, grand_total,
    created_by
  )
  values (
    v_source.company_id, v_source.document_type, 'DRAFT', v_source.customer_id, v_source.customer_code,
    null, v_source.id, null,
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
    v_source.company_id, auth.uid(), 'CREATE_DOCUMENT_REVISION', 'document', v_new.id,
    jsonb_build_object('parentDocumentId', v_source.id, 'parentDocumentNumber', v_source.document_number)
  );

  return v_new;
end;
$$;

grant execute on function public.create_document_revision(uuid) to authenticated;

-- approve_document -----------------------------------------------------
-- Extended (create or replace, same function/signature — Phase 2C's
-- original body is preserved for the non-revision path) to branch when
-- the Draft being approved is a revision: skip numbering_settings/
-- numbering_sequences/pattern rendering entirely (a revision never gets
-- its own independent running number) and instead derive
-- "PARENT_NUMBER-R{n}" from the locked parent row.
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
  v_parent public.documents;
  v_revision_no integer;
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

  if v_document.parent_document_id is not null then
    -- Revision path: lock the parent row so two concurrent approvals of
    -- different revisions sharing the same parent serialize on this lock
    -- instead of racing to compute the same next revision_no.
    select * into v_parent from public.documents where id = v_document.parent_document_id for update;
    if v_parent is null or v_parent.document_number is null then
      raise exception 'ไม่พบเอกสารต้นฉบับ หรือเอกสารต้นฉบับยังไม่มีเลขที่เอกสาร';
    end if;

    loop
      v_attempt := v_attempt + 1;

      select coalesce(max(revision_no), 0) + 1 into v_revision_no
      from public.documents
      where parent_document_id = v_document.parent_document_id
        and revision_no is not null;

      v_document_number := v_parent.document_number || '-R' || v_revision_no::text;

      begin
        update public.documents
        set status = 'APPROVED',
            document_number = v_document_number,
            revision_no = v_revision_no,
            approved_by = auth.uid(),
            approved_at = now()
        where id = p_document_id
        returning * into v_document;

        exit;
      exception when unique_violation then
        if v_attempt >= v_max_attempts then
          raise exception 'ไม่สามารถออกเลขที่ Revision ได้ กรุณาลองใหม่อีกครั้ง (เลขที่ซ้ำ)';
        end if;
      end;
    end loop;

    insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
    values (
      v_document.company_id, auth.uid(), 'APPROVE_REVISION', 'document', v_document.id,
      jsonb_build_object(
        'documentNumber', v_document_number, 'revisionNo', v_revision_no,
        'parentDocumentId', v_document.parent_document_id
      )
    );

    return v_document;
  end if;

  -- Original path — unchanged from Phase 2C.
  select * into v_company from public.companies where id = v_document.company_id;

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

  v_attempt := 0;
  loop
    v_attempt := v_attempt + 1;

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

      exit;
    exception when unique_violation then
      if v_attempt >= v_max_attempts then
        raise exception 'ไม่สามารถออกเลขที่เอกสารได้ กรุณาลองใหม่อีกครั้ง (เลขที่เอกสารซ้ำ)';
      end if;
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
