-- Pass 4: per-company overrides for the display-text labels used across
-- all 3 document templates (customer/table/totals/VAT/note labels, plus
-- per-document-type titles) -- see src/lib/templates/documentTemplateText.ts
-- for the defaults these overrides layer on top of.
--
-- Additive-only, idempotent (safe to run more than once). Does NOT touch
-- mark_document_paid, create_document_conversion, approve_document,
-- cancel_document, or any dashboard/report/numbering table or function.
--
-- A single JSONB blob (not a column-per-label) so new overridable labels
-- can be added later purely in application code, with no further schema
-- change -- same reasoning as audit_logs.metadata. Shape:
--   { "labels": { "customerLabel": "...", ... },
--     "documentTypeTitles": { "QUOTATION": "...", ... } }
-- A company with no overrides yet has '{}', and every key is optional --
-- the app falls back to today's Thai defaults for anything absent.
alter table public.companies
  add column if not exists template_text_overrides jsonb not null default '{}'::jsonb;
