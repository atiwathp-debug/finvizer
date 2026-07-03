-- FinVizer: corrective script for Thai-text corruption introduced by a
-- PowerShell clipboard copy (Get-Content -Raw | Set-Clipboard without
-- -Encoding UTF8, which reads the UTF-8 source file using the system's
-- ANSI code page instead, mangling every multi-byte Thai character before
-- it ever reached the SQL Editor). English/ASCII SQL was unaffected --
-- only the Thai string literals embedded in the migrations were corrupted
-- in the live database: companies.branch_name's default value, and every
-- Thai raise-exception message inside 6 RPC functions.
--
-- This script is idempotent and safe to run once against the project the
-- combined_migrations.sql script was applied to. It does not change any
-- schema shape -- only text content.
--
-- Run this in the SQL Editor the same way as combined_migrations.sql.
-- Recommended copy method this time: open this file directly in a text
-- editor (e.g. Notepad, VS Code) and copy from there -- do not use
-- PowerShell's Get-Content | Set-Clipboard without -Encoding UTF8.

-- 1. Fix the companies.branch_name default + backfill existing rows -------
alter table public.companies
  alter column branch_name set default 'สำนักงานใหญ่';

update public.companies
  set branch_name = 'สำนักงานใหญ่'
  where branch_code = 'HQ' and branch_name <> 'สำนักงานใหญ่';

-- 2. Re-create every function containing Thai text literals ---------------

create or replace function public.accept_invitation(p_token_hash text)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations;
  v_user_email text;
  v_company public.companies;
begin
  select * into v_invitation
  from public.invitations
  where token_hash = p_token_hash
    and status = 'PENDING'
  limit 1;

  if v_invitation is null then
    raise exception 'ลิงก์คำเชิญไม่ถูกต้องหรือถูกใช้งานไปแล้ว';
  end if;

  if v_invitation.expires_at < now() then
    update public.invitations set status = 'EXPIRED' where id = v_invitation.id;
    raise exception 'ลิงก์คำเชิญหมดอายุแล้ว';
  end if;

  select email into v_user_email from auth.users where id = auth.uid();

  if v_user_email is null or lower(v_user_email) <> v_invitation.invited_email then
    raise exception 'อีเมลของคุณไม่ตรงกับอีเมลที่ได้รับคำเชิญ';
  end if;

  if exists (select 1 from public.company_members where user_id = auth.uid()) then
    raise exception 'คุณเป็นสมาชิกของบริษัทอื่นอยู่แล้ว ไม่สามารถเข้าร่วมบริษัทนี้ได้';
  end if;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_invitation.company_id, auth.uid(), v_invitation.invited_role, 'ACTIVE');

  update public.invitations
  set status = 'ACCEPTED', accepted_at = now()
  where id = v_invitation.id;

  select * into v_company from public.companies where id = v_invitation.company_id;
  return v_company;
end;
$$;

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
