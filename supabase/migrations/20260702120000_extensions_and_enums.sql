-- Phase 1B: Database Schema & RLS Foundation
-- Enum types shared by the tables created in the next migration.
--
-- gen_random_uuid() is a core Postgres 13+ function (Supabase's Postgres is
-- 15+), so no extension needs to be enabled for uuid primary key defaults.

create type public.member_role as enum ('OWNER', 'ADMIN', 'ACCOUNTANT', 'EDITOR', 'VIEWER');

create type public.member_status as enum ('ACTIVE', 'INVITED', 'DISABLED');

create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- Company's default document template (assigned in Phase 2A). The
-- companies.document_template column stays nullable until then — a null
-- value is what sends a user to /onboarding/template.
create type public.document_template as enum ('EXECUTIVE_CLASSIC', 'MODERN_ACCENT');
