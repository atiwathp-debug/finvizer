-- Pass 2.1 QA fix: widen companies.logo_size's max from 160 to 200, and add
-- the new 'centered_logo_above_company' logo_position option.
--
-- Repair-only, idempotent (safe to run more than once) — drops each check
-- constraint by its known default-generated name before recreating it with
-- the widened range/enum list, rather than assuming neither exists yet.
-- Does not touch mark_document_paid, create_document_conversion,
-- approve_document, cancel_document, or any dashboard/report table or
-- function.
alter table public.companies drop constraint if exists companies_logo_size_check;
alter table public.companies add constraint companies_logo_size_check
  check (logo_size between 24 and 200);

alter table public.companies drop constraint if exists companies_logo_position_check;
alter table public.companies add constraint companies_logo_position_check
  check (logo_position in (
    'left_of_company_name',
    'header_left',
    'header_center',
    'header_right',
    'centered_logo_above_company',
    'hidden'
  ));
