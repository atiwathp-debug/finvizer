-- Phase 1C: Company Onboarding
-- Atomically creates a company and the caller's OWNER company_members row.
--
-- `security invoker` (the default — stated explicitly for clarity): unlike
-- the Phase 1B helper functions, this does NOT bypass RLS. Both inserts
-- still go through companies_insert_if_no_existing_membership and
-- company_members_insert_owner_bootstrap exactly as if the client had
-- called them directly. What this function adds is atomicity: since the
-- whole function body runs as one statement/transaction, if the second
-- insert fails for any reason, the first is rolled back too — a plain
-- two-step client-side insert could otherwise leave an orphaned company
-- row with no owner membership.
create or replace function public.create_company_with_owner(
  p_name_th text,
  p_name_en text,
  p_company_code text,
  p_tax_id text,
  p_address text,
  p_phone text,
  p_email text,
  p_contact_name text,
  p_logo_url text
)
returns public.companies
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company public.companies;
begin
  insert into public.companies (
    owner_id, name_th, name_en, company_code, tax_id,
    address, phone, email, contact_name, logo_url
  ) values (
    auth.uid(), p_name_th, p_name_en, p_company_code, p_tax_id,
    p_address, p_phone, p_email, p_contact_name, p_logo_url
  )
  returning * into v_company;

  insert into public.company_members (company_id, user_id, role, status)
  values (v_company.id, auth.uid(), 'OWNER', 'ACTIVE');

  return v_company;
end;
$$;

grant execute on function public.create_company_with_owner(
  text, text, text, text, text, text, text, text, text
) to authenticated;
