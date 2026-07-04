-- Production readiness pass 2: adds a third document template -- a plain
-- black-line/minimal printable form style, alongside the existing
-- EXECUTIVE_CLASSIC and MODERN_ACCENT. This migration does not use the
-- new enum value anywhere else in this file (Postgres does not allow a
-- newly added enum value to be used in the same transaction it was added
-- in, in some versions) -- it is added here alone, on purpose.
alter type public.document_template add value if not exists 'MINIMAL_PRINT';
