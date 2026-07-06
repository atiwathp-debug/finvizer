-- Pass 5B-1: Document Soft Delete — Schema Only
--
-- Adds deleted_at/deleted_by to public.documents, mirroring the existing
-- soft-delete columns on public.customers (20260708120000_customers.sql)
-- and public.companies (20260702120100_tables.sql) — same reasoning:
-- documents can be referenced by other documents (source_document_id,
-- parent_document_id) and an issued document's document_number must stay
-- permanently reserved (documents_number_unique has no partial-index
-- qualifier, unlike customers_unique_code_among_active, and that is not
-- changing here), so soft delete preserves history and referential
-- integrity instead of a hard DELETE.
--
-- Schema only — no RPC, no RLS policy change, no read-path filtering, no
-- data backfill. Both columns are nullable with no default, so every
-- existing row is left exactly as-is (implicitly "not deleted"). Delete
-- behavior (a soft_delete_document() RPC, permission checks, and
-- excluding deleted_at IS NOT NULL rows from listDocuments()) is a
-- separate, later pass.

alter table public.documents
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null;
