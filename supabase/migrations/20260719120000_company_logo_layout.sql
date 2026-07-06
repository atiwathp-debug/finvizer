-- Pass 2.1: configurable company logo size/position for document headers.
--
-- Additive-only, idempotent (safe to run more than once). Does NOT touch
-- mark_document_paid, create_document_conversion, approve_document,
-- cancel_document, or any dashboard/report table or function.
--
-- logo_size: side length (px on screen / pt in the exported PDF) of the
-- square bounding box the logo renders inside, aspect ratio preserved via
-- object-fit: contain both in the on-screen preview and the PDF export.
-- Range mirrors src/types/logoLayout.ts's LOGO_SIZE_MIN/MAX.
--
-- logo_position: which header slot the logo renders in. 'left_of_company_name'
-- and 'header_left' both reproduce today's placement exactly (every
-- existing template already puts the logo at the header's left/start —
-- see src/types/logoLayout.ts's shouldRenderLogoAtSlot for the single
-- place this is decided); 'header_center'/'header_right' move it;
-- 'hidden' removes it regardless of logo_url.
--
-- The "add column if not exists ... check (...)" form only applies the
-- inline check when the column is actually being added, so re-running
-- this file on a database that already has these columns is a no-op.
alter table public.companies
  add column if not exists logo_size integer not null default 48
    check (logo_size between 24 and 160),
  add column if not exists logo_position text not null default 'left_of_company_name'
    check (logo_position in (
      'left_of_company_name',
      'header_left',
      'header_center',
      'header_right',
      'hidden'
    ));
