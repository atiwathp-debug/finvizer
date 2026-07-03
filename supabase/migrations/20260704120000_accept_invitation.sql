-- Phase 1D: Member Invitation & Roles
-- Accepts an invitation: validates the token/email/existing-membership,
-- then atomically creates the ACTIVE company_members row and marks the
-- invitation ACCEPTED.
--
-- security definer is required (unlike create_company_with_owner in Phase
-- 1C, which is security invoker): the invited user is not the company
-- owner, so neither the invitations_select_owner_only policy nor the
-- company_members_insert_owner_bootstrap policy would let a plain client
-- call do this lookup/insert. This function bypasses both intentionally,
-- but only after re-validating everything those policies would have
-- checked (ownership aside) itself, in Postgres — never trusting anything
-- the client claims about the invitation.
--
-- Takes p_token_hash, not the raw token: hashing happens entirely on the
-- client (src/lib/utils/inviteToken.ts, same SHA-256 approach used for
-- Mock Mode), so this function — and the database — never needs to see the
-- raw token at all, only compare hashes.
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

grant execute on function public.accept_invitation(text) to authenticated;
